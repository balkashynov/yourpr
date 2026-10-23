"""Strict IRCC normalization; preserve evidence before interpreting it."""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import tempfile
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

SOURCE_URL = "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json"
ROUNDS_URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html"
PARSER_VERSION = "ircc-1.0.0"
BUNDLED_DATA = Path(__file__).resolve().parents[1] / "data"
BANDS = [(1, 601, 1200), (2, 501, 600), (4, 491, 500), (5, 481, 490),
         (6, 471, 480), (7, 461, 470), (8, 451, 460), (10, 441, 450),
         (11, 431, 440), (12, 421, 430), (13, 411, 420), (14, 401, 410),
         (15, 351, 400), (16, 301, 350), (17, 0, 300)]
CATEGORY_MAP = {
    "Canadian Experience Class": "CEC", "Provincial Nominee Program": "PNP",
    "No Program Specified": "GENERAL", "General": "GENERAL",
    "Federal Skilled Worker": "FSW", "Federal Skilled Trades": "FST",
    "French language proficiency (Version 1)": "FRENCH",
    "French-Language proficiency 2026-Version 2": "FRENCH",
    "Healthcare occupations (Version 1)": "HEALTH",
    "Healthcare and social services occupations (Version 2)": "HEALTH",
    "Healthcare and Social Services Occupations, 2026-Version 3": "HEALTH",
    "Trade occupations (Version 1)": "TRADES", "Trade occupations (Version 2)": "TRADES",
    "Trades Occupations, 2026-Version 3": "TRADES",
    "STEM occupations (Version 1)": "STEM", "Education occupations (Version 1)": "EDUCATION",
    "Transport occupations (Version 1)": "TRANSPORT", "Transport Occupations, 2026-Version 2": "TRANSPORT",
    "Agriculture and agri-food occupations (Version 1)": "AGRICULTURE",
    "Physicians with Canadian Work Experience, 2026-Version 1": "PHYSICIANS",
    "Senior managers with Canadian Work Experience, 2026-Version 1": "MANAGERS",
    "Skilled Military Recruits, 2026-Version 1": "MILITARY",
}
POLICIES = [
    {"date": "2025-03-25", "title": "Job-offer CRS points removed", "kind": "scoring",
     "description": "A scoring break. Models restart their training window after this date.",
     "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/amendment-2025-1.html"},
    {"date": "2026-02-18", "title": "2026 categories announced", "kind": "category",
     "description": "Category-selection context changes; a separate evaluation window starts here.",
     "url": "https://www.canada.ca/en/immigration-refugees-citizenship/news/2026/02/canada-prioritizes-top-talent-in-2026-immigration-express-entry-categories.html"},
    {"date": "2026-11-03", "title": "New CRS rules take effect", "kind": "scoring",
     "description": "IRCC has announced a Labour Market Integration factor and a temporary draw pause while scores are recalculated. Pre-change scenarios do not model these effects.",
     "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html"},
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def data_dir() -> Path:
    return Path(os.getenv("DATA_DIR", str(BUNDLED_DATA / "runtime")))


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, suffix=".tmp") as f:
        json.dump(value, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        temp = f.name
    os.replace(temp, path)


def regime(day: str) -> str:
    # Earlier history is descriptive only: it contains additional unmodeled breaks.
    if day >= "2026-11-03":
        return "2026-lmi"
    if day >= "2026-02-18":
        return "2026-categories"
    if day >= "2025-03-25":
        return "2025-no-job-points"
    return "historical-unmodeled"


def integer(value: object, field: str) -> int:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise ValueError(f"Invalid {field}: expected a nonnegative integer")
    text = str(value).strip()
    if not re.fullmatch(r"\d+|\d{1,3}(?:,\d{3})+", text):
        raise ValueError(f"Invalid {field}: {text!r}")
    return int(text.replace(",", ""))


def normalize(payload: dict, fetch_id: str) -> dict:
    rows = payload.get("rounds")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Schema drift: expected non-empty rounds array")
    draws, pools, issues, seen = [], {}, [], set()
    missing = Counter()
    required = {"drawNumber", "drawDate", "drawName", "drawSize", "drawCRS"}
    for row in rows:
        if not isinstance(row, dict) or required - row.keys():
            raise ValueError("Schema drift: missing required draw fields")
        draw_id = str(row["drawNumber"])
        if draw_id in seen:
            raise ValueError(f"Duplicate draw ID {draw_id}")
        seen.add(draw_id)
        day = date.fromisoformat(row["drawDate"]).isoformat()
        cutoff = integer(row["drawCRS"], "drawCRS")
        size = integer(row["drawSize"], "drawSize")
        if cutoff > 1200 or size == 0:
            raise ValueError(f"Invalid CRS or invitation count in draw {draw_id}")
        raw_category = row["drawName"]
        if not isinstance(raw_category, str) or not raw_category.strip():
            raise ValueError(f"Invalid category in draw {draw_id}")
        category = CATEGORY_MAP.get(raw_category, "OTHER")
        if category == "OTHER":
            issues.append(f"Unmapped category in draw {draw_id}: {raw_category}")
        match = re.search(r"href=['\"]([^'\"]+)", row.get("drawNumberURL", ""))
        source = urljoin("https://www.canada.ca", match.group(1)) if match else ROUNDS_URL
        if urlparse(source).hostname != "www.canada.ca" or urlparse(source).scheme != "https":
            source = ROUNDS_URL
        draws.append({"id": draw_id, "date": day, "category": category, "category_raw": raw_category,
                      "invitations": size, "cutoff": cutoff, "tie_break": row.get("drawCutOff") or None,
                      "draw_time_raw": row.get("drawDateTime") or None, "source_url": source,
                      "source_fetch_id": fetch_id, "regime": regime(day)})
        if not row.get("drawCutOff"):
            missing["tie_break"] += 1
        if not row.get("drawDistributionAsOn") or any(row.get(f"dd{i}") in (None, "") for i in range(1, 19)):
            missing["pool"] += 1
            continue
        counts = {i: integer(row[f"dd{i}"], f"dd{i}") for i in range(1, 19)}
        if not any(counts.values()):
            missing["pool"] += 1
            continue
        if (counts[18] != sum(counts[i] for i, _, _ in BANDS)
                or counts[3] != sum(counts[i] for i in range(4, 9))
                or counts[9] != sum(counts[i] for i in range(10, 15))):
            issues.append(f"Pool totals do not reconcile in draw {draw_id}; snapshot quarantined")
            missing["pool_inconsistent"] += 1
            continue
        observed = datetime.strptime(row["drawDistributionAsOn"].strip(), "%B %d, %Y").date().isoformat()
        if observed > day:
            issues.append(f"Pool date is later than draw {draw_id}; snapshot quarantined")
            continue
        bands = [{"min": lo, "max": hi, "count": counts[i]} for i, lo, hi in BANDS]
        if observed in pools:
            if pools[observed]["bands"] != bands:
                raise ValueError(f"Conflicting pool snapshots on {observed}")
            pools[observed]["associated_draw_ids"].append(draw_id)
        else:
            pools[observed] = {"date": observed, "total": counts[18], "bands": bands,
                               "associated_draw_ids": [draw_id], "source_url": source,
                               "source_fetch_id": fetch_id, "regime": regime(observed),
                               "published_at": None}
    draws.sort(key=lambda d: (d["date"], d["id"]))
    return {"draws": draws, "pool_snapshots": sorted(pools.values(), key=lambda p: p["date"]),
            "audit": {"missing": dict(missing), "issues": issues,
                      "categories": dict(Counter(d["category"] for d in draws)),
                      "first_draw": draws[0]["date"], "last_draw": draws[-1]["date"],
                      "draw_count": len(draws), "pool_count": len(pools)}}


def preserve_raw(raw: bytes, directory: Path, fetched_at: str, method: str = "http") -> dict:
    digest = hashlib.sha256(raw).hexdigest()
    path = directory / "raw" / f"{digest}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError("Raw archive hash collision or corruption")
    else:
        with path.open("xb") as f:
            f.write(raw)
    return {"id": digest, "url": SOURCE_URL, "fetched_at": fetched_at,
            "http_status": 200 if method == "http" else None, "method": method,
            "sha256": digest, "raw_path": f"raw/{digest}.json", "parser_version": PARSER_VERSION}


def write_database(bundle: dict, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=directory, suffix=".sqlite")
    os.close(fd)
    try:
        with sqlite3.connect(temporary) as db:
            db.executescript("""
            CREATE TABLE source_fetches (id TEXT PRIMARY KEY, url TEXT, fetched_at TEXT, sha256 TEXT, raw_path TEXT, parser_version TEXT);
            CREATE TABLE draws (id TEXT PRIMARY KEY, date TEXT, category TEXT, category_raw TEXT, invitation_count INTEGER, cutoff_crs INTEGER, tie_break TEXT, source_fetch_id TEXT, scoring_regime TEXT);
            CREATE TABLE pool_snapshots (observed_at TEXT, band_min INTEGER, band_max INTEGER, candidate_count INTEGER, source_fetch_id TEXT, scoring_regime TEXT, PRIMARY KEY(observed_at, band_min));
            CREATE TABLE policy_events (effective_at TEXT PRIMARY KEY, description TEXT, official_url TEXT, kind TEXT);
            """)
            source = bundle["source"]
            db.execute("INSERT INTO source_fetches VALUES (?,?,?,?,?,?)", tuple(source[k] for k in ("id", "url", "fetched_at", "sha256", "raw_path", "parser_version")))
            db.executemany("INSERT INTO draws VALUES (?,?,?,?,?,?,?,?,?)", [(d["id"], d["date"], d["category"], d["category_raw"], d["invitations"], d["cutoff"], d["tie_break"], d["source_fetch_id"], d["regime"]) for d in bundle["draws"]])
            db.executemany("INSERT INTO pool_snapshots VALUES (?,?,?,?,?,?)", [(p["date"], b["min"], b["max"], b["count"], p["source_fetch_id"], p["regime"]) for p in bundle["pool_snapshots"] for b in p["bands"]])
            db.executemany("INSERT INTO policy_events VALUES (?,?,?,?)", [(p["date"], p["title"], p["url"], p["kind"]) for p in bundle["policies"]])
        os.replace(temporary, directory / "yourpr.sqlite")
    finally:
        if Path(temporary).exists():
            Path(temporary).unlink()


def load_bundle() -> dict:
    runtime = data_dir() / "snapshot.json"
    return json.loads((runtime if runtime.exists() else BUNDLED_DATA / "snapshot.json").read_text())

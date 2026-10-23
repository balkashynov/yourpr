"""Fetch, archive, validate, evaluate, then atomically publish."""
import argparse
import json
import logging
import time
from pathlib import Path
import httpx
from .data import (BUNDLED_DATA, SOURCE_URL, POLICIES, atomic_json, data_dir,
                   normalize, preserve_raw, utc_now, write_database)
from .model import evaluate

log = logging.getLogger(__name__)


def canonical_numbers(value):
    """Remove insignificant BLAS/platform noise from versioned JSON exports."""
    if isinstance(value, float):
        return round(value, 8)
    if isinstance(value, dict):
        return {key: canonical_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [canonical_numbers(item) for item in value]
    return value


def build(raw: bytes, source: dict, directory: Path) -> dict:
    parsed = normalize(json.loads(raw), source["id"])
    bundle = {"schema_version": 1, "source": source, **parsed, "policies": POLICIES,
              "backtests": evaluate(parsed["draws"])}
    bundle = canonical_numbers(bundle)
    write_database(bundle, directory)
    atomic_json(directory / "snapshot.json", bundle)
    atomic_json(directory / "manifest.json", source)
    return bundle


def refresh(directory: Path | None = None) -> dict:
    directory = directory or data_dir()
    try:
        with httpx.Client(timeout=30, follow_redirects=True, headers={"User-Agent": "YourPREE/1.0 (public-data research)"}) as client:
            for attempt in range(3):
                try:
                    response = client.get(SOURCE_URL)
                    response.raise_for_status()
                    raw = response.content
                    if len(raw) > 20_000_000:
                        raise ValueError("IRCC response exceeded 20 MB")
                    break
                except httpx.HTTPError:
                    if attempt == 2:
                        raise
                    time.sleep(2 ** attempt)
        source = preserve_raw(raw, directory, utc_now())
        # Archive malformed responses too, but never replace last-known-good data.
        result = build(raw, source, directory)
        atomic_json(directory / "refresh-status.json", {"attempted_at": utc_now(), "ok": True, "error": None})
        log.info("IRCC refresh successful: %s draws, sha256=%s", result["audit"]["draw_count"], source["sha256"])
        return result
    except Exception as exc:
        atomic_json(directory / "refresh-status.json", {"attempted_at": utc_now(), "ok": False, "error": type(exc).__name__})
        log.exception("IRCC refresh failed; retaining last-known-good snapshot")
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["reproduce", "refresh", "import"])
    parser.add_argument("--file", type=Path)
    parser.add_argument("--retrieved-at", help="Original UTC retrieval timestamp for manual official JSON imports")
    parser.add_argument("--output", type=Path, default=data_dir())
    parser.add_argument("--export", type=Path, help="Optional frontend snapshot destination")
    args = parser.parse_args()
    if args.command == "refresh":
        bundle = refresh(args.output)
    elif args.command == "import":
        if not args.file or not args.retrieved_at:
            parser.error("import requires --file and --retrieved-at")
        from datetime import datetime
        stamp = datetime.fromisoformat(args.retrieved_at)
        if stamp.tzinfo is None:
            parser.error("--retrieved-at must include its timezone")
        raw = args.file.read_bytes()
        source = preserve_raw(raw, args.output, stamp.isoformat(), "manual-official-json")
        bundle = build(raw, source, args.output)
    else:
        import hashlib
        source = json.loads((BUNDLED_DATA / "manifest.json").read_text())
        raw = (BUNDLED_DATA / source["raw_path"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("Pinned fixture hash mismatch")
        preserve_raw(raw, args.output, source["fetched_at"], source["method"])
        bundle = build(raw, source, args.output)
    if args.export:
        atomic_json(args.export, bundle)
    print(f"IRCC: {bundle['audit']['draw_count']} draws; {bundle['audit']['pool_count']} validated pool snapshots")
    print(f"Source: {bundle['source']['url']}\nRetrieved: {bundle['source']['fetched_at']}\nSHA-256: {bundle['source']['sha256']}")
    for period in bundle["backtests"]["periods"]:
        print(f"\n{period['regime']} ({period['start']} to {period['end']})")
        for model in period["metrics"]:
            print(f"  {model['name']:<29} n={model['n']:2} MAE={model['mae']} 80% interval={model['intervals']['80']}")
    for issue in bundle["audit"]["issues"]:
        print(f"AUDIT: {issue}")


if __name__ == "__main__":
    main()

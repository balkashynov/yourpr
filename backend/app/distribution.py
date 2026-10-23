"""Mass-preserving full-pool reconstructions, not a CEC or arrival model.

Observed band totals constrain the cumulative count at band edges. Linear and
monotone cubic interpolation give two possible allocations inside those bands.
Neither identifies individual scores, ties, or category eligibility.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator

from .data import BUNDLED_DATA, atomic_json

MODEL_VERSION = "pool-distribution-1.0.0"


def build_distribution(pool: dict) -> dict:
    """Reconstruct counts at integer scores 0..1200 and sharp band-only bounds."""
    bands = sorted((dict(b) for b in pool["bands"]), key=lambda b: b["min"])
    next_score = 0
    for band in bands:
        if any(type(band[k]) is not int for k in ("min", "max", "count")):
            raise ValueError("Band endpoints and counts must be integers")
        if band["min"] != next_score or not band["min"] <= band["max"] <= 1200 or band["count"] < 0:
            raise ValueError("Nonnegative disjoint bands must cover every score 0..1200")
        next_score = band["max"] + 1
    total = pool["total"]
    if next_score != 1201 or type(total) is not int or total <= 0 or total != sum(b["count"] for b in bands):
        raise ValueError("Band counts must reconcile to a positive full-pool total")

    # Half-integer edges keep each integer CRS score in exactly one cell.
    edges = np.asarray([-.5] + [b["max"] + .5 for b in bands])
    cumulative = np.asarray([0] + list(np.cumsum([b["count"] for b in bands])), dtype=float)
    cdf = PchipInterpolator(edges, cumulative, extrapolate=False)
    score_edges = np.arange(-.5, 1201, 1)
    smooth = np.maximum(0, np.diff(cdf(score_edges)))
    uniform = np.zeros(1201)
    lower = np.zeros(1201, dtype=int)
    upper = np.zeros(1201, dtype=int)
    remaining = total
    for b in bands:
        indices = slice(b["min"], b["max"] + 1)
        uniform[indices] = b["count"] / (b["max"] - b["min"] + 1)
        # Remove floating-point drift while preserving each observed band total.
        if b["count"]:
            smooth[indices] *= b["count"] / smooth[indices].sum()
        else:
            smooth[indices] = 0
        remaining -= b["count"]
        lower[indices] = remaining
        upper[indices] = remaining + b["count"]
        upper[b["max"]] = remaining  # At a band maximum, strictly-higher is exact.

    # Reverse accumulation avoids subtractive cancellation near CRS 1200.
    tails = {}
    for name, counts in (("uniform", uniform), ("smooth", smooth)):
        tails[name] = np.clip(np.r_[np.cumsum(counts[:0:-1])[::-1], 0.0], lower, upper)

    return {
        "model_version": MODEL_VERSION,
        "population": "full_express_entry_pool",
        "observed_on": pool["date"],
        "total": total,
        "source_url": pool.get("source_url"),
        "source_fetch_id": pool.get("source_fetch_id"),
        "bands": bands,
        "methods": {
            "uniform": "Equal count at each integer score within each published band",
            "smooth": "Monotone PCHIP interpolation of cumulative counts at band edges",
        },
        "notes": [
            "Both reconstructions preserve all published band totals to numerical precision.",
            "Within-band shapes are assumptions, not observed individual score counts.",
            "Bounds describe all possible within-band allocations, not a confidence interval.",
            "Strictly higher scores exclude ties and do not determine invitation order.",
            "This is the full pool at its observation date; CEC eligibility and later flows are unknown.",
        ],
        "scores": [
            {"score": s, "lower_above": int(lower[s]), "upper_above": int(upper[s]),
             "uniform_count": float(uniform[s]), "smooth_count": float(smooth[s]),
             "uniform_above": float(tails["uniform"][s]), "smooth_above": float(tails["smooth"][s])}
            for s in range(1201)
        ],
    }


def score_summary(distribution: dict, score: int) -> dict:
    if type(score) is not int or not 0 <= score <= 1200:
        raise ValueError("CRS must be an integer from 0 to 1200")
    row = distribution["scores"][score]
    band = next(b for b in distribution["bands"] if b["min"] <= score <= b["max"])
    return {"observed_on": distribution["observed_on"], "population": distribution["population"],
            "score": score, "observed_band": band,
            "strictly_higher": {"band_only_bounds": [row["lower_above"], row["upper_above"]],
                                "uniform_estimate": round(row["uniform_above"]),
                                "smooth_estimate": round(row["smooth_above"])},
            "cec_estimate": None, "ties_ahead": None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=BUNDLED_DATA / "snapshot.json")
    parser.add_argument("--snapshot", default="latest", help="Observation date YYYY-MM-DD, or latest")
    parser.add_argument("--score", type=int, default=510)
    parser.add_argument("--output", type=Path, help="Optional path for all reconstructed scores")
    args = parser.parse_args()
    bundle = json.loads(args.input.read_text())
    pools = bundle["pool_snapshots"]
    pool = max(pools, key=lambda p: p["date"]) if pools and args.snapshot == "latest" else next(
        (p for p in pools if p["date"] == args.snapshot), None)
    if pool is None:
        parser.error("No validated pool snapshot matches the requested date")
    try:
        distribution = build_distribution(pool)
        summary = score_summary(distribution, args.score)
    except ValueError as exc:
        parser.error(str(exc))
    distribution["source"] = bundle["source"]
    if args.output:
        atomic_json(args.output, distribution)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

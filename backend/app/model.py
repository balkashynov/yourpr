"""Small conditional baselines. No reconstructed CEC pool or PR probabilities."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal
import math
import numpy as np
from scipy.optimize import lsq_linear
from pydantic import BaseModel, ConfigDict, Field
from .data import regime

MODEL_VERSION = "conditional-ridge-1.0.0"
MODELS = {"last": "Last observed cutoff", "median": "Rolling median · 3 draws", "ridge": "Conditional ridge"}
MIN_TRAIN = 6


def elapsed(previous: dict, current: dict) -> int:
    return (date.fromisoformat(current["date"]) - date.fromisoformat(previous["date"])).days


def features(previous: dict, current: dict) -> list[float]:
    return [1, math.log(current["invitations"] / previous["invitations"]),
            (elapsed(previous, current) - 14) / 14, (previous["cutoff"] - 520) / 20]


def fit(draws: list[dict]) -> list[float]:
    x = np.asarray([features(a, b) for a, b in zip(draws, draws[1:])], dtype=float)
    y = np.asarray([b["cutoff"] - a["cutoff"] for a, b in zip(draws, draws[1:])], dtype=float)
    # Fixed regularization, no tuning against the evaluation set. Size slope <= 0,
    # elapsed-time slope >= 0. These are assumptions, not causal identification.
    penalty = np.diag([0.3, 2.0, 2.0, 2.0])
    result = lsq_linear(np.vstack([x, penalty]), np.concatenate([y, np.zeros(4)]),
                        bounds=([-np.inf, -np.inf, 0, -np.inf], [np.inf, 0, np.inf, np.inf]))
    return result.x.tolist()


def predict(train: list[dict], target: dict) -> dict[str, float]:
    last = train[-1]["cutoff"]
    ridge = last + float(np.dot(fit(train), features(train[-1], target)))
    return {"last": float(last), "median": float(np.median([d["cutoff"] for d in train[-3:]])),
            "ridge": max(0, min(1200, ridge))}


def evaluate(draws: list[dict]) -> dict:
    cec = sorted([d for d in draws if d["category"] == "CEC"], key=lambda d: (d["date"], d["id"]))
    reports = []
    for period in sorted({d["regime"] for d in cec if d["regime"] != "historical-unmodeled"}):
        period_draws = [d for d in cec if d["regime"] == period]
        residuals = {name: [] for name in MODELS}
        points = []
        for i in range(MIN_TRAIN, len(period_draws)):
            target = period_draws[i]
            train = [d for d in period_draws[:i] if d["date"] < target["date"]]
            if len(train) < MIN_TRAIN:
                continue
            guesses = predict(train, target)
            intervals = {}
            for name, predicted in guesses.items():
                prior = residuals[name]
                # Intervals use only errors observed before this target.
                if len(prior) >= 5:
                    intervals[name] = {}
                    for level in [50, 80, 95]:
                        radius = float(np.quantile(np.abs(prior), level / 100, method="higher"))
                        intervals[name][str(level)] = [max(0, predicted - radius), min(1200, predicted + radius)]
                residuals[name].append(target["cutoff"] - predicted)
            points.append({"date": target["date"], "actual": target["cutoff"], "predictions": guesses,
                           "intervals": intervals, "train_end": train[-1]["date"], "train_count": len(train)})
        metrics = []
        for name, label in MODELS.items():
            errors = np.abs(residuals[name])
            coverage = {}
            for level in [50, 80, 95]:
                eligible = [(p["actual"], p["intervals"][name][str(level)]) for p in points if name in p["intervals"]]
                coverage[str(level)] = {"n": len(eligible), "coverage": sum(lo <= actual <= hi for actual, (lo, hi) in eligible) / len(eligible) if eligible else None,
                                        "width": float(np.mean([hi-lo for _, (lo, hi) in eligible])) if eligible else None}
            metrics.append({"id": name, "name": label, "n": len(errors),
                            "mae": float(np.mean(errors)) if len(errors) else None,
                            "median_error": float(np.median(errors)) if len(errors) else None,
                            "intervals": coverage})
        reports.append({"regime": period, "start": period_draws[0]["date"], "end": period_draws[-1]["date"],
                        "draw_count": len(period_draws), "metrics": metrics, "points": points})
    current = cec[-1]["regime"] if cec else None
    training = [d for d in cec if d["regime"] == current]
    report = next((r for r in reports if r["regime"] == current), None)
    model = None
    if len(training) >= MIN_TRAIN and report:
        coefficients = fit(training)
        errors = [p["actual"] - p["predictions"]["ridge"] for p in report["points"]]
        # Descriptive stress scale; never label this multi-step envelope a calibrated CI.
        radius = float(np.quantile(np.abs(errors), .8, method="higher")) if errors else None
        mae = {m["id"]: m["mae"] for m in report["metrics"]}
        model = {"version": MODEL_VERSION, "coefficients": coefficients, "regime": current,
                 "last_draw": training[-1], "training_count": len(training), "residual_count": len(errors),
                 "residual_radius": radius, "validation_passed": bool(len(errors) >= 20 and mae["ridge"] is not None and mae["ridge"] <= min(mae["last"], mae["median"])),
                 "draw_size_range": [min(d["invitations"] for d in training), max(d["invitations"] for d in training)],
                 "interval_range": [min(elapsed(a, b) for a, b in zip(training, training[1:])), max(elapsed(a, b) for a, b in zip(training, training[1:]))]}
    return {"version": MODEL_VERSION, "periods": reports, "model": model,
            "notes": ["Retrospective walk-forward evaluation uses revised historical draw records; archived publication-time versions are not available.",
                      "Pool snapshots are excluded from predictors because their publication timestamps are unknown.",
                      "Actual target draw sizes and intervals are supplied. This evaluates conditional cutoffs, not future IRCC schedules.",
                      "Intervals are evaluated using only earlier residuals. Small samples and policy breaks limit calibration."]}


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_draw_date: date | None = None
    crs_score: int = Field(default=510, ge=0, le=1200, strict=True)
    category: Literal["CEC"] = "CEC"
    draw_size: int = Field(default=3000, ge=100, le=10000, strict=True)
    interval_days: int = Field(default=14, ge=7, le=60, strict=True)
    horizon_draws: int = Field(default=6, ge=1, le=12, strict=True)
    assumptions: Literal["conservative", "base", "optimistic"] = "base"


def scenario(bundle: dict, request: Scenario) -> dict:
    model = bundle["backtests"]["model"]
    if not model or model["residual_radius"] is None:
        raise ValueError("Not enough same-regime CEC history for a scenario")
    last = model["last_draw"]
    if request.first_draw_date and request.first_draw_date <= date.fromisoformat(last["date"]):
        raise ValueError("First hypothetical draw must follow the last observed draw")
    previous = dict(last)
    radius = model["residual_radius"]
    shift = {"conservative": .5, "base": 0, "optimistic": -.5}[request.assumptions] * radius
    points = [{"step": 0, "date": last["date"], "cutoff": last["cutoff"], "low": last["cutoff"], "high": last["cutoff"], "crosses_policy": False}]
    warnings = ["Illustrative sensitivity range, not a calibrated probability or confidence interval.",
                "The draw schedule is an assumption; eligibility and tie-breaking still apply."]
    for step in range(1, request.horizon_draws + 1):
        day = ((request.first_draw_date + timedelta(days=request.interval_days * (step - 1))) if request.first_draw_date else (date.fromisoformat(last["date"]) + timedelta(days=request.interval_days * step))).isoformat()
        target = {"date": day, "invitations": request.draw_size}
        cutoff = max(0, min(1200, previous["cutoff"] + sum(a*b for a,b in zip(model["coefficients"], features(previous, target))) + shift))
        width = radius * math.sqrt(step)
        points.append({"step": step, "date": day, "cutoff": round(cutoff, 1), "low": round(max(0, cutoff-width), 1),
                       "high": round(min(1200, cutoff+width), 1), "crosses_policy": regime(day) != model["regime"]})
        previous = {**target, "cutoff": cutoff}
    if any(p["crosses_policy"] for p in points):
        warnings.append("This scenario crosses an announced policy break. Values after the break are a frozen-rules illustration only, not a forecast under the new rules.")
    if not model["validation_passed"]:
        warnings.append("The model has not passed the release gate for calibrated forecasts. No invitation probabilities are published.")
    if not model["draw_size_range"][0] <= request.draw_size <= model["draw_size_range"][1] or not model["interval_range"][0] <= request.interval_days <= model["interval_range"][1]:
        warnings.append("These assumptions extend beyond the model's observed training range.")
    return {"model_version": MODEL_VERSION, "data_version": bundle["source"]["sha256"], "data_as_of": last["date"],
            "scenario": request.model_dump(mode="json"), "points": points, "warnings": warnings,
            "kind": "sensitivity", "probability": None, "origin": "latest_observed_cec_draw"}

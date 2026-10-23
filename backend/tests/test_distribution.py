import copy
import json

import numpy as np
import pytest

from app.data import BUNDLED_DATA
from app.distribution import build_distribution, score_summary


@pytest.fixture(scope="module")
def pools():
    return json.loads((BUNDLED_DATA / "snapshot.json").read_text())["pool_snapshots"]


def test_every_historical_reconstruction_preserves_observed_mass_and_rank_bounds(pools):
    for pool in pools:
        model = build_distribution(pool)
        rows = model["scores"]
        assert len(rows) == 1201
        for method in ("uniform", "smooth"):
            counts = np.array([r[f"{method}_count"] for r in rows])
            above = np.array([r[f"{method}_above"] for r in rows])
            assert np.isfinite(counts).all() and np.all(counts >= 0)
            assert counts.sum() == pytest.approx(pool["total"], abs=1e-7)
            assert np.all(np.diff(above) <= 1e-7)
            assert above[-1] == 0
            assert above[0] + counts[0] == pytest.approx(pool["total"], abs=1e-7)
            np.testing.assert_allclose(above[:-1] - above[1:], counts[1:], atol=1e-7)
            for b in pool["bands"]:
                assert counts[b["min"]:b["max"] + 1].sum() == pytest.approx(b["count"], abs=1e-7)
                assert rows[b["max"]]["lower_above"] == rows[b["max"]]["upper_above"]
            assert all(r["lower_above"] <= r[f"{method}_above"] <= r["upper_above"] for r in rows)


def test_known_boundary_and_unknown_within_band_are_distinguished(pools):
    model = build_distribution(pools[-1])
    at_500 = score_summary(model, 500)
    assert at_500["strictly_higher"] == {
        "band_only_bounds": [22387, 22387], "uniform_estimate": 22387, "smooth_estimate": 22387}
    at_510 = score_summary(model, 510)
    assert at_510["strictly_higher"]["band_only_bounds"] == [749, 22387]
    assert at_510["strictly_higher"]["uniform_estimate"] == 20223
    assert at_510["cec_estimate"] is None and at_510["ties_ahead"] is None


def test_single_score_and_empty_bands_do_not_create_candidates():
    pool = {"date": "2026-10-12", "total": 10, "bands": [
        {"min": 0, "max": 499, "count": 0},
        {"min": 500, "max": 500, "count": 10},
        {"min": 501, "max": 1200, "count": 0}]}
    rows = build_distribution(pool)["scores"]
    assert rows[499]["smooth_above"] == rows[499]["lower_above"] == rows[499]["upper_above"] == 10
    assert rows[500]["smooth_count"] == 10
    assert rows[500]["smooth_above"] == 0
    assert sum(r["smooth_count"] for r in rows if r["score"] != 500) == 0


@pytest.mark.parametrize("change", ["total", "gap", "overlap", "negative", "fractional", "empty"])
def test_bad_histograms_fail_instead_of_being_fitted(pools, change):
    pool = copy.deepcopy(pools[-1])
    if change == "total":
        pool["total"] += 1
    elif change == "gap":
        pool["bands"][0]["min"] += 1
    elif change == "overlap":
        pool["bands"][0]["min"] -= 1
    elif change == "negative":
        pool["bands"][0]["count"] = -1
    elif change == "fractional":
        pool["bands"][0]["count"] = 1.5
    else:
        pool["bands"] = []
    with pytest.raises(ValueError):
        build_distribution(pool)


@pytest.mark.parametrize("score", [-1, 1201, 510.5, True])
def test_invalid_score_is_rejected(pools, score):
    with pytest.raises(ValueError):
        score_summary(build_distribution(pools[-1]), score)

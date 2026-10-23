# Model and validation — version 1.0.0

## What is identified

The official history identifies each round’s program/category, invitation count, cutoff, and (where present) tie-break timestamp. General-pool observations identify counts in disjoint score bands at a particular observation date.

For a round inviting `k` candidates at cutoff `c`, if all eligible candidates above the cutoff are selected and ties at `c` are resolved by the stated rule, then:

```text
N_eligible(score > c) < k <= N_eligible(score >= c)
```

This is a round-specific ordering constraint, conditional on those selection assumptions and the Ministerial Instructions. It does not identify exact counts at `c`, who is eligible for another category, or the distribution before/after any other round. A full-pool snapshot is an upper bound on a category subset **at that same observation time**; a days-old pool is not a strict contemporaneous bound. We do not perform invalid feasibility checks by treating it as one.

Category overlap, eligible entrants, exits, score transitions, and tie-break composition are not separately identified by aggregate public data. Invitations for overlapping categories are never all subtracted from a single latent CEC population.

## Baselines implemented

For each modeled period, sort CEC draws chronologically. Use six same-period draws as warmup; at every later draw refit on strictly earlier draw dates. Evaluate against the actual next draw’s size and elapsed days, making this a conditional evaluation rather than a forecast of IRCC’s schedule.

1. **Last cutoff:** use the immediately previous CEC cutoff.
2. **Rolling median:** use the median of the last three CEC cutoffs.
3. **Conditional ridge:** fit the change in cutoff to an intercept, log ratio of current to prior invitations, `(days_since_previous - 14) / 14`, and `(previous_cutoff - 520) / 20`.

Ridge is solved as bounded regularized least squares. Fixed penalty diagonal `[0.3, 2, 2, 2]`; invitation-size coefficient ≤ 0, elapsed-time coefficient ≥ 0. These are monotonicity assumptions, not causal conclusions. No hyperparameters are selected against held-out draws. Predictions are bounded to CRS 0–1200.

The March 25, 2025 scoring change and February 18, 2026 category announcement start separate windows. Earlier history is descriptive only because other historic breaks have not been completely versioned. No training crosses the November 3, 2026 scoring boundary.

Pool features are intentionally absent because archived publication-time availability is unknown. We also do not estimate other-category depletion or individual score transitions. The dataset therefore does not support meaningful ablations of a latent-pool model; those are deferred instead of fabricated.

## Actual rolling results on the pinned fixture

| Period               | Method            | Test draws | MAE   | Median error |
| -------------------- | ----------------- | ---------- | ----- | ------------ |
| 2025 scoring period  | Last cutoff       | 9          | 2.889 | 2.000        |
| 2025 scoring period  | 3-draw median     | 9          | 5.667 | 3.000        |
| 2025 scoring period  | Conditional ridge | 9          | 1.798 | 1.635        |
| 2026 category period | Last cutoff       | 9          | 1.889 | 1.000        |
| 2026 category period | 3-draw median     | 9          | 2.222 | 1.000        |
| 2026 category period | Conditional ridge | 9          | 2.358 | 2.170        |

Full predictions, training endpoints, median errors and all interval metrics are committed in `backend/data/snapshot.json` and exposed in the UI / `/api/backtests`. The regression improves the earlier period but **loses to the last-cutoff baseline in the current period**.

For nominal 50%, 80%, and 95% intervals, use the corresponding higher empirical quantile of _earlier_ absolute out-of-sample residuals in the same period. Require five prior residuals. This leaves only four interval-evaluation targets per period. In the current period, the regression’s nominal 80% interval covers 4/4 targets with mean width 9.36 CRS. In the prior period it covers 3/4 with mean width 5.67 CRS. These tiny sample proportions are not evidence of calibrated coverage.

At least 20 same-period test targets and regression MAE no worse than both baselines are a necessary release gate. That gate is not passed. Further calibration checks, prospective evidence and stability analysis would still be needed even if those minimum conditions pass.

## Released scenario tool

The frontend uses the same fitted coefficients and formulas as the backend. Five golden cases cover sizes, intervals, assumptions, horizon limits and CRS endpoints; Python and TypeScript must produce identical displayed points. No random sampling is performed, so the same dataset and inputs reproduce the same output without a seed.

Each hypothetical step applies the conditional regression recursively. The input assumption adds `−0.5`, `0`, or `+0.5` times the current period’s 80th-percentile absolute residual scale. The envelope expands by `residual_scale × sqrt(step)` around the path, clipped to 0–1200. This is explicitly an **illustrative sensitivity envelope**, not a calibrated confidence interval. The input CRS is only a chart reference line and never changes the model fit or path.

The origin is the latest observed CEC draw, not today. Displayed dates are that origin plus the assumed interval. If someone chooses an interval that places a step in the past, that remains an illustration from the observed origin; the UI never calls it a scheduled future draw.

The UI warns when the selected size/interval falls outside the training range. It flags the announced November 3 boundary in the chart, explanation, and numerical table. Values after the boundary freeze earlier rules; they do not predict the effect of new CRS rules or override the announced draw pause. No threshold-crossing frequencies, individual eligibility estimates or PR probabilities are produced.

## Deferred work and release discipline

A latent CEC score-bin simulator could be useful for stress tests, but a uniquely estimated hidden pool cannot be recovered here. A misleadingly precise simulator would add complexity without identification. It is deliberately deferred pending stronger evidence and a model that beats simpler baselines.

Before any calibrated release: collect timestamped snapshots prospectively; version policy announcements as-known at each origin; gather enough post-change CEC draws; evaluate interval coverage across many targets; inspect catastrophic misses and draw gaps; validate separate categories independently. Keep all losing baselines and failure cases in the report.

Exported floating-point values are rounded to eight decimal places to remove insignificant platform-specific BLAS noise. Linux and macOS exports were compared byte-for-byte.

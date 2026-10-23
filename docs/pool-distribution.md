# Modeling the published score distribution

Implemented October 21, 2026 as `pool-distribution-1.0.0` in [distribution.py](../backend/app/distribution.py). This is a reconstruction of the **full pool at an observation date**. It does not estimate CEC eligibility, arrivals, future draws or individual invitation order. The website’s Candidate pool page now exposes both reconstructions, an adjustable CRS score, snapshot selection, and band-only bounds. The separate scenario lab uses the existing regression.

## What is observed, and what needs an assumption?

The October 12, 2026 snapshot contains 229,456 candidates in 15 disjoint score bands. For each band `[a, b]`, its count `n` is observed. Counts at individual integer scores inside it are unknown.

A distribution assigns nonnegative counts `m[s]` to scores 0–1200, subject to:

```text
sum(m[s] for s in a..b) = observed count in band [a, b]
```

That constraint is stronger than simply fitting a normal curve to the overall pool. Every published band total must remain correct. Many different score distributions satisfy these constraints, so a smooth curve is one possible reconstruction, not newly observed detail.

Source: [IRCC rounds JSON](https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json), retrieved October 21, 2026 at 06:15:58 UTC. Full provenance is included in the [generated analysis](analysis/pool-distribution.json).

## Two implemented reconstructions

**Uniform within each band:** assign each integer score `n / (b − a + 1)` candidates. For the 21,638 people in 501–600, this gives 216.38 at each of the 100 scores. Fractional counts represent modeled allocations, not fractional people in the observed data. No individual-score locations are favored within a band.

**Smooth cumulative interpolation:** place cumulative-count anchors at band edges. Represent an integer score `s` by the cell `[s − 0.5, s + 0.5]`. The cumulative curve starts at zero at −0.5 and ends at the total at 1200.5. At every published upper band edge `b + 0.5`, its value equals the observed count at or below `b`.

Interpolate those anchors using [SciPy's monotone PCHIP](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.PchipInterpolator.html), then take differences across each integer cell:

```text
m[s] = cumulative(s + 0.5) − cumulative(s − 0.5)
```

Monotonicity keeps counts nonnegative, and interpolation through the anchors preserves band totals. We correct floating-point drift within each band. This adds a smoothness assumption; it has not been shown to recover the true individual-score distribution better than the uniform reconstruction. Real CRS scores can cluster at particular integers. Policy-related discontinuities also need not be smooth.

We do not fit a normal distribution, identify a unique curve, or infer a CEC share from the full pool.

## Converting a distribution to people above a score

For score `s`, sum the modeled counts strictly above it:

```text
modeled people above s = sum(m[x] for x > s)
```

We also report bounds that need no within-band shape assumption:

- Lower bound: everyone in bands entirely above `s`.
- Upper bound: that lower bound plus everyone in the band containing `s`, when the band includes a score above `s`.
- At a band's maximum score, these bounds coincide: the strictly-higher count is directly observed.

These are sharp bounds given only the band totals. Each endpoint is possible under some allocation within the band. They are **not** confidence intervals; the distance between the two modeled curves is not a confidence interval either. Counts exclude ties, so they do not establish a person's exact rank even in the full pool.

Actual calculations from the pinned snapshot:

| Score | Band-only bounds above score | Uniform estimate | Smooth estimate |
| ----- | ---------------------------- | ---------------: | --------------: |
| 495   | 22,387–34,523                |           28,455 |          27,502 |
| 500   | 22,387 exactly               |           22,387 |          22,387 |
| 510   | 749–22,387                   |           20,223 |          18,110 |
| 519   | 749–22,387                   |           18,276 |          14,696 |
| 550   | 749–22,387                   |           11,568 |           5,939 |
| 600   | 749 exactly                  |              749 |             749 |

The wide 501–600 band produces large uncertainty in counts above scores inside it. All estimates refer to the October 12 snapshot, not the current live pool. Public pool counts include candidates who may be ineligible for a selected round. [IRCC's pool and selection definitions](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html)

## Run it

From `backend/`, after installing the existing project dependencies:

```sh
uv run python -m app.distribution --score 510

# Select an older observed snapshot.
uv run python -m app.distribution --snapshot 2026-09-27 --score 500

# Export every integer score, both models, bounds and source provenance.
uv run python -m app.distribution --score 510 \
  --output ../docs/analysis/pool-distribution.json
```

The default input is the repository's pinned `backend/data/snapshot.json`; `--input /path/to/snapshot.json` selects a different normalized bundle. No live download happens in this command. After `make refresh`, rerun the export to update this separate analysis artifact. The numerical examples in this document remain dated to the original snapshot.

## Verification and next use

Tests reconstruct **all 126 validated historical snapshots** and verify nonnegative counts, preservation of every band total, a decreasing strictly-higher count as CRS increases, and containment within the band-only bounds. Additional cases cover exact boundary counts, zero-count bands, a single-score band, invalid inputs and lack of a claimed CEC estimate. These checks establish consistency with the published aggregates, not accuracy of the assumed internal shapes.

This supplies a defensible starting distribution for whole-pool exploration. A CEC queue model would additionally require uncertain category membership, time evolution, other-category overlap and constraints from historical CEC draws. That remains a separate modeling step.

## Browser implementation

`frontend/src/poolMath.ts` implements the same monotone PCHIP cumulative interpolation locally. The page recomputes from whichever validated pool snapshot is selected, including newly ingested snapshots; it does not depend on the dated analysis export. Tests compare all 1,201 scores against the independent SciPy reference and verify band mass and bounds across the complete historical fixture. The test fixture in `frontend/src/data/pool-reference.json` is a copy of the dated Python export, not a runtime data source.

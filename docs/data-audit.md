# IRCC data audit

Audit date: **October 21, 2026**. Parser: `ircc-1.0.0`. This audit describes the committed fixture; refreshes may add rows and new categories.

## Primary evidence

- Rounds JSON: <https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json>
- Rounds and pool-band definitions: <https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html>
- Category selection/eligibility context: <https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html>
- Retrieval: `2026-10-21T06:15:58.061481+00:00`.
- SHA-256: `f76c33e74b8e1a4ce5f23e9dd2680dfb0eef0392ba3d353145f221a4133e8ef8`.
- Exact response: `backend/data/raw/<sha256>.json`; manifest retains URL, timestamp, status, method and parser version.

The endpoint returned HTTP 200. This is a currently observed schema, not an IRCC API guarantee.

## Available schema

All 451 rows have the same keys: `drawNumber`, `drawNumberURL`, `drawDate`, `drawDateFull`, `drawName`, `drawSize`, `drawCRS`, `mitext`, `DrawText1`, `drawText2`, `drawDateTime`, `drawCutOff`, `drawDistributionAsOn`, `dd1`–`dd18`. Presence does not imply an actual measurement.

| Field                  | Interpretation                     | Handling                                         |
| ---------------------- | ---------------------------------- | ------------------------------------------------ |
| `drawNumber`           | Round identifier                   | String; preserve `91a` and `91b`                 |
| `drawDate`             | ISO date                           | Required, validated                              |
| `drawName`             | Category/program with version text | Raw string preserved; explicit versioned mapping |
| `drawSize`             | Comma-formatted invitation count   | Required positive integer                        |
| `drawCRS`              | Lowest invited CRS                 | Integer in 0–1200                                |
| `drawCutOff`           | Tie-break timestamp                | Raw string or null; 76 empty records             |
| `drawDateTime`         | Round timestamp                    | Retained raw; timezone formatting varies         |
| `drawDistributionAsOn` | Pool observation date              | Not a publication timestamp                      |
| `dd1`–`dd18`           | Counts and nested subtotals        | Validated, converted to disjoint bands           |

`dd1` = 601–1200, `dd2` = 501–600, `dd3` = 451–500 subtotal, `dd4`–`dd8` = 10-point subdivisions of 451–500; `dd9` = 401–450 subtotal, `dd10`–`dd14` = its subdivisions; `dd15` = 351–400, `dd16` = 301–350, `dd17` = 0–300, `dd18` = total. Subtotals are **never** counted a second time. All integers 0–1200 belong to exactly one normalized band.

## Coverage and anomalies

- **451 draws**, January 31, 2015 – October 16, 2026.
- **71 CEC draws**, 115 PNP draws, 37 French-language draws; other categories remain visible as contextual history.
- **218 all-zero pool records** are placeholders, treated as missing observations. They occur throughout early history, including some 2022 records. They are not evidence of an empty pool.
- 233 records have nonzero pool data, representing 127 distinct observation dates before integrity checks.
- **Draw #247** has inconsistent pool subtotals. Its pool observation is quarantined, while the draw itself remains in the archive. The unmodified source is retained.
- **126 validated unique pool snapshots** remain. Multiple rounds often refer to the same snapshot; they are deduplicated by date only if all band counts agree. A conflicting same-date snapshot fails ingestion.
- Latest valid pool snapshot: October 12, 2026, **229,456** candidates. PNP, CEC and French-language rounds share this observation. Invitations are not subtracted from it as though categories were disjoint.
- Latest CEC draw: October 15, 2026, **519 CRS**, **2,500 invitations**; 16 days after the previous CEC draw.
- Latest overall draw: October 16, 2026, French-language proficiency, **435 CRS**, **5,000 invitations**.
- Invitations in 2026 through October 16 sum to **143,467**, across all round types. This is not a count of PR approvals or a count of unique people.

## Publication lag and revisions

IRCC describes the pool distribution as a few days before a round. The JSON includes observation and round dates but **no per-record publication timestamp, revision history, or archived point-in-time versions**. Therefore historical publication latency cannot be measured from this endpoint. Retrieval age is measured exactly for this fetch; draw recency is shown separately.

The baseline evaluation uses prior draw records with strictly earlier dates. It is retrospective on today’s historical file and cannot prove absence of revision leakage. Pool counts are excluded from predictors, including same-day snapshots, because their availability before a prediction origin is unknown. Do not relabel the evaluation “publication-time leak-free.”

## Source changes and failure behavior

Required draw-field removal, invalid numeric values, duplicate identifiers, conflicting snapshots, and invalid dates fail normalization. Optional missing pool data remains missing. Unknown category names remain `OTHER` with the full raw category and an audit warning, rather than being assigned silently.

Each HTTP body is archived by hash before normalization. The normalized JSON is replaced atomically only after validation and model evaluation succeed. On fetch/parse failure, the API retains its prior valid bundle, logs the exception, and records a failed refresh state. Frontend requests have an eight-second timeout and schema validation; the initial bundled snapshot remains usable if the API fails. Retrieval age beyond 3 hours is shown as stale.

A documented manual import accepts the official JSON format and a timezone-aware retrieval timestamp. Unsupported CSV schemas require an explicit adapter; they are not silently inferred. No third-party replacement feed is used.

## Verified policy events

1. **March 25, 2025:** arranged-employment CRS points removed. [Ministerial amendment](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/amendment-2025-1.html).
2. **February 18, 2026:** 2026 categories announced. [Official release](https://www.canada.ca/en/immigration-refugees-citizenship/news/2026/02/canada-prioritizes-top-talent-in-2026-immigration-express-entry-categories.html). This is a context/evaluation break, not a claim that the CRS scoring formula changed on that date.
3. **November 3, 2026 (announced, future at audit):** Labour Market Integration factor and job-offer/work-experience scoring changes. IRCC also describes a temporary draw pause while profiles are recalculated. [Official changes page](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html).

The app encodes these dates as boundaries and context. It does not calculate individual CRS eligibility or guess the new pool distribution. New post-November-3 training must stand on its own observations. Policy metadata is reviewed manually; hourly ingestion does not automatically reinterpret policy pages.

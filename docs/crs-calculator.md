# CRS calculator

Verified October 21, 2026 against the [IRCC CRS points grid](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html), [official questionnaire](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html), and [language equivalencies](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html).

## Calculation

`frontend/src/crs.ts` is a pure scoring module. It adds core factors, accompanying-spouse factors, skill transferability (maximum 100), and additional points (maximum 600). Each education/experience transferability pair is capped at 50 before the overall 100 cap. First/second official language arrangements are evaluated separately; the higher total is used and disclosed. An applicant with an accompanying spouse has a 22-point second-language cap; the spouse's own language factors use one test only.

All four abilities must meet a threshold for combination points. Test score ranges convert separately for speaking, listening, reading and writing. Supported formats are CELPIP General, IELTS General Training, PTE Core, TEF Canada previous-score equivalency, TCF Canada, and direct CLB/NCLC entry. This is a CRS calculation, not the separate 67-point Federal Skilled Worker eligibility grid. It does not assess admissibility, documentary validity, category eligibility, work-experience exceptions, or IRCC approval.

The wizard requires the relevant core inputs and conditionally asks about an accompanying partner. No names, birthdays, document numbers, credentials, or test-report uploads are needed. Answers and scores stay in React memory; they are not transmitted, put in URLs, persisted to browser storage, or retained after reload. Selecting “Use this score” shares only the resulting number with the local scenario and pool views.

## Known rule change

The implemented rule set is valid from March 25, 2025 up to (but not including) November 3, 2026. IRCC has [announced a new Labour Market Integration factor](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html). Its published changes and current grid are not a complete, reconciled replacement specification: the existing grid retains old core maxima while the announcement adds new components. This implementation deliberately does not infer missing overall caps or claim parity with an unverified future calculator.

At the boundary, the local calculation is gated and the UI links to the official calculator. Manual CRS entry remains available. Add a separately versioned scoring implementation and independent fixtures before extending `crsRulesSupported`; do not merely extend the expiry date. The hourly draw JSON is a data feed, not a source of executable scoring rules. This is an explicit remaining limitation.

The large announcement banner appears only from 45 days before to 30 days after the effective date. Its disappearance does not enable an outdated model or scoring engine. The scenario model independently requires its training regime to match today's known regime and enough observations for a model and residual scale.

## Checks

Hand-worked examples: single applicant, age 29, bachelor's, CLB 9 in English, one Canadian year and three foreign years = 394 core + 88 transferability = **482**. With an accompanying partner who has a bachelor's, CLB 9 and one Canadian year: 363 applicant + 33 spouse + 88 transferability = **484**. Maximum-factor cases exercise the 1,200 total, 600 additional cap, 100 transfer cap and 22-point spouse second-language cap. Boundary cases cover ages, every-language-skill thresholds, French bonuses, incomplete answers and the rule expiry.

The footer carries the requested as-is / entertainment / non-reliance / limitation-of-liability text. It is product copy, not a legal opinion or assurance that every exclusion is enforceable.

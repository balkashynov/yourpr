# Verification record

Verified October 21, 2026 against the pinned IRCC fixture. The latest follow-up record below supersedes earlier UI labels and refresh intervals.

## Automated checks

- **18 backend tests passed:** fixture hash/coverage, unique alphanumeric round IDs, disjoint bands, zero placeholders, missing pool observations, strict schema changes, unknown category preservation, category overlap, verbatim tie-breaks, scoring boundaries, idempotent SQLite/raw ingestion, publication failure retention, future-data perturbation, sparse history, deterministic scenario envelopes, monotonic first-step draw-size response, assumption ordering, API validation/CORS, Python/TypeScript reference parity, and a failed network refresh preserving last-good data.
- **6 frontend tests passed:** all five Python reference scenarios match; pool aggregation does not double-count subtotals; policy boundaries and range ordering; CSV quoting and source links; invalid API schema/CRS rejection; insufficient-history handling.
- TypeScript strict check and Vite production build passed. App, chart, React, vendor and official-snapshot chunks are separated. Fonts are self-hosted Latin subsets.
- `npm audit` reported **zero known vulnerabilities** after updating the test runner. This is the registry's result at verification time, not a permanent security guarantee.
- Both Docker images built successfully with locked dependencies. Compose config validation passed; both services started and the backend became healthy.
- The final Linux container reproduced `snapshot.json` byte-for-byte against the macOS-generated committed fixture. Insignificant numerical platform noise is rounded to eight decimal places in exports.
- A real IRCC refresh inside the production container succeeded at `2026-10-21T14:37:53.615790+00:00`, returning the same SHA-256 as the pinned evidence. The check used a temporary container directory and did not silently replace the committed retrieval timestamp.

## Browser checks

Checked in the in-app browser on desktop and phone layouts:

- Overview renders official values, latest overall draw and CEC statistics; chart filters and source links are exposed correctly.
- Mobile navigation opens, focuses the drawer, closes on navigation, and returns to the selected page. The underlying app is inert while the drawer is open; the closed mobile sidebar is hidden from assistive technology.
- Scenario score, invitation-count control, and assumption buttons update the chart and numerical table. A large draw shows the extrapolation warning; dates crossing November 3 show the frozen-rules warning.
- Pool score 500 correctly maps to 491–500, with 12,136 candidates in that band and 22,387 in higher bands. No exact individual rank is inferred.
- Draw archive search `2026-10` plus CEC filter returns draw #449. Expanded details show its official tie-break timestamp and Ministerial Instructions link.
- Both backtest windows display their actual computed errors. The JSON validation export downloaded successfully.
- After stopping the API and retrying without browser cache, the app retained its valid dataset and displayed **API unavailable**. Restarting the API restored **API snapshot**.
- The production Docker frontend successfully loaded and connected to the production Docker backend. It uses the same UI and pinned evidence, without the Vite development server.
- Phone layouts were inspected at 390 px and narrow-phone layouts at 320 px; desktop at 1440 px. Table content scrolls within its own container rather than widening the page.

Screenshots are in `docs/screenshots/`.

### Follow-up mobile audit — October 21, 2026

All five pages were rechecked at 320, 390, 430, and 768 px browser viewports. The browser reserves 15 px for a scrollbar; document scroll width matched the available client width in every case. This audit found and fixed a page overflow bug caused by an absolutely positioned accessible table label escaping its scroll container.

Additional improvements include 44 px targets for primary controls and table links, 16 px input/select text, wrapping chart controls, a sticky phone header, and a simplified breadcrumb on the narrowest phones. These control sizes also apply to tablets and devices reporting a coarse pointer. Wide tables remain independently scrollable.

Verified chart metric/range changes, archive search and category filtering, expanded draw details, pool score-band selection, scenario input/slider changes, menu navigation, Escape dismissal, and closing the open drawer when rotating into the desktop layout. The drawer no longer leaves the main content inert or body scrolling locked after that resize. No browser errors were recorded. All six frontend tests and the TypeScript/Vite production build passed again.

The updated phone chart is captured in `docs/screenshots/mobile-audit.png`. These are responsive browser checks, not physical iPhone/Android tests; native touch gestures, the on-screen keyboard, Safari behavior, and mobile network performance remain unverified.

### Calculator, refresh and interface follow-up — October 21, 2026

- **21 frontend tests and 35 backend tests passed.** The TypeScript check and Vite production build also passed. New cases cover CRS factor caps and thresholds, accompanying partners, language conversion ranges, scoring-rule expiry, recent-draw defaults, future scenario dates, announcement expiry, new-year draw ingestion, hourly refresh and automatic recovery after failed updates.
- A synthetic profile was entered into the live official IRCC calculator and the local wizard: single, age 29, bachelor's degree, IELTS speaking 7 / listening 8 / reading 7–7.5 / writing 7, one Canadian work year, three or more foreign years, and no additional factors. Both returned **482**, with **394 core** and **88 transferability** points. This is one end-to-end parity example, not exhaustive certification against every possible official-calculator input.
- The backend started with refresh enabled and completed a successful live IRCC check, returning 451 draws and SHA-256 `f76c33e74b8e1a4ce5f23e9dd2680dfb0eef0392ba3d353145f221a4133e8ef8`. Its next refresh is scheduled after 3,600 seconds. The frontend automatically polls the API every five minutes while visible and resumes on return; no Retry API button remains. The saved snapshot remains available during failures.
- All **six pages** were checked again at **320, 390, 430 and 768 px**. Document scroll width matched the viewport at every size. Visible numeric inputs and selects used 16 px text. The complete wizard and its result were inspected at 390 px; using the 482 result populated both scenario and pool inputs. No browser errors were recorded during the final pass.
- The current six-draw CEC sample produces a median of **2,000 invitations** and **14 days**. The scenario form displays those draws and offers smaller/median/larger presets. Illustrative dates advance relative to today and are not presented as an IRCC schedule.
- The footer shows the requested entertainment-only/non-reliance notice, expanded as-is/liability/privacy text, and `https://balk.sh/?ref=yourpr`. A GitHub link appears only when a real repository URL is supplied through `VITE_REPOSITORY_URL`; this checkout has no remote yet.
- Scoring announcements retire 30 days after their effective date. A separate rule guard disables the current CRS engine from November 3, 2026 pending a verified replacement. Manual entry continues to work. A model trained under an older known scoring regime is also gated; hiding the announcement never re-enables it.

The calculator result is captured in `docs/screenshots/crs-calculator-mobile.png`. Browser emulation does not replace physical-device testing. The earlier Docker verification predates these calculator additions; the latest frontend build and backend test suite were run locally.

## Remaining limits

The earlier local-only limitations are superseded by the October 23 production record below.

The backend test run emits a Starlette deprecation notice about its `httpx` TestClient adapter. It does not fail tests or affect the API's own HTTP client; revisit the adapter when upgrading that dependency stack.

This is not a calibrated immigration forecaster. Only nine current-period test draws and four interval-evaluation targets are available; the regression loses to the last-cutoff baseline. Policy metadata is manually maintained. Publication-time historical versions, uniquely identified latent CEC populations, category-specific calibrated forecasts, and prospective interval calibration remain unavailable.

The production container check was shut down after verification; start it again with `docker compose up --build` or use the two `make` development commands in the README.

## YourPR release — October 23, 2026

The interface stylesheet was replaced with a mobile-first layout: a five-item bottom navigation bar, accessible all-pages sheet, stacked panels, draw cards and scenario cards on phones, 48-pixel form controls, safe-area padding, reduced-motion support and desktop columns. Branding, metadata, favicon, downloads, package names, API title and the personal-site referrer now use YourPR.

The Candidate pool page now includes a live reconstruction from the selected validated snapshot. Smooth and uniform methods preserve every observed band total; results show sharp band-only bounds separately from estimates and do not claim CEC eligibility or invitation rank.

Verification:

- 24 frontend tests, 35 backend tests and the TypeScript/Vite build passed. Distribution tests compare all 1,201 scores with independent SciPy results and check mass/bounds across all historical snapshots. Offline data reproduction also passed.
- All six pages were checked at 320, 390, 430, 768, 1024 and 1440 pixels. No page-level horizontal overflow was found. Desktop visual inspection caught and corrected a sidebar flex-direction issue that width checks alone did not detect.
- Keyboard checks verified focus trapping in the mobile navigation, Escape dismissal, focus restoration to More, and removal of the inert state. Controls use visible focus outlines; charts have text summaries and data alternatives. This is not a formal WCAG certification or physical-device screen-reader test.
- On the deployed site, the complete calculator flow returned 482 for the independently checked example and transferred that value to scenarios. Empty input showed meaningful errors.
- The live distribution returned exactly 22,387 above CRS 500; at 510, uniform returned 20,223 and smooth returned 18,110, inside 749–22,387 observed-band bounds. Selecting the September 27 snapshot changed the model output.
- Mobile archive search for October 2026 with CEC selected showed draw 449, cutoff 519, 2,500 invitations, expandable tie-break details and the official link.
- The public frontend returned HTTP 200 and loaded live data. The separate Railway API returned HTTP 200, allowed the exact frontend origin, and reported a successful refresh with `stale: false`. Its persistent `/data` volume is attached.

Screenshots for this release use the `yourpr-` prefix. Earlier screenshots are retained as historical records. See [deployment and operations](deployment.md) for the live URLs.

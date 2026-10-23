# Deployment and operations

The two folders deploy independently. The frontend is a static Vite build; Railway serves a small Python API. There is no Next.js server, shared runtime import, authentication provider, or external database requirement.

## Railway backend

1. Connect the repository to a Railway service and set its **Root Directory** to `/backend`.
2. Use the included Dockerfile with the Dockerfile builder. Configure the service health check at `/health` (60-second timeout), restart on failure (five retries), and one replica. These are service settings; no deprecated Railway TOML configuration is required.
3. Add a persistent volume at `/data`. Set `DATA_DIR=/data`.
4. Set `CORS_ORIGINS` to your exact Vercel production origin, for example `https://your-project.vercel.app`. Multiple allowed origins are comma-separated. Preview domains must be added explicitly; do not use a wildcard with private data later.
5. Set `REFRESH_ENABLED=true` and `REFRESH_INTERVAL_SECONDS=3600`. Keep one service replica and one Uvicorn worker so exactly one worker refreshes the files.
6. Generate a public HTTPS domain. Railway injects `PORT`; the Docker command honors it. `/health` is the readiness path.
7. Inspect `/api/data/status`. `stale: false` confirms a recently retrieved source, not the occurrence of a recent draw. `last_refresh.ok: false` indicates refresh failure even if the service remains healthy.

The baked-in fixture is a fallback on the first boot. The worker fetches official data in the background at startup, retries HTTP failures up to three times with backoff, then refreshes hourly. On failure it preserves the prior snapshot and reports the failure. No remote refresh/mutation endpoint is exposed. Console logs contain source and failure information, not user CRS request bodies.

A volume preserves raw source archives and the latest normalized bundle across deployments. Without one, the app still starts from the bundled fixture, but runtime state disappears with the container. The snapshot JSON is the serving artifact; SQLite is a reproducible analyst-friendly normalized representation, not a concurrently shared application database.

For multiple replicas, disable the in-process refresher and move ingestion into a single scheduled job with shared object storage/database; that is outside this starter’s operational model. Avoid running a manual refresh concurrently with the enabled internal refresher on the same directory.

## Vercel frontend

1. Import the repository and choose **Root Directory: `frontend`**, framework **Vite**.
2. Install: `npm ci`. Build: `npm run build`. Output: `dist`.
3. Set `VITE_API_URL` to the Railway public HTTPS origin, without a trailing `/api`.
4. Deploy. Changing a `VITE_` variable requires a new frontend build.
5. Confirm `/api/data/status` reports `refresh_enabled: true` and a recent successful refresh. The footer shows the IRCC check date and warns if saved data is being used. Check the API URL and exact CORS origin if updates are unavailable.
6. Set `VITE_REPOSITORY_URL` to the actual GitHub repository URL to show the footer link. It stays hidden while unset; no placeholder repository is published.

The app’s six views use hash routes (`#draws`, `#pool`, etc.), so no catch-all rewrite is necessary and direct share/reload works. Fonts are self-hosted. Security response headers are in `frontend/vercel.json`. No build-time network fetch of IRCC is required.

Leave `VITE_API_URL` empty for a standalone static deployment. The bundled official dataset and all interactions work, but the source does not auto-refresh. Run `make refresh`, commit the raw and generated dataset, and redeploy to update a static-only site. With Railway enabled, the backend retrieves IRCC data hourly (and at startup). The visible frontend checks the API every five minutes and when returning to an old tab. No manual retry button is needed. Failed requests preserve the last valid bundle. The display clock advances every minute, so stale-data warnings and policy transitions do not require a reload.

## Expected failure modes

| Condition                                           | Result                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Railway unavailable / timeout / incompatible schema | Keep browser’s last valid bundle (initially the committed fallback); show API failure |
| Official feed unavailable                           | API retains its last valid data; records and logs failed refresh                      |
| Malformed draw schema                               | Archive response, reject publication, preserve prior snapshot                         |
| Missing / zero-placeholder pool                     | Keep the draw, mark pool missing                                                      |
| Inconsistent pool totals                            | Quarantine that pool snapshot and report it                                           |
| Unknown category                                    | Preserve its exact text, classify as OTHER with audit warning                         |
| Retrieval older than 3 hours                       | Show stale-data warning, including on static frontend                                 |
| Too few same-regime CEC observations                | No scenario model; descriptive archive remains                                        |
| Announced scoring break                             | Separate training periods; label frozen-rules scenarios                               |

Policy metadata is maintained manually. Review IRCC announcements before treating the set of policy dates as complete. Data freshness is not a policy-review guarantee.

## Checks before going public

Run `make verify`, confirm `/health`, validate CORS from the deployed frontend, and inspect the source timestamp and warnings. Test with the API disconnected to verify the fallback. Keep the official-data attribution and uncertainty text visible. The repository includes CI but does not create a hosted monitoring service or configure account billing.

Deployment references checked October 21, 2026: [Railway monorepos](https://docs.railway.com/deployments/monorepo), [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## YourPR production deployment — October 23, 2026

- Website: https://yourpr.vercel.app
- API: https://yourpr-api-production.up.railway.app
- Repository: https://github.com/balkashynov/yourpr
- Dedicated provider projects: `yourpr` on Vercel and Railway; Railway service `yourpr-api`. No pre-existing projects were modified.
- Railway has a persistent volume mounted at `/data`, startup/hourly refresh enabled, one replica, and port 8000. CORS allows the exact production site and local development origins.
- Vercel uses the basic build machine. Public `VITE_API_URL` and `VITE_REPOSITORY_URL` settings point to the API and repository above.
- Both public HTTPS origins returned 200 without login. The API allowed the deployed origin and reported a successful live IRCC refresh with `stale: false`.

No custom domain has been connected. Adding `yourpr.ca` later requires configuring its DNS/provider domain and adding its exact HTTPS origin to Railway CORS. Scoring rules still require explicit human verification when they change; the draw feed cannot update calculator legislation.

import asyncio
import contextlib
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .data import data_dir, load_bundle
from .model import Scenario, scenario
from .pipeline import refresh

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


async def refresh_loop():
    while True:
        try:
            await asyncio.to_thread(refresh)
        except Exception:
            pass  # pipeline logs and persists failure; last-known-good stays available
        await asyncio.sleep(max(300, int(os.getenv("REFRESH_INTERVAL_SECONDS", "3600"))))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(refresh_loop()) if os.getenv("REFRESH_ENABLED", "true").lower() == "true" else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="YourPR Express Entry API", version="1.0.0", lifespan=lifespan,
              description="Official IRCC history and explicitly conditional CEC sensitivity analysis.")
origins = [v.strip().rstrip("/") for v in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if v.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def public_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600" if request.method == "GET" and request.url.path.startswith("/api/") else "no-store"
    return response


def status(bundle: dict) -> dict:
    fetched = datetime.fromisoformat(bundle["source"]["fetched_at"])
    age = max(0, (datetime.now(timezone.utc) - fetched).total_seconds() / 3600)
    path = data_dir() / "refresh-status.json"
    last_refresh = json.loads(path.read_text()) if path.exists() else None
    return {"source": bundle["source"], "data_as_of": bundle["audit"]["last_draw"],
            "age_hours": round(age, 1), "stale": age > 3,
            "refresh_enabled": os.getenv("REFRESH_ENABLED", "true").lower() == "true",
            "last_refresh": last_refresh, "audit": bundle["audit"]}


@app.get("/health")
def health():
    bundle = load_bundle()
    return {"status": "ok", "data_as_of": bundle["audit"]["last_draw"], "stale": status(bundle)["stale"]}


@app.get("/api/data/status")
def data_status():
    return status(load_bundle())


@app.get("/api/dashboard")
def dashboard():
    bundle = load_bundle()
    return {**bundle, "status": status(bundle)}


@app.get("/api/draws")
def draws(category: str | None = None, limit: int = Query(500, ge=1, le=1000)):
    bundle = load_bundle()
    rows = bundle["draws"]
    if category:
        rows = [d for d in rows if d["category"] == category.upper()]
    return {"source": bundle["source"], "draws": list(reversed(rows))[:limit]}


@app.get("/api/pool-snapshots")
def pool_snapshots():
    bundle = load_bundle()
    return {"source": bundle["source"], "snapshots": bundle["pool_snapshots"]}


@app.get("/api/backtests")
def backtests():
    bundle = load_bundle()
    return {"source": bundle["source"], **bundle["backtests"]}


@app.post("/api/scenarios")
def scenarios(request: Scenario):
    # Stateless: CRS scores and scenarios are not logged or saved.
    try:
        return scenario(load_bundle(), request)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

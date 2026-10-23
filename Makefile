.PHONY: setup frontend backend reproduce refresh verify
setup:
	cd backend && uv sync --frozen
	cd frontend && npm ci
frontend:
	cd frontend && npm run dev
backend:
	cd backend && uv run --frozen uvicorn app.main:app --reload --env-file .env.example
reproduce:
	cd backend && uv run --frozen python -m app.pipeline reproduce --output data --export ../frontend/src/data/snapshot.json
	backend/.venv/bin/python scripts/export-scenario-reference.py
refresh:
	cd backend && uv run --frozen python -m app.pipeline refresh --output data --export ../frontend/src/data/snapshot.json
	backend/.venv/bin/python scripts/export-scenario-reference.py
verify:
	cd backend && uv run --frozen pytest -q
	cd frontend && npm test && npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.7.13 /uv /usr/local/bin/uv
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
COPY data ./data
ENV PATH="/app/.venv/bin:$PATH" DATA_DIR=/data REFRESH_ENABLED=true
RUN mkdir -p /data
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

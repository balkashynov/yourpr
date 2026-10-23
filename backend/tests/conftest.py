import pytest


@pytest.fixture(autouse=True)
def disable_network_refresh(monkeypatch):
    monkeypatch.setenv("REFRESH_ENABLED", "false")

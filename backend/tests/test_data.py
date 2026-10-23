import copy
import hashlib
import json
import sqlite3
import pytest
from app.data import BUNDLED_DATA, BANDS, normalize, preserve_raw, regime
from app.pipeline import build


@pytest.fixture
def official():
    manifest = json.loads((BUNDLED_DATA / 'manifest.json').read_text())
    raw = (BUNDLED_DATA / manifest['raw_path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == manifest['sha256']
    return json.loads(raw)


def test_official_fixture_integrity(official):
    data = normalize(official, 'fixture')
    assert len(data['draws']) == 451
    assert len(data['pool_snapshots']) == 126
    assert len({d['id'] for d in data['draws']}) == 451
    assert {'91a', '91b'} <= {d['id'] for d in data['draws']}
    assert data['audit']['missing']['pool'] == 218
    assert any('247' in s for s in data['audit']['issues'])
    for pool in data['pool_snapshots']:
        assert sum(b['count'] for b in pool['bands']) == pool['total']


def test_score_bands_are_disjoint_and_complete():
    scores = [s for _, lo, hi in BANDS for s in range(lo, hi + 1)]
    assert sorted(scores) == list(range(1201))


def test_zero_placeholder_is_missing_not_empty_pool(official):
    result = normalize({'rounds': [official['rounds'][-1]]}, 'fixture')
    assert result['pool_snapshots'] == []
    assert result['draws'][0]['tie_break'] is None


def test_missing_snapshot_does_not_destroy_draw(official):
    row = copy.deepcopy(official['rounds'][0]); del row['dd1']
    assert normalize({'rounds': [row]}, 'x')['audit']['missing']['pool'] == 1


def test_schema_drift_fails_loudly(official):
    row = copy.deepcopy(official['rounds'][0]); del row['drawCRS']
    with pytest.raises(ValueError, match='Schema drift'):
        normalize({'rounds': [row]}, 'x')
    row['drawCRS'] = 'NaN'
    with pytest.raises(ValueError):
        normalize({'rounds': [row]}, 'x')


def test_unknown_category_preserved_and_flagged(official):
    row = copy.deepcopy(official['rounds'][0]); row['drawName'] = 'New category from IRCC'
    parsed = normalize({'rounds': [row]}, 'x')
    assert parsed['draws'][0]['category'] == 'OTHER'
    assert parsed['draws'][0]['category_raw'] == row['drawName']
    assert 'Unmapped' in parsed['audit']['issues'][0]


def test_overlap_never_subtracted_from_pool(official):
    data = normalize(official, 'fixture'); latest = data['pool_snapshots'][-1]
    assert len(latest['associated_draw_ids']) == 3
    assert latest['total'] == 229456
    assert len([p for p in data['pool_snapshots'] if p['date'] == latest['date']]) == 1


def test_tie_break_kept_verbatim(official):
    row = official['rounds'][0]
    assert normalize({'rounds': [row]}, 'x')['draws'][0]['tie_break'] == row['drawCutOff']


def test_regime_boundaries():
    assert regime('2025-03-24') == 'historical-unmodeled'
    assert regime('2025-03-25') == '2025-no-job-points'
    assert regime('2026-02-18') == '2026-categories'
    assert regime('2026-11-03') == '2026-lmi'


def test_archive_and_database_rebuild_are_idempotent(official, tmp_path):
    raw = json.dumps(official).encode()
    source = preserve_raw(raw, tmp_path, '2026-10-21T06:00:00+00:00')
    assert source == preserve_raw(raw, tmp_path, source['fetched_at'])
    assert build(raw, source, tmp_path) == build(raw, source, tmp_path)
    with sqlite3.connect(tmp_path / 'yourpr.sqlite') as db:
        assert db.execute('SELECT COUNT(*) FROM draws').fetchone()[0] == 451
    good = (tmp_path / 'snapshot.json').read_bytes()
    with pytest.raises(ValueError):
        build(b'{"rounds": []}', source, tmp_path)
    assert (tmp_path / 'snapshot.json').read_bytes() == good


def test_failed_refresh_keeps_last_valid_snapshot(official, tmp_path, monkeypatch):
    import httpx
    from app.pipeline import refresh
    raw = json.dumps(official).encode()
    source = preserve_raw(raw, tmp_path, '2026-10-21T06:00:00+00:00')
    build(raw, source, tmp_path)
    before = (tmp_path / 'snapshot.json').read_bytes()
    class BrokenClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url): raise httpx.ConnectError('Offline')
    monkeypatch.setattr('app.pipeline.httpx.Client', BrokenClient)
    monkeypatch.setattr('app.pipeline.time.sleep', lambda _: None)
    with pytest.raises(httpx.ConnectError):
        refresh(tmp_path)
    assert (tmp_path / 'snapshot.json').read_bytes() == before
    status = json.loads((tmp_path / 'refresh-status.json').read_text())
    assert not status['ok'] and status['error'] == 'ConnectError'


def test_future_draws_and_pool_dates_are_published_without_code_changes(official, tmp_path):
    row = copy.deepcopy(official['rounds'][0])
    row.update(drawNumber='9999', drawDate='2027-02-01', drawDateFull='February 1, 2027', drawName='Canadian Experience Class', drawSize='2,500', drawCRS='510', drawDistributionAsOn='January 31, 2027')
    raw = json.dumps({'rounds': official['rounds'] + [row]}).encode()
    source = preserve_raw(raw, tmp_path, '2027-02-01T17:00:00+00:00')
    result = build(raw, source, tmp_path)
    assert result['draws'][-1]['id'] == '9999'
    assert result['audit']['last_draw'] == '2027-02-01'
    assert result['draws'][-1]['regime'] == '2026-lmi'
    assert result['pool_snapshots'][-1]['date'] == '2027-01-31'


def test_refresh_loop_runs_immediately_then_hourly_even_after_failure(monkeypatch):
    import asyncio
    from app.main import refresh_loop
    calls = []
    sleeps = []
    def fake_refresh():
        calls.append('refresh')
        if len(calls) == 1:
            raise RuntimeError('temporary outage')
    async def fake_sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) == 2:
            raise asyncio.CancelledError
    monkeypatch.delenv('REFRESH_INTERVAL_SECONDS', raising=False)
    monkeypatch.setattr('app.main.refresh', fake_refresh)
    monkeypatch.setattr('app.main.asyncio.sleep', fake_sleep)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(refresh_loop())
    assert calls == ['refresh','refresh']
    assert sleeps == [3600,3600]

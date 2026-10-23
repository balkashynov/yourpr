import copy
import json
import pytest
from fastapi.testclient import TestClient
from app.data import BUNDLED_DATA
from app.main import app
from app.model import Scenario, evaluate, scenario


@pytest.fixture
def bundle():
    return json.loads((BUNDLED_DATA / 'snapshot.json').read_text())


def test_future_changes_do_not_affect_prior_backtest(bundle):
    original = evaluate(bundle['draws'])
    altered = copy.deepcopy(bundle['draws'])
    for d in altered:
        if d['date'] > '2026-08-01':
            d['cutoff'] = 1000
    changed = evaluate(altered)
    old = [p for r in original['periods'] for p in r['points'] if p['date'] <= '2026-08-01']
    new = [p for r in changed['periods'] for p in r['points'] if p['date'] <= '2026-08-01']
    assert old == new
    for period in original['periods']:
        for point in period['points']:
            assert point['train_end'] < point['date']
        assert all(not p['intervals'] for p in period['points'][:5])


def test_empty_and_sparse_periods_are_explicit():
    assert evaluate([])['model'] is None


def test_scenario_is_deterministic_and_not_a_probability(bundle):
    result = scenario(bundle, Scenario())
    assert result == scenario(bundle, Scenario())
    assert result['probability'] is None
    assert any(p['crosses_policy'] for p in result['points'])
    for p in result['points']:
        assert 0 <= p['low'] <= p['cutoff'] <= p['high'] <= 1200


def test_larger_draw_has_nonincreasing_first_cutoff(bundle):
    small = scenario(bundle, Scenario(draw_size=1000))['points'][1]['cutoff']
    large = scenario(bundle, Scenario(draw_size=5000))['points'][1]['cutoff']
    assert large <= small


def test_assumption_ordering(bundle):
    results = [scenario(bundle, Scenario(assumptions=a))['points'][1]['cutoff'] for a in ['optimistic','base','conservative']]
    assert results == sorted(results)


def test_api_validation_and_stateless_scenarios(monkeypatch, tmp_path):
    monkeypatch.setenv('DATA_DIR', str(tmp_path))
    with TestClient(app) as client:
        assert client.get('/health').status_code == 200
        response = client.get('/api/dashboard')
        assert response.status_code == 200
        assert response.json()['schema_version'] == 1
        assert response.headers['X-Content-Type-Options'] == 'nosniff'
        for invalid in [{'draw_size':0}, {'crs_score':1201}, {'horizon_draws':10000}, {'category':'PNP'}, {'interval_days':0}, {'draw_size':3000.5}, {'extra':'no'}]:
            assert client.post('/api/scenarios', json=invalid).status_code == 422
        assert client.post('/api/scenarios', json={'crs_score':510}).json()['probability'] is None
        assert client.get('/api/draws?category=CEC').json()['draws'][0]['category'] == 'CEC'
        assert client.get('/api/draws?limit=-1').status_code == 422
        assert client.options('/api/scenarios', headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST'}).headers['access-control-allow-origin'] == 'http://localhost:5173'
        assert 'access-control-allow-origin' not in client.get('/api/dashboard',headers={'Origin':'https://unknown.invalid'}).headers
    assert list(tmp_path.iterdir()) == []


def test_python_matches_committed_frontend_reference(bundle):
    from pathlib import Path
    reference = json.loads((Path(__file__).resolve().parents[2] / 'frontend/src/data/scenario-reference.json').read_text())
    assert reference['source_sha256'] == bundle['source']['sha256']
    for case in reference['cases']:
        assert scenario(bundle, Scenario(**case['input']))['points'] == case['points']


def test_explicit_future_start_date_matches_the_elapsed_time_model(bundle):
    from datetime import date
    from app.model import features
    result = scenario(bundle, Scenario(first_draw_date=date(2026, 11, 1), interval_days=14))
    assert result['points'][1]['date'] == '2026-11-01'
    assert result['points'][2]['date'] == '2026-11-15'
    last = bundle['backtests']['model']['last_draw']
    expected = round(last['cutoff'] + sum(a*b for a,b in zip(bundle['backtests']['model']['coefficients'], features(last,{'date':'2026-11-01','invitations':3000}))), 1)
    assert result['points'][1]['cutoff'] == expected
    with pytest.raises(ValueError, match='must follow'):
        scenario(bundle, Scenario(first_draw_date=date.fromisoformat(last['date'])))


def test_new_scoring_period_does_not_reuse_old_model(bundle):
    from app.data import regime
    rows = copy.deepcopy(bundle['draws'])
    latest = next(d for d in reversed(rows) if d['category'] == 'CEC')
    rows.append({**latest, 'id':'test-future', 'date':'2026-11-24', 'regime':regime('2026-11-24')})
    assert evaluate(rows)['model'] is None

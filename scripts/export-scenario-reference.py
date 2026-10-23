"""Update cross-language numerical parity cases after changing the pinned data/model."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.data import BUNDLED_DATA, atomic_json
from app.model import Scenario, scenario
bundle = json.loads((BUNDLED_DATA / 'snapshot.json').read_text())
cases = [Scenario(), Scenario(draw_size=1000, interval_days=7, assumptions='conservative'),
         Scenario(draw_size=10000, interval_days=60, horizon_draws=12, assumptions='optimistic'),
         Scenario(crs_score=0, horizon_draws=1), Scenario(crs_score=1200, draw_size=100, assumptions='optimistic')]
atomic_json(ROOT/'frontend/src/data/scenario-reference.json', {
    'source_sha256':bundle['source']['sha256'],
    'cases':[{'input':c.model_dump(exclude={'category'}), 'points':scenario(bundle,c)['points']} for c in cases]
})
print('Exported Python/TypeScript scenario parity fixtures.')

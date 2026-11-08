import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
test('snapshot links reference existing conclusions and periods; aggregates match detail rows', () => {
  assert.equal(data.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)));
  assert.ok(data.atlas.articleCount > 0);
  const periods = new Set(data.atlas.periods.map(p => p.id));
  const conclusions = new Set(data.atlas.conclusions.map(c => c.id));
  const cells = new Map();
  for (const row of data.treatments) {
    assert.ok(periods.has(row.periodId)); assert.ok(conclusions.has(row.conclusionId));
    assert.ok(['direct', 'context', 'counterevidence'].includes(row.relation));
    assert.notEqual(row.reviewStatus, 'rejected'); assert.ok(row.articleTitle);
    const key = `${row.conclusionId}|${row.periodId}`;
    const c = cells.get(key) || { direct: 0, context: 0, counter: 0, articles: new Set() };
    c[row.relation === 'counterevidence' ? 'counter' : row.relation]++;
    c.articles.add(row.articleNo); cells.set(key, c);
  }
  assert.equal(data.atlas.cells.length, cells.size);
  for (const cell of data.atlas.cells) {
    const expected = cells.get(`${cell.c}|${cell.p}`);
    assert.ok(expected);
    for (const key of ['direct','context','counter']) assert.equal(cell[key], expected[key]);
    assert.equal(cell.articles, expected.articles.size);
  }
});
test('public snapshot contains no connection credentials or privileged configuration', () => {
  const text = JSON.stringify(data);
  assert.doesNotMatch(text, /postgres(?:ql)?:\/\/|LOVABLE_API_KEY|NEON_API_KEY|NEON_DATABASE_URL|neonQuery/);
});

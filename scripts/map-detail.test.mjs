import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomCamera, wheelZoom } from '../src/lib/atlas.camera.ts';
import { mapDetail, recordedMapDetails } from '../src/lib/atlas.map-detail.ts';
import { contourFill, heightField } from '../src/lib/atlas.contours.ts';

test('sphere camera keeps anchor point invariant during zoom', () => {
  const next = zoomCamera({ zoom: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 });
  assert.equal(next.zoom, 2);
  assert.equal(next.x, -100);
  assert.equal(next.y, -50);
});

test('map detail level adjusts by zoom threshold without jumping', () => {
  assert.equal(mapDetail(1), 'terrain');
  assert.equal(mapDetail(1.5), 'conclusions');
  assert.equal(mapDetail(2), 'concepts');
  assert.equal(mapDetail(2.8), 'evidence');
});

test('recordedMapDetails only uses exact recorded concepts and excludes rejected items', () => {
  const detail = recordedMapDetails([
    { c: 1, p: 'p1', articleNo: 7, concepts: ['Oikeudet'], relation: 'context', reviewStatus: 'needs_review' },
    { c: 1, p: 'p2', articleNo: 8, concepts: ['Koulutus'], relation: 'direct', reviewStatus: 'needs_review' },
    { c: 2, p: 'p1', articleNo: 9, concepts: ['Työ'], relation: 'direct', reviewStatus: 'needs_review' },
    { c: 1, p: 'p1', articleNo: 10, concepts: ['Hylätty'], relation: 'direct', reviewStatus: 'rejected' },
  ], 1, 'p1');
  assert.deepEqual(detail, { concepts: [{ label: 'Oikeudet', articles: [7] }], articles: [7] });
});

test('contourFill creates valid polygon vertices following level boundary', () => {
  const f = heightField([{ lat: 0, ang: 0, w: 10 }], 10, 20);
  const polys = contourFill(f, f.max * 0.5);
  assert.ok(polys.length > 0);
  assert.ok(polys.every(p => p.length >= 3));
});

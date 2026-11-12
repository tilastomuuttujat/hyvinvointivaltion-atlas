import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, label) {
  const deadline = Date.now() + 10000;
  while (!pred()) { if (Date.now() > deadline) throw new Error(`Timed out: ${label}`); await pause(40); }
}

// jsdom has no 2D canvas backend, so the particle flow gets an inert drawing target.
function stubCanvas(w) {
  const noop = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => ({
    scale: noop, fillRect: noop, clearRect: noop, beginPath: noop, arc: noop, fill: noop,
    stroke: noop, moveTo: noop, lineTo: noop, save: noop, restore: noop,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
  });
}

function boot(url) {
  const errors = [], console = new VirtualConsole();
  console.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM('<div id="root"></div>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  w.requestAnimationFrame = () => 1; w.cancelAnimationFrame = () => {};
  w.fetch = async () => ({ ok: true, json: async () => ({}) });
  stubCanvas(w);
  return { dom, w, errors };
}

const dir = new URL('../dist-pages/assets/', import.meta.url);
const entry = (await readdir(dir)).find(n => /^index-.*\.js$/.test(n));
assert.ok(entry, 'Run build:pages first');
const code = await readFile(new URL(entry, dir), 'utf8');

test('the /tieto path mounts the article visualization', { timeout: 60000 }, async () => {
  const { dom, w, errors } = boot('https://example.org/hyvinvointivaltion-atlas/tieto/');
  try {
    w.eval(code);
    await until(() => w.document.querySelector('.tv'), 'article visualization mount');
    const scope = w.document.querySelector('.tv');
    assert.ok(scope.querySelector('canvas'), 'particle flow canvas');
    const eras = [...scope.querySelectorAll('.tv-eras button')];
    assert.equal(eras.length, 6, 'six eras');
    assert.equal(scope.querySelectorAll('.tv-gate').length, 3, 'three gates');
    assert.deepEqual(errors.filter(e => !/Not implemented/.test(e)), []);
  } finally { dom.window.close(); }
});

test('choosing an era and a gate updates the reading', { timeout: 60000 }, async () => {
  const { dom, w, errors } = boot('https://example.org/hyvinvointivaltion-atlas/tieto/');
  try {
    w.eval(code);
    await until(() => w.document.querySelector('.tv'), 'mount');
    const scope = w.document.querySelector('.tv');
    const eras = [...scope.querySelectorAll('.tv-eras button')];
    eras[0].click();
    await until(() => scope.querySelector('.tv-label').textContent.includes('1850'), 'era 1850–1917');
    assert.equal(eras[0].getAttribute('aria-pressed'), 'true');
    const gate = [...scope.querySelectorAll('.tv-gate')].find(g => g.getAttribute('aria-label') === 'Kyky korjata');
    assert.ok(gate, 'gate target');
    gate.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await until(() => scope.querySelector('aside h3').textContent.includes('Kyky korjata'), 'gate explanation');
    assert.match(scope.textContent, /Kuka pystyy toimimaan\?/);
    assert.deepEqual(errors.filter(e => !/Not implemented/.test(e)), []);
  } finally { dom.window.close(); }
});

test('the atlas root still mounts at the site root', { timeout: 60000 }, async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
  const { dom, w, errors } = boot('https://example.org/hyvinvointivaltion-atlas/');
  try {
    w.fetch = async () => ({ ok: true, json: async () => snapshot });
    w.eval(code);
    await until(() => w.document.querySelector('.atlas-experience'), 'atlas mount');
    assert.ok(!w.document.querySelector('.tv'), 'no article visualization at the root');
    assert.deepEqual(errors.filter(e => !/Not implemented/.test(e)), []);
  } finally { dom.window.close(); }
});

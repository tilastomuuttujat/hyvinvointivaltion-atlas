import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  const deadline = Date.now() + 15000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("Theme experience timed out");
    await pause(40);
  }
}
test(
  "theme and node views share catalogue, preserve isolated concepts and expose sources",
  { timeout: 60000 },
  async () => {
    const snapshot = JSON.parse(
      await readFile(
        new URL("../public/data/atlas.json", import.meta.url),
        "utf8",
      ),
    );
    const dir = new URL("../dist-pages/assets/", import.meta.url),
      entry = (await readdir(dir)).find((n) => /^index-.*\.js$/.test(n));
    const errors = [],
      vc = new VirtualConsole();
    vc.on("jsdomError", (e) => errors.push(e.message));
    const dom = new JSDOM('<div id="root"></div>', {
      url: "https://example.org/hyvinvointivaltion-atlas/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: vc,
    });
    const w = dom.window;
    let requests = 0;
    w.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    w.requestAnimationFrame = () => 1;
    w.cancelAnimationFrame = () => {};
    w.fetch = async () => {
      requests++;
      return { ok: true, json: async () => snapshot };
    };
    try {
      w.eval(await readFile(new URL(entry, dir), "utf8"));
      await until(() => w.document.querySelector(".view-switch"));
      const choose = (text) =>
        [...w.document.querySelectorAll(".view-switch button")]
          .find((b) => b.textContent === text)
          .click();
      choose("☊ Teemaverkko");
      await until(() => w.document.querySelector(".ts"));
      assert.ok(
        w.document
          .querySelector(".ts-edition")
          .textContent.includes("12 teemaa"),
      );
      const labels = [
        ...w.document.querySelectorAll(".ts-star[aria-label]"),
      ].map((n) => n.getAttribute("aria-label"));
      for (const c of snapshot.evidence.concepts)
        assert.ok(labels.includes(c.label), `Missing ${c.id}`);
      choose("☍ Solmuverkko");
      await until(() => w.document.querySelector(".organic-graph"));
      const graph = w.document.querySelector(".organic-graph");
      assert.ok(
        graph.querySelector('[role="button"][aria-label="Korjausvalta"]'),
      );
      const node = graph.querySelector(
        '[role="button"][aria-label="Työn mukauttaminen"]',
      );
      node.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await until(() => graph.querySelector(".theme-selection-details"));
      assert.ok(graph.textContent.includes("Tulkinnan rajat"));
      assert.ok(
        [...graph.querySelectorAll("a")].some(
          (a) => a.href === "https://www.sjweh.fi/article/3664",
        ),
      );
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

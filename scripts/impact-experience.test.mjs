import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const wait = async (fn) => {
  const end = Date.now() + 15000;
  while (!fn()) {
    if (Date.now() > end) throw Error("Impact experience timed out");
    await new Promise((r) => setTimeout(r, 30));
  }
};
test(
  "impact section supports directed steps, manual summary and persistent global context",
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
        url: "https://example.org/hyvinvointivaltion-atlas/#vaikutusketjut",
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole: vc,
      }),
      w = dom.window;
    w.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    w.requestAnimationFrame = () => 1;
    w.cancelAnimationFrame = () => {};
    let requests = 0;
    w.fetch = async () => {
      requests++;
      return { ok: true, json: async () => snapshot };
    };
    try {
      w.eval(await readFile(new URL(entry, dir), "utf8"));
      await wait(() => w.document.querySelector(".impact-canvas"));
      const root = w.document.querySelector(".impact-atlas"),
        node = (id) => root.querySelector(`[data-impact-node="${id}"]`),
        click = (el) =>
          el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      assert.equal(
        root.querySelectorAll("[data-impact-node]").length,
        snapshot.evidence.concepts.length,
      );
      const edge = snapshot.evidence.reasoning.mechanisms.find(
        (m) => m.isCurrent && m.reviewStatus !== "rejected" && m.from !== m.to,
      );
      click(node(edge.from));
      await wait(
        () =>
          root.querySelector(".impact-canvas").dataset.current === edge.from,
      );
      assert.equal(node(edge.to).dataset.candidate, "true");
      assert.ok(root.querySelector(".impact-minimap svg"));
      assert.ok(!root.querySelector(".graph-summary.open"));
      click(node(edge.to));
      await wait(
        () => root.querySelector(".impact-canvas").dataset.current === edge.to,
      );
      assert.equal(node(edge.from).dataset.selected, "true");
      assert.equal(node(edge.to).dataset.selected, "true");
      assert.ok(root.querySelector('[data-chosen="true"]'));
      click(root.querySelector(".graph-summary-open"));
      await wait(() => root.querySelector(".graph-summary.open"));
      click(root.querySelector(".graph-summary-open"));
      await wait(() => !root.querySelector(".graph-summary.open"));
      const button = [...root.querySelectorAll("button")].find(
        (b) => b.textContent === "3 askelta",
      );
      click(button);
      await wait(
        () => root.querySelector(".impact-canvas").dataset.depth === "3",
      );
      const future = root.querySelector(".impact-node.future");
      if (future) {
        const current = root.querySelector(".impact-canvas").dataset.current;
        click(future);
        await new Promise((r) => setTimeout(r, 60));
        assert.equal(
          root.querySelector(".impact-canvas").dataset.current,
          current,
        );
      }
      click(
        [...w.document.querySelectorAll(".view-switch button")].find(
          (b) => b.textContent === "☍ Solmuverkko",
        ),
      );
      await wait(() => root.parentElement.hidden);
      click(
        [...w.document.querySelectorAll(".view-switch button")].find(
          (b) => b.textContent === "↝ Vaikutusketjut",
        ),
      );
      await wait(() => !root.parentElement.hidden);
      assert.equal(node(edge.from).dataset.selected, "true");
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

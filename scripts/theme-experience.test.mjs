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
      const themeView = w.document.querySelector(".ts");
      const themeNode = themeView.querySelector(
        '.ts-star[aria-label="Työn mukauttaminen"]',
      );
      themeNode.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await until(() => themeView.querySelector(".ts-drawer-open"));
      assert.equal(
        themeView.querySelector(".ts-drawer").getAttribute("aria-hidden"),
        "true",
      );
      themeView.querySelector(".ts-drawer-open").click();
      await until(() => themeView.querySelector(".ts-drawer.open"));
      themeView.querySelector(".ts-drawer-close").click();
      await until(() => !themeView.querySelector(".ts-drawer.open"));
      themeNode.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await pause(80);
      assert.equal(
        themeView.querySelector(".ts-drawer").getAttribute("aria-hidden"),
        "true",
      );
      const exercisePath = async (scope) => {
        assert.equal(scope.querySelector(".graph-explore"), null);
        assert.equal(scope.querySelector(".graph-questions"), null);
        assert.equal(scope.querySelector(".graph-options"), null);
        const target = () =>
          scope.querySelector(
            '[role="button"][aria-label="Kestävä työhönpaluu"]',
          );
        await until(
          () => target()?.getAttribute("data-path-candidate") === "true",
        );
        assert.ok(target().querySelector(".graph-next-ring"));
        assert.ok(
          target()
            .querySelector(".graph-point-hint")
            .textContent.includes("seuraus"),
        );
        assert.ok(
          target()
            .querySelector("title")
            .textContent.includes("Mukautettu työ ja työhönpaluu"),
        );
        target().dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        await until(
          () => target()?.getAttribute("data-path-active") === "true",
        );
        assert.equal(
          target().querySelector(".graph-step-number").textContent,
          "2",
        );
        assert.ok(scope.querySelector('[data-path-chosen="true"]'));
        assert.equal(
          scope.querySelector("aside").getAttribute("aria-hidden"),
          "true",
        );
        scope
          .querySelector(
            '.graph-trail [aria-label="Palaa: Työn mukauttaminen"]',
          )
          .click();
        await until(
          () => target()?.getAttribute("data-path-candidate") === "true",
        );
        assert.equal(scope.querySelector('[data-path-chosen="true"]'), null);
        target().dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await until(
          () => target()?.getAttribute("data-path-active") === "true",
        );
        assert.equal(
          target().querySelector(".graph-step-number").textContent,
          "2",
        );
        assert.equal(scope.querySelectorAll(".graph-trail button").length, 2);
      };
      await exercisePath(themeView);
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
      assert.equal(
        graph.querySelector("aside").getAttribute("aria-hidden"),
        "true",
      );
      graph.querySelector('[aria-label="Avaa tietolaatikko"]').click();
      await until(
        () =>
          graph.querySelector("aside").getAttribute("aria-hidden") === "false",
      );
      node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await pause(80);
      assert.equal(
        graph.querySelector("aside").getAttribute("aria-hidden"),
        "false",
      );
      graph.querySelector('[aria-label="Sulje tietolaatikko"]').click();
      await until(
        () =>
          !(
            graph.querySelector("aside").getAttribute("aria-hidden") === "false"
          ),
      );
      node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await pause(80);
      assert.equal(
        graph.querySelector("aside").getAttribute("aria-hidden"),
        "true",
      );
      assert.ok(graph.textContent.includes("Tulkinnan rajat"));
      assert.ok(
        [...graph.querySelectorAll("a")].some(
          (a) => a.href === "https://www.sjweh.fi/article/3664",
        ),
      );
      await exercisePath(graph);
      [...graph.querySelectorAll(".graph-trail button")]
        .find((b) => b.textContent === "Tyhjennä polku")
        .click();
      await until(() => !graph.querySelector(".graph-trail"));
      const isolated = graph.querySelector(
        '[role="button"][aria-label="Korjausvalta"]',
      );
      isolated.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await until(() => isolated.querySelector(".graph-end-hint"));
      assert.equal(graph.querySelector(".graph-explore"), null);
      assert.equal(
        graph.querySelector("aside").getAttribute("aria-hidden"),
        "true",
      );
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

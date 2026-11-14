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
      const startTheme = snapshot.themeCatalog.themes.find((t) =>
        t.concepts.some((c) => c.id === "work_accommodation"),
      );
      [...themeView.querySelectorAll(".ts-theme")]
        .find((n) => n.getAttribute("aria-label") === startTheme.label)
        .dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      await until(() =>
        themeView
          .querySelector(".graph-explore")
          ?.textContent.includes("teemajäseniä"),
      );
      [...themeView.querySelectorAll(".graph-explore button")]
        .find((b) => b.textContent === "Työn mukauttaminen")
        .click();
      await until(() =>
        themeView
          .querySelector(".graph-questions")
          ?.textContent.includes("Mikä tähän johti?"),
      );
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
      const exploreButton = (scope, text) =>
        [...scope.querySelectorAll(".graph-explore button")].find(
          (b) => b.textContent === text,
        );
      const exercisePath = async (scope) => {
        exploreButton(scope, "Mihin tämä vaikuttaa?").click();
        await until(() => scope.querySelector(".graph-options article"));
        assert.ok(
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("Osa-aikainen työ"),
        );
        assert.ok(
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("Selitysehdotus"),
        );
        assert.ok(
          scope.querySelector(
            '.graph-options a[href="https://www.sjweh.fi/article/3664"]',
          ),
        );
        [...scope.querySelectorAll(".graph-options article > button")]
          .find((b) => b.textContent.includes("Kestävä työhönpaluu"))
          .click();
        await until(
          () =>
            scope.querySelector(".graph-explore header strong").textContent ===
            "Kestävä työhönpaluu",
        );
        assert.equal(
          scope.querySelectorAll('.graph-trail [aria-current="step"]').length,
          1,
        );
        assert.equal(scope.querySelectorAll(".graph-trail button").length, 3);
        assert.equal(
          scope.querySelector("aside").getAttribute("aria-hidden"),
          "true",
        );
        exploreButton(scope, "Mikä tähän johti?").click();
        await until(() =>
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("Työn mukauttaminen"),
        );
        assert.ok(
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("Edeltävä tekijä"),
        );
        scope.querySelector(".graph-trail button").click();
        await until(
          () =>
            scope.querySelector(".graph-explore header strong").textContent ===
            "Työn mukauttaminen",
        );
        assert.equal(scope.querySelectorAll(".graph-trail button").length, 2);
        exploreButton(scope, "Millä ehdoilla?").click();
        await until(() =>
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("Terveydentilaan soveltuva työ"),
        );
        exploreButton(scope, "Mikä tähän johti?").click();
        await until(() =>
          scope
            .querySelector(".graph-options")
            ?.textContent.includes("ei ole kirjattua"),
        );
        exploreButton(scope, "Mihin tämä vaikuttaa?").click();
        await until(() => scope.querySelector(".graph-options article"));
        scope
          .querySelector('[role="button"][aria-label="Kestävä työhönpaluu"]')
          .dispatchEvent(
            new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
          );
        await until(() =>
          scope
            .querySelector('.graph-trail button[aria-current="step"]')
            ?.textContent.includes("Kestävä työhönpaluu"),
        );
        assert.equal(scope.querySelectorAll(".graph-trail button").length, 3);
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
      graph.querySelector('[aria-label="Sulje polun tutkiminen"]').click();
      await until(() => !graph.querySelector(".graph-explore"));
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

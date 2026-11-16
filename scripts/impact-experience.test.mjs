import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  const deadline = Date.now() + 20000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("Impact experience timed out");
    await pause(40);
  }
}

test(
  "recorded chains play inside the theme sky and keep their context across views",
  { timeout: 90000 },
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
      await until(() => w.document.querySelector(".view-switch"));
      const tabs = [...w.document.querySelectorAll(".view-switch button")].map(
        (b) => b.textContent,
      );
      // The chains have no section of their own: they belong to the theme sky.
      assert.ok(!tabs.includes("↝ Vaikutusketjut"));
      assert.ok(tabs.includes("☊ Teemaverkko"));
      // #vaikutusketjut opens that sky instead of a separate view.
      await until(() => w.document.querySelector(".ts-space"));
      // Before anything is chosen the reader sees the recorded routes, grouped
      // by the concept they start from.
      await until(() => w.document.querySelector(".impact-route-card"));
      const recorded = snapshot.evidence.reasoning.paths.filter(
        (p) => p.reviewStatus !== "rejected" && p.steps.length > 0,
      );
      const starts = new Set(
        recorded.map(
          (p) => [...p.steps].sort((a, b) => a.order - b.order)[0].conceptId,
        ),
      );
      assert.equal(
        w.document.querySelectorAll(".impact-route-card").length,
        recorded.length,
      );
      assert.equal(
        w.document.querySelectorAll(".impact-family").length,
        starts.size,
      );
      const family = [...w.document.querySelectorAll(".impact-family")].find(
        (f) => f.querySelectorAll(".impact-route-card").length > 1,
      );
      assert.ok(
        family,
        "one start concept should offer several recorded routes",
      );
      // Choosing a route draws it on the sky step by step.
      const card = family.querySelector(".impact-route-card");
      const wanted = Number(card.textContent.match(/(\d+) askelta/)[1]);
      card.click();
      await until(
        () =>
          w.document.querySelectorAll(".impact-story-strip li").length >=
          wanted,
      );
      const d = w.document;
      assert.equal(
        d.querySelector(".impact-insight").getAttribute("aria-label"),
        "Ketjun tulkinta",
      );
      assert.equal(d.querySelectorAll(".impact-story-strip li").length, wanted);
      // The interpretation names the mechanisms and how strong the evidence is.
      assert.ok(d.querySelector(".impact-meter"));
      assert.match(
        d.querySelector(".impact-meter-key").textContent,
        /\d+ kausaaliseksi arvioitua · \d+ selitysehdotusta/,
      );
      assert.ok(
        d.querySelectorAll('.ts-causal[data-path-chosen="true"]').length >=
          wanted - 1,
      );
      assert.ok(
        d.querySelectorAll('.ts-star[data-path-active="true"]').length >= 1,
      );
      // The reader is told where the chain goes on.
      const trail = d.querySelector(".graph-trail");
      assert.match(trail.textContent, /valittua pistettä/);
      assert.match(
        trail.textContent,
        /jatkoaskel|jatkoaskelta|ei ole kirjattuja jatkoaskelia/,
      );
      const points = trail.textContent.match(/(\d+) valittua pistettä/)[1];
      // The same chain stays in context when the reader moves to another view.
      const choose = (text) =>
        [...d.querySelectorAll(".view-switch button")]
          .find((b) => b.textContent === text)
          .click();
      choose("☍ Solmuverkko");
      await until(() => d.querySelector(".graph-trail"));
      assert.equal(
        d
          .querySelector(".graph-trail")
          .textContent.match(/(\d+) valittua pistettä/)[1],
        points,
      );
      choose("☊ Teemaverkko");
      await until(
        () => d.querySelectorAll(".impact-story-strip li").length >= wanted,
      );
      assert.equal(d.querySelectorAll(".impact-story-strip li").length, wanted);
      assert.equal(requests, 1);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

test(
  "reasoning labels stay sparse in overview and name every local or focused point",
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
      }),
      w = dom.window;
    w.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    w.requestAnimationFrame = () => 1;
    w.cancelAnimationFrame = () => {};
    w.fetch = async () => ({ ok: true, json: async () => snapshot });
    try {
      w.eval(await readFile(new URL(entry, dir), "utf8"));
      await until(() =>
        [...w.document.querySelectorAll("button")].some((b) =>
          b.textContent.includes("Päättelyavaruus"),
        ),
      );
      [...w.document.querySelectorAll("button")]
        .find((b) => b.textContent.includes("Päättelyavaruus"))
        .click();
      await until(() => w.document.querySelector(".reasoning-space [data-i]"));
      const points = [
        ...w.document.querySelectorAll(".reasoning-space [data-i]"),
      ];
      const check = () => {
        for (const p of points) {
          const label = p.querySelector(".rs-label");
          if (
            p.dataset.labelContext === "local" ||
            p.getAttribute("aria-pressed") === "true"
          ) {
            assert.ok(
              label,
              `Missing local name: ${p.getAttribute("aria-label")}`,
            );
            assert.equal(label.textContent, p.getAttribute("aria-label"));
          }
        }
      };
      assert.ok(
        points.filter((p) => p.querySelector(".rs-label")).length <
          points.length,
      );
      for (const kind of ["theme", "conclusion", "concept"]) {
        const point = points.find((p) => p.dataset.nodeKind === kind);
        point.dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        await until(() => point.getAttribute("aria-pressed") === "true");
        check();
        assert.equal(
          point.querySelector(".rs-label").textContent,
          point.getAttribute("aria-label"),
        );
        assert.ok(
          points.some(
            (p) =>
              p.dataset.labelContext === "background" &&
              !p.querySelector(".rs-label"),
          ),
        );
      }
      const wall = w.document.querySelector(".history-wall");
      assert.equal(wall.dataset.historyCount, "1111");
      assert.ok(wall.querySelector('[data-history-corridor="true"]'));
      assert.ok(wall.querySelector('[data-history-side="left"]'));
      assert.ok(wall.querySelector('[data-history-side="right"]'));
      assert.equal(wall.querySelectorAll("[data-history-item]").length, 1111);
      assert.ok(wall.querySelectorAll(".history-title").length > 150);
      assert.equal(
        wall.querySelectorAll(".history-link,[data-history-relation]").length,
        0,
      );
      for (const p of wall.querySelectorAll("[data-history-item]")) {
        assert.equal(
          p.getAttribute("clip-path"),
          `url(#history-${p.dataset.historySide}-surface)`,
        );
        assert.equal(
          p.dataset.historyLit,
          p.dataset.historyContext !== "none" ? "true" : "false",
        );
      }
      for (const line of wall.querySelectorAll(".history-link"))
        assert.ok(Number(line.getAttribute("opacity")) <= 0.25);

      assert.ok(wall.querySelector('[data-history-lit="true"]'));
      assert.ok(!wall.querySelector("[data-history-detail]"));
      const historical = wall.querySelector("[data-history-item]");
      historical.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await until(() =>
        wall.querySelector('[aria-label="Avaa historiallisen ilmiön lähteet"]'),
      );
      assert.ok(!wall.querySelector("[data-history-detail]"));
      wall
        .querySelector('[aria-label="Avaa historiallisen ilmiön lähteet"]')
        .dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      await until(() => wall.querySelector("[data-history-detail]"));
      assert.ok(
        wall
          .querySelector("[data-history-detail]")
          .textContent.includes("luottamus:"),
      );
      [...wall.querySelectorAll("button")]
        .find((b) => b.textContent === "Sulje")
        .click();
      await until(() => !wall.querySelector("[data-history-detail]"));
      const canvas = w.document.querySelector(".rs-canvas");
      const initialSpotlight =
        w.document.querySelector(".reasoning-space").dataset.spotlight;
      let changed = false;
      for (let turn = 0; turn < 22; turn++) {
        canvas.dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
        await pause(35);
        if (
          w.document.querySelector(".reasoning-space").dataset.spotlight !==
          initialSpotlight
        ) {
          changed = true;
          break;
        }
      }
      assert.ok(changed, "rotation should reveal a different chain");
      assert.ok(!w.document.querySelector(".reader-summary.open"));
      assert.ok(w.document.querySelector('[data-spotlit="true"]'));
      const clickText = (text) => {
        const button = [
          ...w.document.querySelectorAll(".reasoning-space button"),
        ].find((b) => b.textContent === text);
        assert.ok(button, text);
        button.click();
      };
      assert.equal(
        w.document.querySelectorAll(".reader-questions,.reader-next").length,
        0,
      );
      const start = [
        ...w.document.querySelectorAll(".reasoning-space [data-i]"),
      ].find(
        (p) =>
          p.getAttribute("aria-label") ===
          snapshot.evidence.concepts.find((c) => c.id === "work_accommodation")
            .label,
      );
      start.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await until(() => w.document.querySelector("[data-rs-follow]"));
      assert.ok(!w.document.querySelector(".reader-summary.open"));
      w.document
        .querySelector("[data-rs-follow]")
        .dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      await until(() =>
        w.document.querySelector(".reader-entry").textContent.includes("(2)"),
      );
      assert.ok(
        w.document.querySelector('.reasoning-space [data-chosen="true"]'),
      );
      assert.ok(w.document.querySelector(".reader-minimap"));
      clickText("Oma tulkintapolku (2)");
      await until(() => w.document.querySelector(".reader-summary.open"));
      assert.ok(
        w.document
          .querySelector(".reader-summary")
          .textContent.includes("Mitä tästä voi päätellä?"),
      );
      assert.ok(
        w.document
          .querySelector(".reader-summary")
          .textContent.includes("Millä ehdoilla ja rajoilla?"),
      );
      clickText("Säilytä tämä vertailuun");
      await until(() => w.document.querySelector(".reader-comparison"));
      clickText("Tutki toista polkua samasta alusta");
      await until(() => !w.document.querySelector(".reader-summary.open"));
      w.document
        .querySelector("[data-rs-follow]")
        .dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      await until(() =>
        w.document.querySelector(".reader-entry").textContent.includes("(2)"),
      );
      clickText("Oma tulkintapolku (2)");
      await until(() =>
        w.document.querySelector(".reader-summary.open .reader-comparison"),
      );
      assert.ok(
        w.document
          .querySelector(".reader-comparison")
          .textContent.includes("Sama lähtökohta"),
      );
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

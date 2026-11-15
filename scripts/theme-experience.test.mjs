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
        assert.ok(scope.querySelector(".graph-flow-stream"));
        assert.ok(
          scope
            .querySelector(".graph-flow-caption")
            .textContent.includes("Mukautettu työ"),
        );
        target().dispatchEvent(
          new w.MouseEvent("mouseover", { bubbles: true }),
        );
        await until(() => scope.querySelector(".graph-flow-preview"));
        assert.ok(
          scope
            .querySelector(".graph-flow-caption")
            .textContent.includes("Osa-aikainen työ"),
        );
        assert.equal(
          scope.querySelector(".graph-summary").getAttribute("aria-hidden"),
          "true",
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
        scope.querySelector(".graph-summary-open").click();
        await until(() => scope.querySelector(".graph-summary.open"));
        assert.equal(scope.querySelectorAll(".graph-summary li").length, 2);
        assert.ok(
          scope
            .querySelector(".graph-summary")
            .textContent.includes("Osa-aikainen työ"),
        );
        assert.ok(
          scope.querySelector(
            '.graph-summary a[href="https://www.sjweh.fi/article/3664"]',
          ),
        );

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
        assert.equal(scope.querySelectorAll(".graph-summary li").length, 1);
        assert.ok(scope.querySelector(".graph-summary.open"));
        scope.querySelector('[aria-label="Piilota polun yhteenveto"]').click();
        await until(() => !scope.querySelector(".graph-summary.open"));

        target().dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await until(
          () => target()?.getAttribute("data-path-active") === "true",
        );
        assert.equal(
          target().querySelector(".graph-step-number").textContent,
          "2",
        );
        assert.ok(scope.querySelectorAll(".graph-trail button").length >= 2);
        [...scope.querySelectorAll(".graph-trail button")]
          .find((b) => b.textContent === "Tyhjennä polku")
          .click();
        await until(() => !scope.querySelector(".graph-step-number"));
        target().dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        const reverse = () =>
          scope.querySelector(
            '[role="button"][aria-label="Työn mukauttaminen"]',
          );
        await until(
          () => reverse()?.getAttribute("data-path-candidate") === "true",
        );
        reverse().dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await until(
          () => reverse()?.getAttribute("data-path-active") === "true",
        );
        scope.querySelector(".graph-summary-open").click();
        await until(() => scope.querySelector(".graph-summary.open"));
        assert.ok(
          scope
            .querySelector(".graph-summary")
            .textContent.includes("Tutkit vaikutusta taaksepäin"),
        );
        assert.equal(scope.querySelectorAll(".graph-summary li").length, 2);
        scope.querySelector('[aria-label="Piilota polun yhteenveto"]').click();
        await until(() => !scope.querySelector(".graph-summary.open"));
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
      assert.equal(
        graph.querySelectorAll(".graph-summary li").length,
        2,
        "route survives the view switch",
      );
      graph
        .querySelector("svg")
        .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await pause(60);
      assert.equal(
        graph.querySelectorAll(".graph-summary li").length,
        2,
        "background click preserves the route",
      );
      [...graph.querySelectorAll(".graph-trail button")]
        .find((b) => b.textContent === "Tyhjennä polku")
        .click();
      await until(() => !graph.querySelector(".graph-step-number"));
      node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      await until(() => graph.querySelector(".graph-step-number"));
      await exercisePath(graph);
      [...graph.querySelectorAll(".graph-trail button")]
        .find((b) => b.textContent === "Tyhjennä polku")
        .click();
      await until(() => !graph.querySelector(".graph-step-number"));
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

test(
  "parallel choices, shared routes and forward history keep the exact mechanism",
  { timeout: 60000 },
  async () => {
    const snapshot = JSON.parse(
      await readFile(
        new URL("../public/data/atlas.json", import.meta.url),
        "utf8",
      ),
    );
    const original = snapshot.evidence.reasoning.mechanisms.find(
      (m) => m.id === "accommodation-to-rtw",
    );
    snapshot.evidence.reasoning.mechanisms.push({
      ...original,
      id: "parallel-rtw",
      label: "Vaihtoehtoinen kirjattu perustelu",
      explanation: "Toinen mekanismi samaan pisteeseen.",
    });
    for (const theme of snapshot.themeCatalog.themes) {
      const m = theme.mechanisms.find((m) => m.id === original.id);
      if (m)
        theme.mechanisms.push({
          ...m,
          id: "parallel-rtw",
          t: "Vaihtoehtoinen kirjattu perustelu",
          d: "Toinen mekanismi samaan pisteeseen.",
        });
    }
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
      await until(() => w.document.querySelector(".view-switch"));
      const choose = (text) =>
        [...w.document.querySelectorAll(".view-switch button")]
          .find((b) => b.textContent === text)
          .click();
      const click = (node) => {
        assert.ok(node);
        node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      };
      choose("☊ Teemaverkko");
      await until(() => w.document.querySelector(".ts"));
      const theme = w.document.querySelector(".ts");
      const a = () =>
        theme.querySelector('[role="button"][aria-label="Työn mukauttaminen"]');
      const b = () =>
        theme.querySelector(
          '[role="button"][aria-label="Kestävä työhönpaluu"]',
        );
      click(a());
      await until(() => b()?.getAttribute("data-path-candidate") === "true");
      click(b());
      await until(() => theme.querySelector(".graph-mechanism-choice"));
      assert.equal(
        theme.querySelectorAll(".graph-summary li").length,
        1,
        "ambiguous target does not choose the first mechanism",
      );
      const option = [
        ...theme.querySelectorAll(".graph-mechanism-choice button"),
      ].find((b) => b.textContent === "Vaihtoehtoinen kirjattu perustelu");
      option.dispatchEvent(new w.FocusEvent("focusin", { bubbles: true }));
      await until(() =>
        theme.querySelector(
          '[data-flow-mechanism="parallel-rtw"].graph-flow-preview',
        ),
      );
      click(option);
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 2,
      );
      assert.equal(
        theme.querySelector(".graph-summary li h4").textContent,
        "Vaihtoehtoinen kirjattu perustelu",
      );
      assert.ok(
        theme.querySelector(
          '[data-flow-mechanism="parallel-rtw"].graph-flow-chosen',
        ),
      );
      click(theme.querySelector('.graph-trail button[aria-label^="Palaa:"]'));
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 1,
      );
      click(theme.querySelector('[aria-label="Eteenpäin polulla"]'));
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 2,
      );
      choose("☍ Solmuverkko");
      await until(() =>
        w.document.querySelector(
          '.organic-graph [data-path-active="true"][aria-label="Kestävä työhönpaluu"]',
        ),
      );
      const graph = w.document.querySelector(".organic-graph");
      assert.equal(
        graph.querySelector(".graph-summary li h4").textContent,
        "Vaihtoehtoinen kirjattu perustelu",
      );
      click(graph.querySelector("svg"));
      await pause(80);
      assert.equal(graph.querySelectorAll(".graph-summary li").length, 2);
      click(graph.querySelector('[role="button"][aria-label="Korjausvalta"]'));
      await until(
        () => graph.querySelectorAll(".graph-summary li").length === 1,
      );
      click(graph.querySelector('.graph-trail button[aria-label^="Palaa:"]'));
      await until(
        () =>
          graph.querySelector(".graph-summary li h4")?.textContent ===
          "Vaihtoehtoinen kirjattu perustelu",
      );
      choose("☊ Teemaverkko");
      await until(() =>
        theme.querySelector(
          '[data-path-active="true"][aria-label="Kestävä työhönpaluu"]',
        ),
      );
      assert.ok(
        theme.querySelector(
          '[data-flow-mechanism="parallel-rtw"].graph-flow-chosen',
        ),
      );
      click(theme.querySelector('.graph-trail button[aria-label^="Palaa:"]'));
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 1,
      );
      click(theme.querySelector(".graph-next-open"));
      await until(() => theme.querySelector(".graph-next.open"));
      click(
        [...theme.querySelectorAll(".graph-next li button")].find((b) =>
          b.textContent.includes("Vaihtoehtoinen kirjattu perustelu"),
        ),
      );
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 2,
      );
      assert.equal(
        theme.querySelector(".graph-summary li h4").textContent,
        "Vaihtoehtoinen kirjattu perustelu",
      );
      click(
        theme.querySelector('[role="button"][aria-label="Työpanoksen käyttö"]'),
      );
      await until(
        () => theme.querySelectorAll(".graph-summary li").length === 3,
      );
      assert.ok(
        theme.querySelector(
          '[data-flow-mechanism="parallel-rtw"].graph-flow-chosen',
        ),
        "the earlier mechanism remains drawn after leaving its neighbourhood",
      );
      assert.ok(
        theme.querySelector(
          '[data-flow-mechanism="rtw-to-input"].graph-flow-chosen',
        ),
      );
      choose("☍ Solmuverkko");
      await until(() =>
        graph.querySelector(
          '[data-path-active="true"][aria-label="Työpanoksen käyttö"]',
        ),
      );
      assert.equal(graph.querySelectorAll(".graph-summary li").length, 3);
      assert.ok(
        graph.querySelector(
          '[data-flow-mechanism="parallel-rtw"].graph-flow-chosen',
        ),
      );
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

test(
  "published cases, source depth, contextual choices and release notice work together",
  { timeout: 60000 },
  async () => {
    const { buildThemeCatalog } = await import("../src/lib/atlas.catalogue.ts");
    const snapshot = JSON.parse(
      await readFile(
        new URL("./fixtures/publication-input.json", import.meta.url),
        "utf8",
      ),
    );
    snapshot.publication = JSON.parse(
      await readFile(
        new URL("./fixtures/publication.json", import.meta.url),
        "utf8",
      ),
    );
    snapshot.generatedAt = snapshot.publication.generatedAt;
    snapshot.themeCatalog = buildThemeCatalog(
      {
        ...snapshot.atlas,
        evidence: snapshot.evidence,
        publication: snapshot.publication,
      },
      snapshot.themeCatalog,
      snapshot.generatedAt,
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
    const w = dom.window,
      checks = [];
    w.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    w.requestAnimationFrame = () => 1;
    w.cancelAnimationFrame = () => {};
    const setInterval = w.setInterval.bind(w);
    w.setInterval = (fn, delay) =>
      delay === 300000 ? (checks.push(fn), 999) : setInterval(fn, delay);
    w.fetch = async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("atlas-version.json")
          ? {
              schemaVersion: 1,
              generatedAt: "2026-11-16T12:00:00Z",
              version: "new",
            }
          : snapshot,
    });
    try {
      w.eval(await readFile(new URL(entry, dir), "utf8"));
      await until(() => w.document.querySelector(".view-switch"));
      const click = (node) => {
        assert.ok(node);
        node.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
      };
      const button = (scope, text) =>
        [...scope.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === text,
        );
      click(button(w.document.querySelector(".view-switch"), "☍ Solmuverkko"));
      await until(() => w.document.querySelector(".organic-graph"));
      const graph = w.document.querySelector(".organic-graph"),
        panel = () => graph.querySelector(".graph-evidence");
      click(
        graph.querySelector('[role="button"][aria-label="Työn mukauttaminen"]'),
      );
      await until(() => graph.querySelector(".graph-next-open"));
      click(graph.querySelector(".graph-next-open"));
      await until(() => graph.querySelector(".graph-next.open"));
      click(graph.querySelector(".graph-next .graph-evidence-link"));
      await until(() =>
        panel()?.textContent.includes("Tutki mekanismiin kirjattua väitettä"),
      );
      click(button(panel(), "Tutki mekanismiin kirjattua väitettä →"));
      await until(() =>
        panel()?.textContent.includes("Tukeva, haastava ja rajaava näyttö"),
      );
      const support = [...panel().querySelectorAll("article")].find(
        (a) => a.querySelector("h4")?.textContent === "Tukee",
      );
      assert.ok(support);
      click(support.querySelector("button"));
      await until(() => panel()?.textContent.includes("Tutkimusasetelma:"));
      const sourceButton = [...panel().querySelectorAll("button")].find(
        (b) =>
          !["Sulje perusteen tarkastelu", "← Edellinen taso"].includes(
            b.getAttribute("aria-label") ?? b.textContent.trim(),
          ),
      );
      click(sourceButton);
      await until(() =>
        panel()?.querySelector('a[href="https://www.sjweh.fi/article/3664"]'),
      );
      assert.equal(
        graph.querySelectorAll(".graph-summary:not(.graph-evidence) li").length,
        1,
        "source inspection preserves the graph route",
      );
      click(panel().querySelector('[aria-label="Sulje perusteen tarkastelu"]'));
      await until(() => !panel());
      click(
        button(
          graph.querySelector(".graph-context-tools"),
          "Tapaukset ja aineisto",
        ),
      );
      await until(() =>
        panel()?.textContent.includes("Dokumentoidut tapaukset"),
      );
      const documented = snapshot.publication.cases.find(
        (c) => c.case_id === "bsa-application-20261112",
      );
      click(button(panel(), documented.title + " →"));
      await until(() =>
        panel()?.textContent.includes("Helsingin historiallista havaintoa"),
      );
      const framework = snapshot.publication.frameworks[0];
      click(button(panel(), framework.title + " →"));
      await until(() =>
        panel()?.textContent.includes("Menettelyvaiheet ja niiden siirtymät"),
      );
      click(button(panel(), "Tieto ja ymmärtäminen →"));
      await until(() =>
        panel()?.textContent.includes("Kirjatut menettelysiirtymät"),
      );
      assert.ok(panel().textContent.includes("Tapauksiin kirjatut vastuut"));
      click(panel().querySelector('[aria-label="Sulje perusteen tarkastelu"]'));
      await until(() => !panel());
      click(
        button(graph.querySelector(".graph-context-tools"), "Rajaa tilannetta"),
      );
      await until(() => graph.querySelector(".graph-context-fields"));
      const fields = graph.querySelector(".graph-context-fields"),
        inputs = fields.querySelectorAll("input");
      const change = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(
          w.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(el, value);
        el.dispatchEvent(new w.Event("input", { bubbles: true }));
        el.dispatchEvent(new w.Event("change", { bubbles: true }));
      };
      change(inputs[0], "1900");
      change(inputs[1], "1901");
      await pause(80);
      const target = graph.querySelector(
        '[role="button"][aria-label="Kestävä työhönpaluu"]',
      );
      assert.equal(target.getAttribute("data-path-candidate"), "false");
      click(graph.querySelector(".graph-next-open"));
      await until(() => graph.querySelector(".graph-next.open"));
      const outgoing = [
        ...graph.querySelectorAll(".graph-next li button"),
      ].find((b) =>
        b
          .querySelector(".graph-next-target")
          ?.textContent.includes("Kestävä työhönpaluu"),
      );
      assert.ok(outgoing.disabled);
      assert.ok(
        graph
          .querySelector(".graph-next")
          .textContent.includes("Rajauksen ulkopuolella"),
      );
      click(graph.querySelector('[aria-label="Piilota etenemissuunnat"]'));
      change(inputs[0], "1850");
      change(inputs[1], "2050");
      await until(() => target.getAttribute("data-path-candidate") === "true");
      const populationSelect = fields.querySelectorAll("select")[0];
      populationSelect.value = [...populationSelect.options].find(
        (o) => o.value && o.value !== "Työlliset sairauspoissaolon alkaessa",
      ).value;
      populationSelect.dispatchEvent(new w.Event("change", { bubbles: true }));
      await pause(80);
      click(target);
      await until(() =>
        graph.querySelector('[aria-label="Tarkastelutilanteen muutos"]'),
      );
      click(
        button(
          graph.querySelector('[aria-label="Tarkastelutilanteen muutos"]'),
          "Jatka eri tarkastelutilanteeseen",
        ),
      );
      await until(() => target.getAttribute("data-path-active") === "true");
      click(graph.querySelector(".graph-summary-open"));
      await until(() =>
        graph.querySelector(".graph-summary.open:not(.graph-evidence)"),
      );
      assert.ok(
        graph
          .querySelector(".graph-summary.open")
          .textContent.includes("Tarkastelutilanne vaihtui"),
      );
      assert.equal(
        graph.querySelector("aside").getAttribute("aria-hidden"),
        "true",
      );
      assert.ok(checks.length > 0);
      await checks[0]();
      await until(() => w.document.querySelector(".atlas-release-notice"));
      assert.ok(
        w.document
          .querySelector(".atlas-release-notice")
          .textContent.includes("Lataa uusi aineistoversio"),
      );
      assert.equal(
        graph.querySelectorAll(".graph-summary:not(.graph-evidence) li").length,
        2,
        "a release notice does not replace the active snapshot",
      );
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  },
);

import { useLayoutEffect, useRef, useState } from "react";
import type { RoadmapSnapshot } from "@/lib/atlas.roadmap";

export const housingStory = [
  {
    year: 1950, label: "1950–1974", chain: "maaltamuutto-kaupungistuminen-1950",
    title: "Työpaikat ja asuminen",
    text: "Työn perässä muuttaminen saattoi avata uusia työmahdollisuuksia. Kasvukeskukseen asettuminen edellytti myös asuntoa.",
  },
  {
    year: 1968, label: "1968–1985", chain: "peruskoulu-uudistus-1968",
    title: "Yhteinen peruskoulu",
    text: "Samaan aikaan yhteinen peruskoulu muutti koulutuspolkuja. Uudistus toteutettiin alueittain.",
  },
  {
    year: 1974, label: "1970-luku · tulkinta", chain: "muuttoliike-siirtolaisuus-paluumuutto",
    title: "Mitä asuinpaikka yhä ratkaisi?",
    text: "Koulutusmahdollisuuksia, työpaikan sijaintia ja muuton edellytyksiä on tarkasteltava erikseen. Alueittainen uudistus auttaa kysymään, miten nämä ehdot vaihtelivat.",
  },
] as const;

function sourceUrl(value: unknown) {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return;
  }
}

type Point = { x: number; y: number };

export function RoadmapStory({ anchors, snapshot, onClose }: {
  anchors: Point[];
  snapshot?: RoadmapSnapshot;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [lines, setLines] = useState<{ from: Point; to: Point }[]>([]);
  const [basis, setBasis] = useState<number | null>(null);
  useLayoutEffect(() => {
    const overlay = root.current;
    if (!overlay) return;
    const measure = () => {
      const bounds = overlay.getBoundingClientRect();
      const factor = Math.max(bounds.width / 1600, bounds.height / 1000);
      setLines(anchors.flatMap((anchor, i) => {
        const card = cards.current[i]?.getBoundingClientRect();
        if (!card || !factor) return [];
        const to = {
          x: anchor.x * factor + (bounds.width - 1600 * factor) / 2,
          y: anchor.y * factor + (bounds.height - 1000 * factor) / 2,
        };
        return [{ from: { x: card.left - bounds.left + card.width / 2, y: card.bottom - bounds.top }, to }];
      }));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(overlay);
    cards.current.forEach((card) => { if (card) observer?.observe(card); });
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [anchors, basis]);

  return (
    <div className="rm-story" ref={root}>
      <svg className="rm-leaders" aria-hidden="true">
        {lines.map(({ from, to }, i) => (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <circle cx={to.x} cy={to.y} r={4} />
          </g>
        ))}
      </svg>
      <section className="rm-story-content" aria-label="Asuinpaikka, koulutus ja työ">
        <header>
          <h2>Miten asuinpaikka vaikutti opiskeluun ja työhön?</h2>
          <button type="button" onClick={onClose}>Sulje ketju</button>
        </header>
        <ol>
          {housingStory.map((step, i) => {
            const chain = snapshot?.chains.find((item) => item.chain_id === step.chain);
            const evidence = snapshot?.details?.filter((item) => item.chain_id === step.chain && item.detail_kind === "evidence") ?? [];
            return (
              <li key={step.chain} ref={(node) => { cards.current[i] = node; }}>
                <span className="rm-story-year">{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <button type="button" aria-expanded={basis === i} aria-controls={`rm-story-basis-${i}`}
                  onClick={() => setBasis(basis === i ? null : i)}>Mihin tämä perustuu?</button>
                <div id={`rm-story-basis-${i}`} className="rm-story-basis" hidden={basis !== i}>
                  {chain && <p><strong>{chain.title}</strong><br />{chain.observed_change}</p>}
                  {evidence.length === 0 && <p>Tähän ketjuun ei ole liitetty julkaistuja havaintoja tai lähteitä.</p>}
                  {evidence.map(({ detail, detail_id }) => {
                    const url = sourceUrl(detail.source_url);
                    const title = typeof detail.source_title === "string" ? detail.source_title : "Lähde";
                    const note = detail.finding ?? detail.rationale;
                    return <p key={detail_id}>
                      {url ? <a href={url} target="_blank" rel="noreferrer">{title}</a> : <strong>{title}</strong>}
                      {typeof detail.locator === "string" && <small> · {detail.locator}</small>}
                      {typeof note === "string" && <><br />{note}</>}
                    </p>;
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

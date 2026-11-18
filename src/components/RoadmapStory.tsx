import { useLayoutEffect, useRef, useState } from "react";
import type { RoadmapSnapshot } from "@/lib/atlas.roadmap";

export type StageCard = { id: string; label: string; title: string; text?: string };

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

export function RoadmapStory({ title, cards: items, anchors, snapshot, onClose, page, pageCount, onPage }: {
  title: string;
  cards: StageCard[];
  anchors: Point[];
  snapshot?: RoadmapSnapshot;
  onClose: () => void;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
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
      <section className="rm-story-content" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>Sulje etappi</button>
        </header>
        <ol>
          {items.map((step, i) => {
            const evidence = snapshot?.details?.filter((item) => item.chain_id === step.id && item.detail_kind === "evidence") ?? [];
            return (
              <li key={step.id} ref={(node) => { cards.current[i] = node; }}>
                <span className="rm-story-year">{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {i > 0 && <button type="button" aria-expanded={basis === i} aria-controls={`rm-story-basis-${i}`}
                  onClick={() => setBasis(basis === i ? null : i)}>Mihin tämä perustuu?</button>}
                <div id={`rm-story-basis-${i}`} className="rm-story-basis" hidden={basis !== i}>

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
        {pageCount > 1 && <nav className="rm-story-pages" aria-label="Etapin kaistat">
          <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Edelliset kaistat</button>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => onPage(page + 1)}>Seuraavat kaistat</button>
        </nav>}
        {pageCount === 0 && snapshot && <p>Tälle etapille ei ole linkitetty kartalla näkyviä teemakaistoja.</p>}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getRoadmap } from "@/lib/atlas.static";
import type { RoadmapSnapshot } from "@/lib/atlas.roadmap";
import { STAGE_OBSERVATIONS, type ObservationKind } from "@/lib/roadmap.observations";

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const COLORS = ["", "#e5ae7c", "#7ad7ea", "#9befcd", "#c9b2ff", "#f6ac9f"];
const SHORT = (title: string) => title.replace(/^Pää(?:ketju|reitti) [IVX]+:\s*/i, "").replace(/^\d{4}(?:–\d{4})?:\s*/, "");
const W = 900, H = 500, CX = 450, HORIZON = 140;
const depth = (offset: number) => HORIZON + 225 / (1 + offset * 0.52);
const roadX = (y: number) => CX + 16 * Math.sin((y - HORIZON) / 49);
const PATH = Array.from({ length: 35 }, (_, i) => {
  const y = HORIZON + i * 10;
  return `${i === 0 ? "M" : "L"}${roadX(y)},${y}`;
}).join(" ");

const CSS = `
.atlas-bridge{position:fixed;inset:0;z-index:60;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#06131e;color:#edf8fa;overflow:auto;font:15px/1.45 system-ui,sans-serif}
.ab-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px clamp(12px,4vw,44px);background:#09141e;border-bottom:1px solid #2c4755}
.ab-head h1{font-size:19px;margin:0}.ab-head button,.ab-deck button,.ab-marks button{background:#0e2130;border:1px solid #4b6775;color:inherit;border-radius:7px;padding:6px 10px;cursor:pointer}
.ab-head button:focus-visible,.ab-deck button:focus-visible,.ab-marks button:focus-visible,.ab-view [role=button]:focus-visible{outline:2px solid #c0fff0;outline-offset:3px}
.ab-window{position:relative;min-height:275px;overflow:hidden;background:linear-gradient(180deg,#071928 0%,#223d53 26%,#487078 29%,#122d40 30%,#081d2d 76%,#071421 100%)}
.ab-window::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 18px 0 #09141e,inset 0 -18px 22px #06121b}
.ab-view{display:block;width:100%;height:100%;position:absolute;inset:0}
.ab-view [role=button]{cursor:pointer}.ab-view [role=button]:hover circle{stroke:white}
.ab-view text{paint-order:stroke;stroke:#102431;stroke-width:3px;stroke-linejoin:round}
.ab-marks{position:absolute;inset:24px 12px 22px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;pointer-events:none;z-index:1;text-align:center}
.ab-marks button{pointer-events:auto;font-size:13px}.ab-marks button[aria-pressed=true]{background:#d0f7e5;color:#082119}
.ab-marks .ab-difficulty{color:#ffd0a6}.ab-marks .ab-difficulty[aria-pressed=true]{background:#ffd0a6;color:#2c1709}
.ab-deck{padding:8px clamp(12px,4vw,44px) 14px;border-top:2px solid #304a5a;background:#0a1723;display:grid;gap:7px}
.ab-now{display:flex;justify-content:center;align-items:center;gap:10px;text-align:center}.ab-now button:disabled{opacity:.35;cursor:default}
.ab-now h2{font-size:clamp(15px,2.1vw,23px);margin:0}.ab-now span{font-size:12px;color:#a8c4cd}
.ab-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;font-size:12px;color:#c6dce3}
.ab-legend span::before{content:"";display:inline-block;width:13px;margin-right:5px;border-top:2px solid var(--ab-lane);vertical-align:middle}
.ab-legend span[data-context=true]::before{border-top-style:dashed}
.ab-timeline{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;color:#bcd4dc;font-size:12px}.ab-timeline input{width:100%;accent-color:#a8f2d1}
.ab-routes{display:flex;justify-content:center;gap:5px}.ab-routes button{padding:3px 10px;border-color:var(--ab-route);color:var(--ab-route);font-size:12px}.ab-routes button[aria-current=true]{box-shadow:inset 0 0 0 1px currentColor}
.ab-effect{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:7px;font-size:12px;color:#d7efe8}.ab-effect a{text-decoration:underline}
.ab-message{padding:24px}
@media(max-width:600px){.ab-head{padding:8px 12px}.ab-head h1{font-size:16px}.ab-deck{gap:5px}.ab-view text{font-weight:600}.ab-marks{inset:19px 8px 15px}.ab-marks button{font-size:12px}}
`;

type Stage = RoadmapSnapshot["stages"][number] & { start_year: number };
type Lane = { id: string; label: string; context: boolean };
const stageKey = (s: Stage) => `${s.route_order}:${s.state_id}`;

export function BridgeView({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RoadmapSnapshot>();
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [effect, setEffect] = useState<ObservationKind | null>(null);

  const stages = (data?.stages ?? []).filter((s): s is Stage => s.start_year != null)
    .sort((a, b) => a.start_year - b.start_year || a.route_order - b.route_order || a.sequence_no - b.sequence_no);
  const stage = stages[index];
  const jump = (next: number) => {
    if (next < 0 || next >= stages.length) return;
    setIndex(next);
    setEffect(null);
  };

  useEffect(() => {
    let active = true;
    getRoadmap().then((snapshot) => {
      if (!active) return;
      if (!snapshot?.stages.some((s) => s.start_year != null)) { setFailed(true); return; }
      const dated = snapshot.stages.filter((s) => s.start_year != null)
        .sort((a, b) => a.start_year! - b.start_year! || a.route_order - b.route_order || a.sequence_no - b.sequence_no);
      setIndex(Math.max(0, dated.findIndex((s) => s.route_order === 3 && s.start_year === 1945)));
      setData(snapshot);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const route = data?.routes.find((r) => r.route_order === stage?.route_order);
  const gate = data?.boundaries.filter((b) => b.boundary_year > (stage?.start_year ?? 0))
    .sort((a, b) => a.boundary_year - b.boundary_year)[0];
  const linked = new Set(data?.links?.filter((l) => l.parent_phenomenon_id === route?.phenomenon_id
    && l.parent_state_id === stage?.state_id).map((l) => l.chain_id));
  const observations = stage && STAGE_OBSERVATIONS[`${stage.route_order}:${stage.start_year}`];
  const available = (kind: ObservationKind) => {
    const item = observations && observations[kind];
    if (!item) return undefined;
    const url = data?.details?.find((d) => d.chain_id === item.chain && d.detail_id === item.source)?.detail.source_url;
    return typeof url === "string" && /^https?:\/\//i.test(url) ? { ...item, url } : undefined;
  };
  const strength = available("strength"), difficulty = available("difficulty");
  const selected = effect === "strength" ? strength : effect === "difficulty" ? difficulty : undefined;
  const lanes: Lane[] = stage ? (data?.chains ?? []).filter((c) => selected ? c.chain_id === selected.chain :
    linked.has(c.chain_id) || (c.route_orders.includes(stage.route_order) && c.start_year != null
      && c.start_year <= (stage.end_year ?? stage.start_year) && (c.end_year ?? c.start_year) >= stage.start_year))
    .sort((a, b) => Number(linked.has(b.chain_id)) - Number(linked.has(a.chain_id))
      || Math.abs((a.start_year ?? Infinity) - stage.start_year) - Math.abs((b.start_year ?? Infinity) - stage.start_year))
    .slice(0, 3).map((c) => ({ id: c.chain_id, label: SHORT(c.title).split(":")[0], context: !linked.has(c.chain_id) })) : [];
  const laneColors = selected ? [effect === "difficulty" ? "#ffc592" : "#bff6cf"] : ["#79d8e6", "#d5b9fb", "#f2ba86"];
  const color = COLORS[stage?.route_order ?? 0] || "#a6e6d4";

  return (
    <section className="atlas-bridge" role="dialog" aria-label="Komentosilta"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); effect ? setEffect(null) : onClose(); }
        if (event.target instanceof HTMLInputElement) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          jump(index + (event.key === "ArrowLeft" ? -1 : 1));
        }
      }}>
      <style>{CSS}</style>
      <header className="ab-head">
        <button type="button" autoFocus onClick={onClose} aria-label="Sulje komentosilta">← Atlas</button>
        <h1>Komentosilta</h1>
        <span>{stage ? `Reitti ${ROMAN[stage.route_order]}` : ""}</span>
      </header>
      {!stage && <p className="ab-message" role="status">{failed ? "Komentosillan aineistoa ei saatu ladattua." : "Ladataan väylää…"}</p>}
      {stage && <>
        <div className="ab-window">
          <svg className="ab-view" viewBox={`0 0 ${W} ${H}`} aria-label="Tulevat etapit kohti horisonttia">
            <defs>
              <linearGradient id="ab-water" x2="0" y2="1">
                <stop stopColor={color} stopOpacity=".05" /><stop offset="1" stopColor={color} stopOpacity=".28" />
              </linearGradient>
            </defs>
            <path d="M0 140H900" stroke="#bde3df" opacity=".4" />
            <path d="M315 500 Q325 325 450 140 Q528 309 585 500Z" fill="url(#ab-water)" stroke={color} strokeOpacity=".35" />
            <path d={PATH} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 9" opacity=".85" />
            {lanes.map(({ id, context }, i) => {
              const offset = (i % 2 === 0 ? -1 : 1) * (145 + Math.floor(i / 2) * 85);
              return <path key={id} d={`M${CX + offset * 1.5} 500 Q${CX + offset * .76} 290 ${CX + offset * .12} 140`}
                fill="none" stroke={laneColors[i]} strokeWidth={selected ? 5 : 2} strokeDasharray={context && !selected ? "5 5" : undefined} />;
            })}
            {gate && <g fill="#e3f7f4" textAnchor="middle">
              <path d="M409 150V110H491V150" fill="none" stroke="#b7e2ef" />
              <text x="450" y="103" fontSize="16">{gate.boundary_year}</text>
              <text x="450" y="82" fontSize="14">Seuraava aikakausiraja</text>
            </g>}
            {stages.slice(index + 1, index + 4).map((item, i) => {
              const y = depth(i + 1), x = roadX(y), side = i % 2 === 0 ? 1 : -1;
              return <g key={stageKey(item)} role="button" tabIndex={0}
                aria-label={`${item.start_year} ${SHORT(item.title)}`} onClick={() => jump(index + i + 1)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(index + i + 1); } }}>
                <circle cx={x} cy={y} r="15" fill="transparent" />
                <circle cx={x} cy={y} r={7 - i} fill={COLORS[item.route_order]} stroke="#142f40" strokeWidth="2" />
                <text x={x + side * 16} y={y + 5} textAnchor={side > 0 ? "start" : "end"} fontSize={16 - i} fill="#ecf9f7">
                  {item.start_year} · {SHORT(item.title).slice(0, 31)}{SHORT(item.title).length > 31 ? "…" : ""}
                </text>
              </g>;
            })}
            <circle cx={roadX(depth(0))} cy={depth(0)} r="10" fill={color} stroke="#163746" strokeWidth="3" />
            <text x={roadX(depth(0))} y={depth(0) + 36} textAnchor="middle" fontSize="21" fill={color}>{stage.start_year}</text>
            {index > 0 && <text x={roadX(430)} y="430" textAnchor="middle" fontSize="13" fill="#a8c4cd">
              Takana · {stages[index - 1].start_year}
            </text>}
            <path d="M0 480L105 446H795L900 480V500H0Z" fill="#0a1723" stroke="#2b4656" strokeWidth="2" />
          </svg>
          <div className="ab-marks">
            <div>{strength && <button type="button" aria-pressed={effect === "strength"}
              onClick={() => setEffect(effect === "strength" ? null : "strength")}>Vahvuus · {strength.label}</button>}</div>
            <div>{difficulty && <button type="button" className="ab-difficulty" aria-pressed={effect === "difficulty"}
              onClick={() => setEffect(effect === "difficulty" ? null : "difficulty")}>Vaikeus · {difficulty.label}</button>}</div>
          </div>
        </div>
        <footer className="ab-deck">
          <div className="ab-now">
            <button type="button" disabled={index === 0} onClick={() => jump(index - 1)} aria-label="Edellinen etappi">←</button>
            <div><span>{route ? SHORT(route.title) : ""}</span><h2>{SHORT(stage.title)}</h2></div>
            <button type="button" disabled={index === stages.length - 1} onClick={() => jump(index + 1)} aria-label="Seuraava etappi">→</button>
          </div>
          {selected ? <div className="ab-effect">
            <span>{selected.years[0]} · {selected.points[0]}</span><span aria-hidden="true">—</span>
            <span>{selected.years[1]} · {selected.points[1]}</span>
            <a href={selected.url} target="_blank" rel="noreferrer">Lähde</a>
          </div> : <div className="ab-legend" aria-label="Teemakaistat">
            {lanes.map((lane, i) => <span key={lane.id} data-context={lane.context}
              style={{ "--ab-lane": laneColors[i] } as React.CSSProperties}>
              {lane.label}{lane.context ? " · samanaikainen" : ""}
            </span>)}
          </div>}
          <label className="ab-timeline"><span>1500</span>
            <input type="range" min="1500" max="2050" value={stage.start_year}
              aria-label="Aikajana" aria-valuetext={`${stage.start_year}: ${SHORT(stage.title)}`}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                jump(index + (event.key === "ArrowLeft" ? -1 : 1));
              }}
              onChange={(event) => {
                const year = Number(event.target.value);
                const next = stages.reduce((best, item, i) => Math.abs(item.start_year - year) < Math.abs(stages[best].start_year - year) ? i : best, index);
                jump(next);
              }} />
            <span>2050</span>
          </label>
          <nav className="ab-routes" aria-label="Pääreitit">
            {data?.routes.map((item) => <button key={item.phenomenon_id} type="button"
              aria-label={SHORT(item.title)} aria-current={item.route_order === stage.route_order}
              style={{ "--ab-route": COLORS[item.route_order] } as React.CSSProperties}
              onClick={() => jump(stages.findIndex((s) => s.route_order === item.route_order))}>{ROMAN[item.route_order]}</button>)}
          </nav>
        </footer>
      </>}
    </section>
  );
}

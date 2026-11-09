import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AtlasData, Conclusion } from "@/lib/atlas.functions";
import { getTreatments } from "@/lib/atlas.static";

const KINDS = [
  { key: "synteesi", label: "Synteesi", short: "S", color: "var(--kind-synth)" },
  { key: "hypoteesi / ajallisesti todennettava väite", label: "Hypoteesi", short: "H", color: "var(--kind-hypo)" },
  { key: "arviointiperiaate", label: "Arviointiperiaate", short: "P", color: "var(--kind-principle)" },
];
const kindOf = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[0]!;

const SIZE = 840, C = SIZE / 2, R0 = 118, R1 = 392, GAP_DEG = 2.2;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}
function arc(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/** The original radial atlas view with its filter column, insight lists and conclusion detail panel. */
export function RadialAtlas({ data }: { data: AtlasData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ c: number; p: string } | null>(null);
  const [kinds, setKinds] = useState<Set<string>>(new Set(KINDS.map((k) => k.key)));
  const [showContext, setShowContext] = useState(true);
  const [period, setPeriod] = useState<string | null>(null);
  const model = useMemo(() => buildModel(data, showContext), [data, showContext]);
  const sel = selected != null ? data.conclusions.find((c) => c.id === selected) ?? null : null;
  return (
      <main className="grid gap-0 lg:grid-cols-[260px_1fr_400px]">
        <aside className="space-y-6 border-b border-border p-6 lg:border-b-0 lg:border-r">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Päätelmän laji</h2>
            {KINDS.map((k) => (
              <label key={k.key} className="mb-2 flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" className="accent-primary" checked={kinds.has(k.key)}
                  onChange={() => { const n = new Set(kinds); n.has(k.key) ? n.delete(k.key) : n.add(k.key); setKinds(n); }} />
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: k.color }} />
                {k.label}
                <span className="ml-auto text-muted-foreground">{data.conclusions.filter((c) => c.kind === k.key).length}</span>
              </label>
            ))}
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="accent-primary" checked={showContext} onChange={(e) => setShowContext(e.target.checked)} />
              Laske myös taustoittavat kytkennät (½)
            </label>
          </section>

          <InsightList title="Nykytilaan johtavat" subtitle="Eniten vahvistuneet 1990–2009 → 2010–2025"
            items={model.rising} conclusions={data.conclusions} onPick={(id) => { setSelected(id); setPeriod(null); }} selected={selected} />
          <InsightList title="Tulevaisuuden näkymät" subtitle="Vahvimmin 2026–2050 skenaarioihin kytketyt"
            items={model.future} conclusions={data.conclusions} onPick={(id) => { setSelected(id); setPeriod(null); }} selected={selected} />

          <p className="text-xs leading-relaxed text-muted-foreground">
            ◇ merkitsee vastanäyttöä. Katkoviivainen sektori 2026–2050 on skenaarioita. Renkaat on ryhmitelty lajeittain sisältä ulos.
          </p>
        </aside>

        <section className="relative flex items-start justify-center p-4 lg:sticky lg:top-0 lg:self-start">
          <div className="w-full max-w-[860px]">
              <RadialAtlasChart data={data} model={model} kinds={kinds} selected={selected} hover={hover}
                onHover={setHover} onSelect={(id) => { setSelected(id === selected ? null : id); setPeriod(null); }} />
          </div>
          {hover && <HoverCard data={data} model={model} hover={hover} />}
        </section>
        <aside className="border-t border-border p-6 lg:border-l lg:border-t-0">
          {sel ? <ConclusionDetail key={sel.id} c={sel} data={data} model={model} period={period} onPeriod={setPeriod} onClose={() => { setSelected(null); setPeriod(null); }} /> : <Intro data={data} model={model} />}
        </aside>
      </main>
  );
}

type Model = ReturnType<typeof buildModel>;
function buildModel(data: AtlasData, ctx: boolean) {
  const key = (c: number, p: string) => `${c}|${p}`;
  const cells = new Map<string, { v: number; direct: number; context: number; counter: number; articles: number }>();
  let max = 0, totalDirect = 0;
  for (const x of data.cells) {
    const v = x.direct + (ctx ? x.context * 0.5 : 0);
    cells.set(key(x.c, x.p), { v, direct: x.direct, context: x.context, counter: x.counter, articles: x.articles });
    max = Math.max(max, v); totalDirect += x.direct;
  }
  const get = (c: number, p: string) => cells.get(key(c, p)) ?? { v: 0, direct: 0, context: 0, counter: 0, articles: 0 };
  const order = [...data.conclusions].sort((a, b) =>
    KINDS.findIndex((k) => k.key === a.kind) - KINDS.findIndex((k) => k.key === b.kind) || a.id - b.id);
  const periodTotals = data.periods.map((p) => data.conclusions.reduce((s, c) => s + get(c.id, p.id).v, 0));
  const rising = data.conclusions
    .map((c) => ({ id: c.id, score: get(c.id, "p6").v - get(c.id, "p5").v }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  const future = data.conclusions
    .map((c) => ({ id: c.id, score: get(c.id, "p7").v }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  return { get, max: max || 1, order, periodTotals, rising, future, totalDirect };
}

function RadialAtlasChart({ data, model, kinds, selected, hover, onHover, onSelect }: {
  data: AtlasData; model: Model; kinds: Set<string>; selected: number | null;
  hover: { c: number; p: string } | null; onHover: (h: { c: number; p: string } | null) => void; onSelect: (id: number) => void;
}) {
  const n = data.periods.length, span = 360 / n;
  const groupGap = 6;
  const rings = model.order;
  const groups = KINDS.filter((k) => rings.some((r) => r.kind === k.key)).length;
  const ringH = (R1 - R0 - groupGap * (groups - 1)) / rings.length;
  const radii = new Map<number, [number, number]>();
  let r = R0, prevKind = rings[0]?.kind;
  for (const c of rings) {
    if (c.kind !== prevKind) { r += groupGap; prevKind = c.kind; }
    radii.set(c.id, [r, r + ringH]); r += ringH;
  }
  const focus = hover?.c ?? selected;
  const maxTot = Math.max(...model.periodTotals, 1);

  return (
    <svg viewBox={`-50 -20 ${SIZE + 100} ${SIZE + 40}`} className="h-auto w-full max-w-[860px]" role="img"
      aria-label="Säteittäinen kuvaaja päätelmistä aikakausittain" onMouseLeave={() => onHover(null)}>
      <defs>
        <radialGradient id="glow"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></radialGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeOpacity="0.25" strokeWidth="1" />
        </pattern>
      </defs>
      <circle cx={C} cy={C} r={R1 + 40} fill="url(#glow)" />

      {data.periods.map((p, i) => {
        const a0 = i * span + GAP_DEG / 2, a1 = (i + 1) * span - GAP_DEG / 2;
        const future = p.start >= 2026;
        const tot = (model.periodTotals[i] ?? 0) / maxTot;
        const [lx, ly] = polar(R1 + 26, (a0 + a1) / 2);
        return (
          <g key={p.id}>
            {future && <path d={arc(R0, R1, a0, a1)} fill="url(#hatch)" stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeDasharray="4 4" />}
            <path d={arc(R1 + 6, R1 + 6 + 10 * tot, a0, a1)} fill="var(--primary)" opacity={0.55} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-display" fontSize="15">{p.label}</text>
            <text x={lx} y={ly + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
              {future ? "skenaariot" : `${p.coverage.A + p.coverage.K + p.coverage.S} artikkelijaksoa`}
            </text>
          </g>
        );
      })}

      {rings.map((c) => {
        const [r0, r1] = radii.get(c.id)!;
        const k = kindOf(c.kind);
        const active = kinds.has(c.kind);
        const dim = focus != null && focus !== c.id;
        return (
          <g key={c.id} opacity={!active ? 0.06 : dim ? 0.28 : 1}>
            {data.periods.map((p, i) => {
              const a0 = i * span + GAP_DEG / 2, a1 = (i + 1) * span - GAP_DEG / 2;
              const cell = model.get(c.id, p.id);
              const t = Math.sqrt(cell.v / model.max);
              const mid = (a0 + a1) / 2;
              return (
                <g key={p.id}>
                  <path d={arc(r0 + 0.4, r1 - 0.4, a0, a1)}
                    fill={cell.v > 0 ? k.color : "var(--muted)"} fillOpacity={cell.v > 0 ? 0.12 + 0.88 * t : 0.35}
                    stroke={selected === c.id ? "var(--foreground)" : "none"} strokeWidth={0.6}
                    className="cursor-pointer transition-[fill-opacity]"
                    onMouseEnter={() => active && onHover({ c: c.id, p: p.id })}
                    onClick={() => active && onSelect(c.id)} />
                  {cell.counter > 0 && (() => { const [x, y] = polar((r0 + r1) / 2, mid); return <rect x={x - 2.5} y={y - 2.5} width={5} height={5} transform={`rotate(45 ${x} ${y})`} fill="var(--warning)" pointerEvents="none" />; })()}
                </g>
              );
            })}
          </g>
        );
      })}

      <CenterReadout data={data} model={model} focus={focus} />
    </svg>
  );
}

function CenterReadout({ data, model, focus }: { data: AtlasData; model: Model; focus: number | null }) {
  const c = focus != null ? data.conclusions.find((x) => x.id === focus) : null;
  const vals = data.periods.map((p, i) => (c ? model.get(c.id, p.id).v : model.periodTotals[i] ?? 0));
  const mx = Math.max(...vals, 1);
  const w = 150, h = 46, x0 = C - w / 2, y0 = C + 4;
  const pts = vals.map((v, i) => `${x0 + (i / (vals.length - 1)) * w},${y0 + h - (v / mx) * h}`);
  const color = c ? kindOf(c.kind).color : "var(--primary)";
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={R0 - 8} fill="var(--card)" stroke="var(--border)" />
      <text x={C} y={C - 50} textAnchor="middle" className="fill-muted-foreground" fontSize="10" letterSpacing="2">
        {c ? `PÄÄTELMÄ ${c.id}` : "KOKO AINEISTO"}
      </text>
      <text x={C} y={C - 22} textAnchor="middle" className="fill-foreground font-display" fontSize="26">
        {c ? Math.round(vals.reduce((a, b) => a + b, 0)) : model.totalDirect}
      </text>
      <text x={C} y={C - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="9">painotettua kytkentää · kaari ajassa</text>
      <polyline points={pts.slice(0, 6).join(" ")} fill="none" stroke={color} strokeWidth={2} />
      <polyline points={pts.slice(5).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" />
      {pts.map((p, i) => { const [x, y] = p.split(",").map(Number); return <circle key={i} cx={x} cy={y} r={2.4} fill={color} />; })}
      <text x={x0} y={y0 + h + 12} className="fill-muted-foreground" fontSize="8">1850</text>
      <text x={x0 + w} y={y0 + h + 12} textAnchor="end" className="fill-muted-foreground" fontSize="8">2050</text>
    </g>
  );
}

function HoverCard({ data, model, hover }: { data: AtlasData; model: Model; hover: { c: number; p: string } }) {
  const c = data.conclusions.find((x) => x.id === hover.c);
  const p = data.periods.find((x) => x.id === hover.p);
  if (!c || !p) return null;
  const cell = model.get(c.id, p.id);
  return (
    <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg border border-border bg-popover/95 p-3 text-sm shadow-xl backdrop-blur">
      <div className="text-xs text-muted-foreground">{p.label} · {kindOf(c.kind).label}</div>
      <div className="mt-1 font-display leading-snug">{c.title}</div>
      <div className="mt-2 flex gap-3 text-xs">
        <span><b className="text-primary">{cell.direct}</b> suoraa</span>
        <span><b>{cell.context}</b> taustoittavaa</span>
        {cell.counter > 0 && <span className="text-warning">{cell.counter} vastanäyttöä</span>}
        <span className="text-muted-foreground">{cell.articles} artikkelia</span>
      </div>
    </div>
  );
}

function InsightList({ title, subtitle, items, conclusions, onPick, selected }: {
  title: string; subtitle: string; items: { id: number; score: number }[]; conclusions: Conclusion[];
  onPick: (id: number) => void; selected: number | null;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      <p className="mb-2 text-xs text-muted-foreground/80">{subtitle}</p>
      <ul className="space-y-1">
        {items.map((it) => {
          const c = conclusions.find((x) => x.id === it.id)!;
          return (
            <li key={it.id}>
              <button onClick={() => onPick(it.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-accent ${selected === it.id ? "bg-accent" : ""}`}>
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: kindOf(c.kind).color }} />
                <span className="flex-1">{c.title}</span>
                <span className="text-primary">+{it.score.toFixed(it.score % 1 ? 1 : 0)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Intro({ data, model }: { data: AtlasData; model: Model }) {
  const peak = model.periodTotals.indexOf(Math.max(...model.periodTotals));
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <h2 className="font-display text-2xl">Miten luet atlasta</h2>
      <p className="text-muted-foreground">
        Aika kiertää myötäpäivään vuodesta 1850. Ulkokehän palkki näyttää, kuinka paljon selitystyötä kullekin aikakaudelle on kohdistunut;
        tiheimmin aineisto käsittelee jaksoa <b className="text-foreground">{data.periods[peak]?.label}</b>.
      </p>
      <p className="text-muted-foreground">
        Seuraa yhtä rengasta ympäri: näet, milloin päätelmä syntyy, missä se vahvistuu ja ulottuuko se skenaarioihin.
        Vasemman laidan listat nostavat esiin päätelmät, jotka selittävät nykytilaa ja ennakoivat tulevaa.
      </p>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Jaksojen kattavuus artikkeleissa</div>
        <div className="mt-3 space-y-2">
          {data.periods.map((p) => {
            const t = p.coverage.A + p.coverage.K + p.coverage.S || 1;
            return (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-muted-foreground">{p.label}</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div style={{ width: `${(p.coverage.A / t) * 100}%`, background: "var(--primary)" }} />
                  <div style={{ width: `${(p.coverage.K / t) * 100}%`, background: "var(--kind-hypo)" }} />
                  <div style={{ width: `${(p.coverage.S / t) * 100}%`, background: "var(--muted-foreground)" }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Käsittelykoodit A / K / S sellaisina kuin ne on kirjattu aineistoon.</p>
      </div>
      <p className="text-xs text-muted-foreground">Valitse rengas tai päätelmä listasta nähdäksesi sen näytön artikkeleittain.</p>
    </div>
  );
}

const REL: Record<string, string> = { direct: "Suora", context: "Taustoittava", counterevidence: "Vastanäyttö" };

function ConclusionDetail({ c, data, model, onClose, period, onPeriod }: { c: Conclusion; data: AtlasData; model: Model; onClose: () => void; period: string | null; onPeriod: (p: string | null) => void }) {
  const k = kindOf(c.kind);
  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["static-treatments", c.id],
    queryFn: () => getTreatments({ data: { conclusionId: c.id } }),
  });

  const mx = Math.max(...data.periods.map((p) => model.get(c.id, p.id).v), 1);
  const shown = (rows ?? []).filter((r) => !period || r.periodId === period);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: k.color, color: k.color }}>{k.label} · #{c.id}</span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Sulje ✕</button>
      </div>
      <h2 className="font-display text-2xl leading-tight">{c.title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{c.claim}</p>

      <div className="flex items-end gap-1.5">
        {data.periods.map((p) => {
          const cell = model.get(c.id, p.id);
          const on = period === p.id;
          return (
            <button key={p.id} onClick={() => onPeriod(on ? null : p.id)} className="group flex flex-1 flex-col items-center gap-1" title={p.label}>
              <div className="flex h-16 w-full items-end">
                <div className={`w-full rounded-t ${p.start >= 2026 ? "border border-dashed" : ""}`}
                  style={{ height: `${Math.max(3, (cell.v / mx) * 100)}%`, background: k.color, opacity: on || !period ? 1 : 0.35, borderColor: k.color }} />
              </div>
              <span className={`text-[10px] ${on ? "text-foreground" : "text-muted-foreground"}`}>{p.start}</span>
            </button>
          );
        })}
      </div>

      {c.limitations && <p className="border-l-2 border-warning pl-3 text-xs text-muted-foreground"><b className="text-foreground">Rajaukset:</b> {c.limitations}</p>}

      <p className="text-xs text-muted-foreground">{period ? `Valittu aikakausi: ${data.periods.find(p=>p.id===period)?.label}` : "Kaikki aikakaudet"}. {period && <button className="underline" onClick={()=>onPeriod(null)}>Näytä kaikki aikakaudet</button>}</p>
      <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
        {isLoading && <p className="text-sm text-muted-foreground">Ladataan näyttöä…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {rows && shown.length === 0 && <p className="text-sm text-muted-foreground">Ei kytkentöjä valitulla jaksolla.</p>}
        {shown.map((r, i) => (
          <article key={i} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{data.periods.find((p) => p.id === r.periodId)?.label} · art. {r.articleNo}</span>
              <span className={r.relation === "direct" ? "text-primary" : r.relation === "counterevidence" ? "text-warning" : ""}>{REL[r.relation] ?? r.relation}</span>
            </div>
            <h3 className="mt-1 font-display text-sm">{r.articleTitle}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Tarkistuksen tila: {({accepted:"hyväksytty",needs_review:"odottaa tarkistusta",draft:"luonnos",in_review:"tarkistuksessa",rejected:"hylätty"} as Record<string,string>)[r.reviewStatus || ""] || r.reviewStatus || "ei ilmoitettu"}</p>
            {r.limitations && <p className="mt-1 border-l border-warning pl-2 text-xs text-muted-foreground">Rajaus: {r.limitations}</p>}
            {!!r.concepts?.length && <p className="mt-1 text-xs text-muted-foreground">Kirjatut avainkäsitteet: {r.concepts.join("; ")}</p>}
            {r.treatment && <p className="mt-1 text-xs leading-relaxed">{r.treatment}</p>}
            {r.evidence && <p className="mt-2 border-l border-border pl-2 text-xs italic text-muted-foreground">”{r.evidence}”</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

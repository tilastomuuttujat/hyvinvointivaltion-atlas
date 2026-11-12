import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import article from "@/content/tieto-artikkeli.md?raw";
import "@/styles/tieto.css";

const TITLE = "Tietoa on enemmän kuin koskaan — mutta mikä muuttuu?";
const DESC = "Seuraa, miten tieto virtaa ymmärrykseksi ja toiminnaksi Suomessa 1850–2050 — ja missä se katkeaa.";

export const Route = createFileRoute("/tieto")({
  component: TietoPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/tieto" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/tieto" }],
  }),
});

// Tulkinnallinen arvio: kuinka suuri osa virrasta läpäisee kunkin portin (ei mittaus).
type Era = { y: string; n: string; t: string; q: string; src: string[]; pass: [number, number, number]; d: [string, string, string]; c: string };
const ERAS: Era[] = [
  { y: "1850–1917", n: "Yhteinen maailma", t: "Tieto avasi yhteistä maailmaa", q: "Oma vaikeus saattoi saada yhteiskunnallisen nimen.", src: ["Kirkko", "Lehdet", "Tilastot 1865"], pass: [0.35, 0.5, 0.35], d: ["Lehdet, koulut, kirjastot ja yhdistykset laajensivat pääsyä tietoon.", "Luokitukset auttoivat näkemään kokonaisuuksia, mutta kaikkea kokemusta ne eivät tavoittaneet.", "Muuttuminen päätöksiksi riippui asemasta ja vaikutusvallasta."], c: "Historiallinen tulkinta." },
  { y: "1917–1945", n: "Kilpailevat tulkinnat", t: "Sama tieto, erilaiset maailmankuvat", q: "Tosiasioista sopiminen ei vielä ratkaise tavoitteita.", src: ["Koulu", "Lehdistö", "Järjestöt"], pass: [0.55, 0.3, 0.45], d: ["Koulu, lehdistö ja järjestöt rakensivat kansalaisuutta.", "Samaa tapahtumaa tulkittiin eri asemista eri tavoin.", "Tieto ei yksin ratkaise, kenen riskejä kannetaan."], c: "Historiallinen tulkinta." },
  { y: "1945–1980", n: "Asiantuntijoiden Suomi", t: "Tieto teki järjestelmiä mahdolliseksi", q: "Ihminen kohtaa tilanteensa kokonaisuutena, hallinto tehtävinä.", src: ["Tutkimus", "Palvelut", "Tilastot"], pass: [0.7, 0.55, 0.65], d: ["Koulutus ja palvelut vahvistivat tarpeiden tunnistamista.", "Luokittelun ulkopuolelle saattoi jäädä vaikeuksien yhteys toisiinsa.", "Jonkun pitää yhdistää havainnot ja muuttaa työnjakoa."], c: "Historiallinen tulkinta." },
  { y: "1980–2010", n: "Tieto verkkoon", t: "Pääsy avautui, arviointi korostui", q: "Saatavuus ja käyttökyky ovat eri asioita.", src: ["Internet 1995", "Media", "Hallinto"], pass: [0.85, 0.5, 0.45], d: ["Internet avasi reittejä alkuperäislähteisiin.", "Lähteiden vertaaminen ja tarkistaminen korostuivat.", "Käyttäminen vaatii aikaa, perustietoja ja kuulluksi tulemista."], c: "Historiallinen tulkinta." },
  { y: "2010–2025", n: "Näkyvyyden valta", t: "Kuka päättää, mikä tulee vastaan?", q: "Tietoa on paljon. Huomio ja harkinnan aika ovat rajallisia.", src: ["Alustat", "Hakukoneet", "Mittarit"], pass: [0.95, 0.4, 0.3], d: ["Saatavuuden rinnalla ratkaisee näkyvyys.", "Mittari näyttää muutoksen kertomatta syytä.", "Raportti ei itsessään nimeä vastuullista korjaajaa."], c: "Tulkinta mahdollisista mekanismeista." },
  { y: "2026–2050", n: "Harkinnan tulevaisuus", t: "Tekoäly voi avata — tai peittää", q: "Vastaus tulee lähelle. Sen perusteet voivat etääntyä.", src: ["Tekoäly", "Avoin data", "Kokemus"], pass: [0.98, 0.45, 0.5], d: ["Tekoäly voi auttaa vaikean tekstin ymmärtämisessä.", "Sujuvuus ei takaa oikeellisuutta — lähteiden pitää näkyä.", "Päätös tarvitsee edelleen vastuullisen toimijan."], c: "Skenaario, ei ennuste." },
];
const GATES: ReadonlyArray<readonly [string, string]> = [["Pääsy tietoon", "Kuka saa tietää?"], ["Yhteinen ymmärrys", "Kenen havainto kuullaan?"], ["Kyky korjata", "Kuka pystyy toimimaan?"]];
const W = 1000, H = 520, GX = [260, 470, 680], END = 840;

type P = { x: number; y: number; vy: number; lane: number; gate: number; fall: boolean; life: number; src: number };

function Flow({ era, gate, onGate }: { era: Era; gate: number; onGate: (g: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const eraRef = useRef(era); eraRef.current = era;
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const ok = css.getPropertyValue("--flow-ok").trim() || "#5fe0c8";
    const bad = css.getPropertyValue("--flow-bad").trim() || "#ff7a59";
    const ps: P[] = []; let raf = 0, t = 0; const c = [0, 0, 0, 0];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = () => {
      t++;
      if (ps.length < 420 && t % 2 === 0) { const s = Math.floor(Math.random() * 3); ps.push({ x: 60, y: 150 + s * 110 + (Math.random() - 0.5) * 40, vy: 0, lane: Math.random(), gate: 0, fall: false, life: 0, src: s }); }
      ctx.fillStyle = "rgba(8,14,24,0.28)"; ctx.fillRect(0, 0, W, H);
      const e = eraRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!; p.life++;
        if (p.fall) { p.vy += 0.12; p.y += p.vy; p.x += 0.4; if (p.y > H) ps.splice(i, 1); else { ctx.fillStyle = bad; ctx.globalAlpha = 0.7; ctx.fillRect(p.x, p.y, 2, 2); } continue; }
        p.x += 2.2; const ty = 260 + (p.lane - 0.5) * 70 * (1 - p.gate * 0.22);
        p.y += (ty - p.y) * 0.03;
        const gx = GX[p.gate];
        if (gx !== undefined && p.x >= gx) { if (Math.random() > e.pass[p.gate]!) { p.fall = true; c[p.gate]!++; } else p.gate++; }
        if (p.x > END) { c[3]!++; ps.splice(i, 1); continue; }
        ctx.globalAlpha = 0.9; ctx.fillStyle = ok; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t % 30 === 0) setCounts([...c]);
      if (!reduced) raf = requestAnimationFrame(step);
    };
    if (reduced) for (let i = 0; i < 400; i++) step(); else raf = requestAnimationFrame(step);
    const reset = setInterval(() => { c.fill(0); }, 6000);
    return () => { cancelAnimationFrame(raf); clearInterval(reset); };
  }, []);
  void counts;
  const reach = [1, era.pass[0], era.pass[0] * era.pass[1], era.pass[0] * era.pass[1] * era.pass[2]];
  return (
    <div className="tv-flow">
      <canvas ref={ref} style={{ width: "100%", aspectRatio: `${W}/${H}` }} aria-hidden />
      <svg viewBox={`0 0 ${W} ${H}`} className="tv-overlay" role="group" aria-label="Tiedon portit">
        {era.src.map((s, i) => <text key={s} x={50} y={150 + i * 110 - 28} className="tv-src">{s}</text>)}
        {GX.map((x, i) => (
          <g key={i} className={`tv-gate ${gate === i ? "on" : ""}`} tabIndex={0} role="button" aria-label={GATES[i]?.[0]}
            onClick={() => onGate(i)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && onGate(i)}>
            <rect x={x - 70} y={40} width={140} height={440} fill="transparent" />
            <line x1={x} x2={x} y1={150} y2={370} className="tv-gate-line" style={{ strokeWidth: 2 + (era.pass[i] ?? 0) * 10 }} />
            <text x={x} y={110} textAnchor="middle" className="tv-num">0{i + 1}</text>
            <text x={x} y={135} textAnchor="middle" className="tv-gname">{GATES[i]?.[0]}</text>
            <text x={x} y={410} textAnchor="middle" className="tv-leak">↓ katkeaa {Math.round(reach[i]! * (1 - era.pass[i]!) * 100)} %</text>
          </g>
        ))}
        <text x={END + 10} y={240} className="tv-gname">Muuttaa</text><text x={END + 10} y={262} className="tv-gname">toimintaa</text>
        <text x={END + 10} y={290} className="tv-big">{Math.round(reach[3]! * 100)} %</text>
      </svg>
    </div>
  );
}

export function TietoPage() {
  const [ei, setEi] = useState(4); const [gate, setGate] = useState(1);
  const e = ERAS[ei]!;
  return (
    <main className="tv">
      <header className="tv-head">
        <div className="tv-eyebrow">Suomen rakennemuutokset · 1850–2050</div>
        <h1>Tietoa on enemmän kuin koskaan.<br /><em>Mutta mikä muuttuu?</em></h1>
        <p className="tv-intro">Jokainen valopiste on havainto. Se kulkee kolmen portin läpi — tai putoaa pois. Valitse aikakausi ja katso, missä virta katkeaa.</p>
      </header>
      <nav className="tv-eras" aria-label="Aikakausi">
        {ERAS.map((x, i) => <button key={x.y} aria-pressed={i === ei} onClick={() => setEi(i)}>{x.y}<small>{x.n}</small></button>)}
      </nav>
      <section className="tv-stage">
        <Flow era={e} gate={gate} onGate={setGate} />
        <aside aria-live="polite">
          <div className="tv-label">{e.y} · {ei === 5 ? "Skenaario" : "Historiallinen tulkinta"}</div>
          <h2>{e.t}</h2>
          <p className="tv-thesis">{e.q}</p>
          <h3>{GATES[gate]?.[0]} <span>— {GATES[gate]?.[1]}</span></h3>
          <p>{e.d[gate]}</p>
          <p className="tv-note">{e.c} Läpäisyosuudet ovat artikkelin pohjalta laadittu havainnollistus, eivät mittaustuloksia.</p>
        </aside>
      </section>
      <blockquote className="tv-quote">Tietävän yhteiskunnan tunnistaa siitä, että se pystyy muuttamaan toimintaansa oppimansa perusteella.</blockquote>
      <details className="tv-article"><summary>Lue koko artikkeli</summary><Markdown src={article} /></details>
    </main>
  );
}

function Markdown({ src }: { src: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/).map((p, i) => {
    let m;
    if ((m = p.match(/^\*\*(.+)\*\*$/))) return <strong key={i}>{m[1]}</strong>;
    if ((m = p.match(/^\*(.+)\*$/))) return <em key={i}>{m[1]}</em>;
    if ((m = p.match(/^\[(.+)\]\((.+)\)$/))) return <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    return p;
  });
  return <>{src.split(/\n\n+/).map((b, i) => {
    if (b.startsWith("# ")) return <h2 key={i}>{b.slice(2)}</h2>;
    if (b.startsWith("## ")) return <h3 key={i}>{b.slice(3)}</h3>;
    if (b.startsWith("### ")) return <h4 key={i}>{b.slice(4)}</h4>;
    if (/^\d+\. /.test(b)) return <ol key={i}>{b.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
    return <p key={i}>{inline(b)}</p>;
  })}</>;
}

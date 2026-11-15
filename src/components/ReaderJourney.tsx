import { useMemo, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import type { ExploreStep } from "@/lib/atlas.explore";
import { readerPath, compareReaderPaths } from "@/lib/atlas.reader";
import { useGraphExplore } from "./GraphExplore";
import "@/styles/reader-journey.css";
const questions = [
  {
    id: "labour_productivity",
    title: "Miten tuottavuuden muutos välittyy ihmisten toimeentuloon?",
  },
  {
    id: "work_accommodation",
    title: "Millä ehdoilla työ tukee toimintakykyä?",
  },
  {
    id: "service_digitalisation",
    title: "Kenelle palvelujen digitalisoituminen avaa mahdollisuuksia?",
  },
];
export function ReaderJourney({ data }: { data: AtlasData }) {
  const e = useGraphExplore(data),
    [open, setOpen] = useState(false),
    [question, setQuestion] = useState(""),
    [saved, setSaved] = useState<ExploreStep[] | null>(null),
    [menu, setMenu] = useState(false),
    [direction, setDirection] = useState<"effects" | "causes">("effects");
  const path = useMemo(() => readerPath(data, e.steps), [data, e.steps]);
  const compared = saved ? readerPath(data, saved) : null,
    comparison = saved ? compareReaderPaths(saved, e.steps) : null;
  const options = e.options.filter(
    (o) =>
      o.assessment.status !== "outside" &&
      (direction === "effects" ? !o.incoming : o.incoming),
  );
  const begin = (id: string, title: string) => {
    setQuestion(title);
    e.start(id);
    setMenu(false);
    setOpen(false);
  };
  const timeline = (p: typeof path) => (
    <svg
      className="reader-timeline"
      viewBox="0 0 600 72"
      role="img"
      aria-label="Polun kirjattujen väitteiden ajoitus 1850–2050"
    >
      <line x1="30" x2="570" y1="16" y2="16" />
      {[1850, 1900, 1950, 2000, 2050].map((y) => (
        <text key={y} x={30 + (y - 1850) * 2.7} y="65" textAnchor="middle">
          {y}
        </text>
      ))}
      {p.links.map((l, i) =>
        l.statement?.start != null && l.statement.end != null ? (
          <line
            key={i}
            className="period"
            x1={
              30 +
              (Math.max(1850, Math.min(2050, l.statement.start)) - 1850) * 2.7
            }
            x2={
              30 +
              (Math.max(1850, Math.min(2050, l.statement.end)) - 1850) * 2.7
            }
            y1={24 + (i % 4) * 6}
            y2={24 + (i % 4) * 6}
          >
            <title>
              {l.statement.title}: {l.statement.start}–{l.statement.end}
            </title>
          </line>
        ) : null,
      )}
    </svg>
  );
  const report = (p: typeof path) => (
    <>
      <ol className="reader-path">
        {p.steps.map((s, i) => (
          <li key={i}>{s.label}</li>
        ))}
      </ol>
      {timeline(p)}
      <p>
        {
          p.links.filter(
            (l) => l.statement?.start == null || l.statement.end == null,
          ).length
        }{" "}
        askeleella avoin ajoitus. Aikajana paikantaa väitteet; se ei mittaa
        vaikutuksen viivettä.
      </p>
      <h3>Keitä aineisto koskee?</h3>
      <p>
        {p.populations.length
          ? p.populations.join(" · ")
          : "Kohderyhmää ei ole kirjattu tämän polun havaintoihin."}
      </p>
      <p>
        Ryhmien luettelo ei osoita, että kaikki yhteydet koskisivat samoja
        ihmisiä tai alueita. Muuta tarkastelurajausta Tilanne-painikkeesta.
      </p>
      {p.links.map((l, i) => (
        <article className="reader-step" key={i}>
          <h3>
            {i + 1}.{" "}
            {l.mechanism?.label ?? "Kirjattu mekanismikytkentä puuttuu"}
          </h3>
          {!l.mechanism ? (
            <p>Tätä askelta ei voi tulkita vaikutusyhteydeksi.</p>
          ) : (
            <>
              <p>
                {l.mechanism.from === l.before.id
                  ? "Seurasit kirjattua vaikutussuuntaa."
                  : "Tutkit taustatekijää vastakkaiseen lukusuuntaan; vaikutuksen suunta ei käänny."}{" "}
                {l.mechanism.explanation}
              </p>
              <p>
                <strong>
                  {l.mechanism.basis === "causal" &&
                  l.mechanism.reviewStatus === "accepted"
                    ? "Kausaaliseksi arvioitu yhteys"
                    : l.mechanism.basis === "association"
                      ? "Kirjattu yhteys"
                      : "Selitysehdotus"}
                </strong>
              </p>
              <h4>Millä ehdoilla ja rajoilla?</h4>
              <p>
                {l.mechanism.conditions || "Soveltamisehtoja ei ole kirjattu."}
              </p>
              <p>
                {l.mechanism.limitations ||
                  "Mekanismin rajauksia ei ole kirjattu."}
              </p>
              <p>{l.statement?.limitations}</p>
              <h4>Mitä havaintoja on kirjattu?</h4>
              {l.evidence.length ? (
                <ul>
                  {l.evidence.map((x) => (
                    <li key={x.link.id}>
                      <strong>
                        {
                          {
                            supports: "Tukee",
                            challenges: "Haastaa",
                            limits: "Rajaa",
                            context_for: "Taustoittaa",
                          }[x.link.relation]
                        }
                      </strong>
                      : {x.observation.title}
                      <p>{x.observation.finding || x.link.rationale}</p>
                      <p>
                        {x.observation.population} ·{" "}
                        {x.observation.design ||
                          "Tutkimusasetelmaa ei kirjattu"}
                      </p>
                      <p>
                        {x.link.limitations} {x.observation.limitations}
                      </p>
                      <button
                        onClick={() =>
                          e.inspect("observation", x.observation.id)
                        }
                      >
                        Havainto ja lähteet ({x.sources.length})
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Tälle väitteelle ei ole kirjattua julkaistavaa
                  havaintokytkentää. Tämä ei osoita väitettä vääräksi eikä
                  vahvista sitä.
                </p>
              )}
              <h4>Voisiko tulkinta olla toinen?</h4>
              {l.alternatives.length ? (
                <ul>
                  {l.alternatives.map((a, j) => (
                    <li key={j}>
                      {
                        {
                          supports: "Tukee",
                          challenges: "Haastaa",
                          limits: "Rajaa",
                          assumption_for: "Oletuksena",
                        }[a.relation.relation]
                      }
                      : {a.statement.title}{" "}
                      <p>
                        {a.relation.to === l.statement?.id
                          ? "Tämä väite kohdistuu polun väitteeseen."
                          : "Polun väite kohdistuu tähän väitteeseen."}
                      </p>
                      <p>{a.relation.rationale}</p>
                      <p>{a.relation.limitations}</p>
                      <button
                        onClick={() => e.inspect("statement", a.statement.id)}
                      >
                        Tutki väitteiden suhdetta
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Tälle väitteelle ei ole kirjattua rinnakkaista argumenttia.
                  Vaihtoehtojen puuttuminen aineistosta ei sulje muita
                  selityksiä pois.
                </p>
              )}
              <button onClick={() => e.inspect("mechanism", l.mechanism!.id)}>
                Koko perusteluketju ja lähteet
              </button>
            </>
          )}
        </article>
      ))}
      <h3>Mitä tästä voi päätellä?</h3>
      <p>
        Valitsemasi polku yhdistää {p.steps.length} käsitettä ja{" "}
        {p.links.filter((l) => l.mechanism).length} kirjattua mekanismia.{" "}
        {
          p.links.filter((l) =>
            l.evidence.some((x) => x.link.relation === "supports"),
          ).length
        }{" "}
        askeleeseen liittyy tukeva havainto;{" "}
        {
          p.links.filter((l) =>
            l.evidence.some(
              (x) =>
                x.link.relation === "challenges" ||
                x.link.relation === "limits",
            ),
          ).length
        }{" "}
        askeleeseen haastava tai rajaava havainto. Havaintomäärät eivät mittaa
        näytön vahvuutta.
      </p>
      <p>
        Koko ketjun syyvaikutusta tai suuruutta ei voi päätellä pelkästä
        reitistä. Tarkista kunkin askeleen ajankohta, kohderyhmä ja ehdot sekä
        vaihtoehtoiset selitykset.
      </p>
    </>
  );
  return (
    <>
      <div className="reader-entry">
        <button onClick={() => setMenu(!menu)} aria-expanded={menu}>
          Aloita kysymyksestä
        </button>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          Oma tulkintapolku ({e.steps.length})
        </button>
      </div>
      {(menu || !e.current) && (
        <div className="reader-questions">
          <h2>Mitä haluaisit ymmärtää?</h2>
          {questions
            .filter((q) => data.evidence?.concepts.some((c) => c.id === q.id))
            .map((q) => (
              <button key={q.id} onClick={() => begin(q.id, q.title)}>
                {q.title}
              </button>
            ))}
          <p>
            Himmeät langat näyttävät teemajäsenyyksiä. Nuoliviivat näyttävät
            kirjatut mekanismit; katkoviiva selitysehdotuksen ja vahva viiva
            oman valinnan. Kysymykset ovat lähtökohtia tutkimiselle, eivät
            aineiston valmiita johtopäätöksiä. Voit aloittaa myös mistä tahansa
            käsitepisteestä.
          </p>
        </div>
      )}
      {e.current && !open && !menu && (
        <div className="reader-next">
          <strong>
            {question || "Miten tämä muutos liittyy kokonaisuuteen?"}
          </strong>
          <div role="group" aria-label="Polun tutkimissuunta">
            <button
              aria-pressed={direction === "effects"}
              onClick={() => setDirection("effects")}
            >
              Mihin tämä vaikuttaa?
            </button>
            <button
              aria-pressed={direction === "causes"}
              onClick={() => setDirection("causes")}
            >
              Mikä tähän johti?
            </button>
          </div>
          <div className="reader-next-list">
            {options.map((o) => (
              <button
                key={o.mechanism.id}
                data-reader-via={o.mechanism.id}
                onPointerEnter={() =>
                  e.setPreview({ target: o.target.id, via: o.mechanism.id })
                }
                onPointerLeave={() => e.setPreview(null)}
                onClick={() => e.pick(o.target.id, o.mechanism.id)}
              >
                <b>{o.target.label}</b>
                <span>{o.mechanism.label}</span>
                <small>{o.mechanism.explanation}</small>
              </button>
            ))}
          </div>
          {!options.length && (
            <p>
              Tähän suuntaan ei ole julkaistavaa jatkoa nykyisellä rajauksella.
            </p>
          )}
        </div>
      )}
      <aside
        className={`reader-summary${open ? " open" : ""}`}
        aria-label="Lukijan tulkintapolku"
        aria-hidden={!open}
        inert={!open}
      >
        <button onClick={() => setOpen(false)}>Sulje yhteenveto</button>
        <h2>{question || "Oma tulkintapolku"}</h2>
        {!e.steps.length ? (
          <p>Valitse ensin kysymys tai käsite kartalta.</p>
        ) : (
          <>
            {report(path)}
            <div className="reader-compare-actions">
              <button
                disabled={e.steps.length < 2}
                onClick={() => setSaved(e.steps.map((s) => ({ ...s })))}
              >
                Säilytä tämä vertailuun
              </button>
              {saved && (
                <>
                  <button
                    onClick={() => {
                      e.start(saved[0]!.id);
                      setOpen(false);
                    }}
                  >
                    Tutki toista polkua samasta alusta
                  </button>
                  <button onClick={() => setSaved(null)}>
                    Poista vertailu
                  </button>
                </>
              )}
            </div>
            {compared && comparison && (
              <section className="reader-comparison">
                <h2>Kahden polun vertailu</h2>
                <p>
                  Säilytetty polku pysyy vertailussa tämän Päättelyavaruuden
                  avaamisen ajan.
                </p>
                <p>
                  {comparison.sameStart
                    ? "Sama lähtökohta."
                    : "Eri lähtökohdat."}{" "}
                  Yhteisiä alkuaskeleita: {comparison.shared}.{" "}
                  {comparison.sameEnd
                    ? "Sama päätepiste ei takaa samaa vaikutusta."
                    : "Polut päätyvät eri käsitteisiin."}
                </p>
                <p>
                  Ero ei yksin osoita syytä. Vertaa haarautumiskohdan
                  mekanismeja, ajoitusta, kohderyhmiä ja ehtoja.
                </p>
                <h3>Säilytetty polku</h3>
                {report(compared)}
              </section>
            )}
          </>
        )}
      </aside>
    </>
  );
}

import { ThemeSystem } from "@/components/ThemeSystem";
import { ConceptMap } from "@/components/ConceptMap";
import { EvidenceExplorer } from "@/components/EvidenceExplorer";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAtlas } from "@/lib/atlas.static";
import { AtlasExperience } from "@/components/AtlasExperience";
import { RadialAtlas } from "@/components/RadialAtlas";
import { AxisField } from "@/components/AxisField";
import { useState } from "react";

const atlasQuery = queryOptions({ queryKey: ["atlas"], queryFn: () => getAtlas(), staleTime: 5 * 60_000 });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atlas · Suomen hyvinvointivaltion kehityskaari 1850–2050" },
      { name: "description", content: "Tasoittain avautuva atlas: ilmiöalueet, avainkäsitteet, selitykset, havainnot ja niiden lähteet." },
      { property: "og:title", content: "Atlas · Suomen hyvinvointivaltion kehityskaari" },
      { property: "og:description", content: "Päätelmät, aikakaudet ja niiden näyttö yhdessä kuvaajassa — nykytilan syyt ja tulevaisuuden näkymät." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(atlasQuery),
  component: AtlasPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-center text-foreground">
      <div><h1 className="font-display text-2xl">Aineistoa ei saatu ladattua</h1><p className="mt-2 text-muted-foreground">{(error as Error).message}</p></div>
    </div>
  ),
});

export function AtlasPage() {
  const { data } = useSuspenseQuery(atlasQuery);
  const [view, setView] = useState<"sphere" | "radial" | "axes" | "routes" | "themes">("sphere");
  const [visited,setVisited]=useState<Set<string>>(new Set(["sphere"]));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-5 md:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Atlas · Suomen rakennemuutokset</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl">Hyvinvointivaltion kehityskaari 1850–2050</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Oikeuksista toimintavaraan. Historialliset murrokset, nykyhetken jännitteet ja tulevaisuuden mahdollisuudet.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <Stat n={data.articleCount} l="artikkelia" />
          <Stat n={data.conclusions.length} l="päätelmää" />
          <Stat n={data.cells.reduce((n, c) => n + c.direct, 0)} l="suoraa kytkentää" />
        </div>
      </header>
      <nav className="view-switch" aria-label="Näkymä">
        {([["sphere", "◐ Pallo"], ["radial", "◎ Säteittäinen"], ["axes", "⊹ Akselikenttä"], ["routes", "⌁ Reittikartta"], ["themes", "☊ Teemaverkko"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-current={view === k || undefined} onClick={() => {setView(k);setVisited(previous=>new Set([...previous,k]))}}>{l}</button>
        ))}
      </nav>
      <div hidden={view!=="sphere"}><AtlasExperience data={data} active={view==="sphere"}/></div>
      {visited.has("radial")&&<div hidden={view!=="radial"}><RadialAtlas data={data}/></div>}
      {visited.has("axes")&&<div hidden={view!=="axes"}><AxisField data={data} active={view==="axes"}/></div>}
      {visited.has("routes")&&<div hidden={view!=="routes"}><ConceptMap data={data} layout="routes" active={view==="routes"}/></div>}
      {visited.has("themes") && <div hidden={view !== "themes"}><ThemeSystem /></div>}
      <details className="border-t border-border">
        <summary className="cursor-pointer px-6 py-4 text-xs text-muted-foreground">Havaintoaineiston hakemisto</summary>
        <EvidenceExplorer bundle={data.evidence} />
      </details>
      <footer className="border-t border-border px-6 py-4 text-xs text-muted-foreground md:px-10">
        Lähde: Neonin artikkeli-, havainto- ja selitysaineisto. Toimitukselliset kytkennät eivät itsessään todista syy-yhteyttä.
        {data.generatedAt && <p className="mt-2">Aineistovienti: {new Date(data.generatedAt).toLocaleString("fi-FI")} · {data.reviewPolicy}</p>}
      </footer>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div><div className="font-display text-3xl text-primary">{n}</div><div className="text-xs text-muted-foreground">{l}</div></div>;
}


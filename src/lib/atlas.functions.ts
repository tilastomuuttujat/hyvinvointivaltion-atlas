import type { EvidenceBundle } from './atlas.evidence';
import { createServerFn } from "@tanstack/react-start";
import type { EvidenceRef } from "./atlas.relationships";
import { neonQuery, neonUserError, type NeonBatchResult } from "./neon";

export type Period = { id: string; label: string; start: number; end: number; coverage: { A: number; K: number; S: number } };
export type Conclusion = { id: number; title: string; claim: string; kind: string; limitations: string | null };
export type Cell = { c: number; p: string; direct: number; context: number; counter: number; articles: number };
export type AtlasData = { evidence?: EvidenceBundle | undefined; periods: Period[]; conclusions: Conclusion[]; cells: Cell[]; articleCount: number;
  evidenceIndex?: EvidenceRef[]; generatedAt?: string; reviewPolicy?: string };

export type Treatment = {
  articleNo: number; articleTitle: string; periodId: string; relation: string;
  treatment: string | null; evidence: string | null; limitations: string | null;
  concepts?: string[]; reviewStatus?: string;
};

const S = "atlas_editing";

export const getAtlas = createServerFn({ method: "GET" }).handler(async (): Promise<AtlasData> => {
  try {
    const { results } = await neonQuery<NeonBatchResult>(
      [
        { query: `select id,label,start_year,end_year from ${S}.periods order by sort_order` },
        { query: `select id,title,claim_text,claim_kind,limitations from ${S}.conclusions order by id limit 500` },
        {
          query: `select conclusion_id c, period_id p,
            count(*) filter (where claim_relation='direct') d,
            count(*) filter (where claim_relation='context') x,
            count(*) filter (where claim_relation='counterevidence') k,
            count(distinct article_id) filter (where claim_relation<>'none') a
            from ${S}.article_conclusion_periods group by 1,2 limit 5000`,
        },
        { query: `select period_id p, coverage_code c, count(*) n from ${S}.article_periods group by 1,2` },
        { query: `select count(*) n from ${S}.articles` },
        {
          query: `with lc as (
  select s.article_id, (l->>'conclusion_id')::int conclusion_id, array_agg(distinct l->>'concept') concepts
  from ${S}.article_structures s, jsonb_array_elements(coalesce(s.payload->'links','[]'::jsonb)) l
  where l->>'concept' is not null and (l->>'conclusion_id') ~ '^[0-9]+$'
  group by 1,2)
            select cp.conclusion_id c, cp.period_id p, a.article_no, cp.claim_relation, cp.review_status, coalesce(lc.concepts, '{}') concepts
            from ${S}.article_conclusion_periods cp join ${S}.articles a on a.id = cp.article_id
            left join lc on lc.article_id = cp.article_id and lc.conclusion_id = cp.conclusion_id
            where cp.claim_relation <> 'none' limit 10000`,
        },
        { query: `select to_json(now()) t` },
      ],
      [],
      { "Neon-Batch-Read-Only": "true" },
    );
    const cov = new Map<string, { A: number; K: number; S: number }>();
    for (const r of results[3]!.rows) {
      const p = String(r["p"]);
      const o = cov.get(p) ?? { A: 0, K: 0, S: 0 };
      const k = String(r["c"]) as "A" | "K" | "S";
      if (k in o) o[k] = Number(r["n"]);
      cov.set(p, o);
    }
    return {
      periods: results[0]!.rows.map((r) => ({
        id: String(r["id"]), label: String(r["label"]), start: Number(r["start_year"]), end: Number(r["end_year"]),
        coverage: cov.get(String(r["id"])) ?? { A: 0, K: 0, S: 0 },
      })),
      conclusions: results[1]!.rows.map((r) => ({
        id: Number(r["id"]), title: String(r["title"]), claim: String(r["claim_text"] ?? ""),
        kind: String(r["claim_kind"] ?? ""), limitations: (r["limitations"] as string) ?? null,
      })),
      cells: results[2]!.rows.map((r) => ({
        c: Number(r["c"]), p: String(r["p"]), direct: Number(r["d"]), context: Number(r["x"]), counter: Number(r["k"]), articles: Number(r["a"]),
      })),
      articleCount: Number(results[4]!.rows[0]?.["n"] ?? 0),
      evidenceIndex: results[5]!.rows.map((r) => ({
        c: Number(r["c"]), p: String(r["p"]), articleNo: Number(r["article_no"]), relation: String(r["claim_relation"]),
        concepts: ((r["concepts"] as string[] | null) ?? []).filter(Boolean),
        reviewStatus: (r["review_status"] as string) ?? undefined,
      })),
      generatedAt: String(results[6]!.rows[0]?.["t"] ?? new Date().toISOString()),
      reviewPolicy: "Kytkennät ja käsitelinkit ovat toimituksellisia kirjauksia. Tila \"accepted\" = tarkistettu, \"needs_review\" = odottaa tarkistusta. Yhteys toiseen päätelmään näytetään vain, jos samalla aikakaudella on yhteinen artikkeli tai täsmälleen sama avainkäsite; aineistoaukkoja ei yhdistetä.",
    };
  } catch (err) {
    console.error(err);
    throw new Error(neonUserError(err).message);
  }
});

export const getTreatments = createServerFn({ method: "GET" })
  .inputValidator((d: { conclusionId: number }) => {
    const id = Number(d?.conclusionId);
    if (!Number.isInteger(id) || id < 1) throw new Error("Virheellinen päätelmä");
    return { conclusionId: id };
  })
  .handler(async ({ data }): Promise<Treatment[]> => {
    try {
      const { rows } = await neonQuery(
        `with lc as (
  select s.article_id, (l->>'conclusion_id')::int conclusion_id, array_agg(distinct l->>'concept') concepts
  from ${S}.article_structures s, jsonb_array_elements(coalesce(s.payload->'links','[]'::jsonb)) l
  where l->>'concept' is not null and (l->>'conclusion_id') ~ '^[0-9]+$'
  group by 1,2)
         select a.article_no, a.title, cp.period_id, cp.claim_relation, cp.treatment_text, cp.evidence_text, cp.limitations,
           cp.review_status, coalesce(lc.concepts, '{}') concepts
         from ${S}.article_conclusion_periods cp join ${S}.articles a on a.id = cp.article_id
         left join lc on lc.article_id = cp.article_id and lc.conclusion_id = cp.conclusion_id
         join ${S}.periods p on p.id = cp.period_id
         where cp.conclusion_id = $1 and cp.claim_relation <> 'none'
         order by p.sort_order, case cp.claim_relation when 'direct' then 0 when 'counterevidence' then 1 else 2 end, a.article_no
         limit 400`,
        [data.conclusionId],
      );
      return rows.map((r) => ({
        articleNo: Number(r["article_no"]), articleTitle: String(r["title"]), periodId: String(r["period_id"]),
        relation: String(r["claim_relation"]), treatment: (r["treatment_text"] as string) ?? null,
        evidence: (r["evidence_text"] as string) ?? null, limitations: (r["limitations"] as string) ?? null,
        concepts: ((r["concepts"] as string[] | null) ?? []).filter(Boolean),
        reviewStatus: (r["review_status"] as string) ?? undefined,
      }));
    } catch (err) {
      console.error(err);
      throw new Error(neonUserError(err).message);
    }
  });

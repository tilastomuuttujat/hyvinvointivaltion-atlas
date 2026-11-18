// Exports the five main routes (tiekartta) from Neon into a static snapshot (run with bun).
import { writeFileSync } from "node:fs";
import { neonQuery } from "../src/lib/neon";

const { results } = await neonQuery<{ results: { rows: any[] }[] }>([
  { query: `select route_order "order",phenomenon_id id,title,start_year "start",end_year "end",phenomenon_kind kind,review_status status from atlas_reasoning.main_routes order by route_order` },
  { query: `select route_order route,sequence_no seq,title,start_year "start",end_year "end",situation from atlas_reasoning.main_route_stages order by route_order,sequence_no` },
  { query: `select from_route_order "from",to_route_order "to",boundary_year "year",title from atlas_reasoning.main_route_boundaries order by boundary_year` },
  { query: `select chain_id id,title,start_year "start",end_year "end",route_orders routes,learning_point learning from atlas_reasoning.main_route_chains where review_status<>'rejected' and start_year is not null order by start_year,chain_id` },
  { query: `select phenomenon_id id,title,start_year "start",end_year "end",route_orders routes from atlas_reasoning.main_route_intersections where review_status<>'rejected' order by start_year` },
], [], { "Neon-Batch-Read-Only": "true" });

const clean = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== "")));
const out = { generatedAt: new Date().toISOString(), routes: clean(results[0].rows), stages: clean(results[1].rows), boundaries: clean(results[2].rows), chains: clean(results[3].rows), intersections: clean(results[4].rows) };
writeFileSync(new URL("../public/data/roadmap.json", import.meta.url), JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));

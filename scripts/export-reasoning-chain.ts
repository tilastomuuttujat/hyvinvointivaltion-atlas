// Exports the phenomenon chain model from Neon into a static snapshot (run with bun).
import { writeFileSync } from "node:fs";
import { neonQuery } from "../src/lib/neon";

const { results } = await neonQuery<{ results: { rows: any[] }[] }>([
  { query: `select phenomenon_id id,title,start_year "start",end_year "end",phenomenon_kind kind,reader_question question,observed_change change,learning_point learning,review_status status from atlas_reasoning.phenomena where review_status<>'rejected' order by start_year,phenomenon_id` },
  { query: `select member_phenomenon_id member,parent_phenomenon_id parent,relation_kind relation,reader_question question from atlas_reasoning.phenomenon_chain_memberships where review_status<>'rejected' order by parent_phenomenon_id,membership_id` },
  { query: `select r.transition_id id,r.phenomenon_id phenomenon,fs.start_year "from",ts.start_year "to",fs.situation situation,fs.constraints constraints,r.trigger_description trigger,r.what_changed changed,r.improved_or_strengthened improved,r.unresolved_or_inadequate unresolved,r.remaining_constraint remaining,r.affected_groups groups,r.claim_kind claim from atlas_reasoning.phenomenon_response_reading r join atlas_reasoning.phenomenon_states fs on fs.state_id=r.from_state_id and fs.phenomenon_id=r.phenomenon_id join atlas_reasoning.phenomenon_states ts on ts.state_id=r.to_state_id and ts.phenomenon_id=r.phenomenon_id where r.publishable order by r.phenomenon_id,fs.sequence_no` },
  { query: `select phenomenon_id phenomenon,claim_text text from atlas_reasoning.phenomenon_explanations where explanation_kind='present_day_trace' and review_status<>'rejected' order by phenomenon_id` },
], [], { "Neon-Batch-Read-Only": "true" });

const clean = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== "")));
const out = { generatedAt: new Date().toISOString(), phenomena: clean(results[0].rows), memberships: clean(results[1].rows), transitions: clean(results[2].rows), traces: clean(results[3].rows) };
writeFileSync(new URL("../public/data/reasoning-chain.json", import.meta.url), JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));

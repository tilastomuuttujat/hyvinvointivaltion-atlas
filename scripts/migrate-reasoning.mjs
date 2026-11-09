// Administrative, additive migration. Never import into browser code.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const connectionString=process.env.NEON_DATABASE_URL;
if(!connectionString)throw new Error('Set NEON_DATABASE_URL for the target branch.');
const client=new pg.Client({connectionString,connectionTimeoutMillis:15000,statement_timeout:30000});
try {
 await client.connect();
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas_reasoning_migration'))");
 const migration=await readFile(new URL('../database/migrations/20261109_reasoning.sql',import.meta.url),'utf8');
 const integrity=await readFile(new URL('../database/migrations/20261109_reasoning_integrity.sql',import.meta.url),'utf8');
 const seed=await readFile(new URL('../database/seed-reasoning.sql',import.meta.url),'utf8');
 const exists=(await client.query("SELECT to_regclass('atlas_reasoning.schema_migrations') AS ledger")).rows[0].ledger;
 const applied=exists?(await client.query('SELECT version,migration_sha256 FROM atlas_reasoning.schema_migrations')).rows:[];
 for(const [version,sql] of [['20261109_reasoning',migration],['20261109_reasoning_seed',seed],['20261109_reasoning_integrity',integrity]]) {
  const hash=createHash('sha256').update(sql).digest('hex');
  const previous=applied.find(r=>r.version===version);
  if(previous&&previous.migration_sha256!==hash)throw new Error('Migration checksum mismatch');
  if(previous)continue;
  await client.query(sql);
  await client.query('INSERT INTO atlas_reasoning.schema_migrations(version,migration_sha256) VALUES ($1,$2)',[version,hash]);
 }
 await client.query('COMMIT');
 console.log('Reasoning schema and provisional pilot are ready. No approvals upgraded.');
} catch {
 await client.query('ROLLBACK').catch(()=>{});
 throw new Error('Reasoning migration failed; transaction rolled back. Check database access and migration checksums.');
} finally {await client.end().catch(()=>{});}

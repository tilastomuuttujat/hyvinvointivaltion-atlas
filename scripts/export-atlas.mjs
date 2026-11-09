// Runs only in Node / Actions. Never import this module into the browser.
import pg from 'pg';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error('Set NEON_DATABASE_URL in the workflow secret or local environment.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 30000, application_name: 'atlas-pages-export' });
try {
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const { rows } = await client.query(await readFile(new URL('./export-atlas.sql', import.meta.url), 'utf8'));
  const snapshot = rows[0]?.snapshot;
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.atlas?.periods?.length || !snapshot.atlas?.conclusions?.length || !Array.isArray(snapshot.treatments) || !Array.isArray(snapshot.evidence?.observations) || !Array.isArray(snapshot.evidence?.links) || !Array.isArray(snapshot.evidence?.concepts)) throw new Error('Export was empty or invalid; previous snapshot preserved.');
  await client.query('COMMIT');
  const target = fileURLToPath(new URL('../public/data/atlas.json', import.meta.url));
  await writeFile(target + '.tmp', JSON.stringify(snapshot) + '\n');
  await rename(target + '.tmp', target);
  console.log(`Exported ${snapshot.atlas.articleCount} articles and ${snapshot.treatments.length} links.`);
} catch {
  // Driver errors can contain connection metadata. Keep CI logs credential-free.
  throw new Error('Atlas export failed. Check database access, read permissions and the schema. The previous snapshot was preserved.');
} finally { await client.end().catch(() => {}); }

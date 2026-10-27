// Live benchmark against real sites. Usage: CHROME_PATH=/usr/bin/chromium node test/smoke-live.js
// Writes BENCHMARK.md with per-field hit rates. Network access required; not part of `npm test`.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';

const SITES = [
  'https://www.sevdesk.de', 'https://www.heise.de', 'https://www.lexware.de', 'https://www.digitec.ch', 'https://www.ihk-muenchen.de',
  'https://www.e-recht24.de', 'https://www.mustangproject.org', 'https://www.datev.de', 'https://ecosio.com', 'https://www.billomat.com',
  'https://www.bitpanda.com', 'https://www.hornbach.de', 'https://www.sipgate.de', 'https://www.hetzner.com', 'https://www.fielmann.de',
  'https://www.galaxus.ch', 'https://www.thalia.de', 'https://www.dm.de', 'https://www.runtastic.com', 'https://www.wko.at',
];
const dir = 'storage/key_value_stores/default';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/INPUT.json`, JSON.stringify({ startUrls: SITES.map((url) => ({ url })), validateVatId: true }));
rmSync('storage/datasets', { recursive: true, force: true });
rmSync('storage/request_queues', { recursive: true, force: true });
const t0 = Date.now();
execSync('node src/main.js', { stdio: 'inherit', env: process.env });
const secs = Math.round((Date.now() - t0) / 1000);
const rows = readdirSync('storage/datasets/default').map((f) => JSON.parse(readFileSync(`storage/datasets/default/${f}`)));
const fields = ['companyName', 'street', 'postalCode', 'city', 'country', 'registerNumber', 'vatId', 'email', 'phone', 'representatives'];
const hit = (d, f) => (Array.isArray(d[f]) ? d[f].length > 0 : !!d[f]);
let md = `# Live benchmark – ${new Date().toISOString().slice(0, 10)}\n\n${rows.length} sites, ${secs}s wall clock, ${rows.filter((d) => d.confidence >= 0.75).length} with confidence ≥ 0.75, ${rows.filter((d) => d.fetchedVia === 'browser').length} via browser fallback.\n\n| Field | Found |\n|---|---|\n`;
for (const f of fields) md += `| ${f} | ${rows.filter((d) => hit(d, f)).length}/${rows.length} |\n`;
const vies = rows.filter((d) => d.vies?.checked);
md += `\nVIES: ${vies.length} checked, ${vies.filter((d) => d.vies.valid).length} valid.\n\n| Domain | Company | City | Register | VAT | conf | via |\n|---|---|---|---|---|---|---|\n`;
for (const d of rows) md += `| ${d.domain} | ${d.companyName ?? ''} | ${d.city ?? ''} | ${d.registerType ?? ''} ${d.registerNumber ?? ''} | ${d.vatId ?? ''} | ${d.confidence} | ${d.fetchedVia ?? ''} |\n`;
writeFileSync('BENCHMARK.md', md);
console.log(md);

// Quick regression smoke (no browser): 5 stable domains over plain HTTP. Exit code 1 if fewer than 4 reach confidence >= 0.75.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
const SITES = ['https://www.sevdesk.de', 'https://www.heise.de', 'https://www.hetzner.com', 'https://www.sipgate.de', 'https://www.fielmann.de'];
mkdirSync('storage/key_value_stores/default', { recursive: true });
writeFileSync('storage/key_value_stores/default/INPUT.json', JSON.stringify({ startUrls: SITES.map((url) => ({ url })), validateVatId: false, useBrowserFallback: false }));
rmSync('storage/datasets', { recursive: true, force: true }); rmSync('storage/request_queues', { recursive: true, force: true });
execSync('node src/main.js', { stdio: 'inherit' });
const rows = readdirSync('storage/datasets/default').map((f) => JSON.parse(readFileSync(`storage/datasets/default/${f}`)));
const good = rows.filter((d) => d.confidence >= 0.75).length;
console.log(`SMOKE: ${good}/${rows.length} domains with confidence >= 0.75`);
for (const d of rows) console.log(` ${d.domain}: ${d.companyName} | ${d.city} | ${d.registerType ?? ''} ${d.registerNumber ?? ''} | conf=${d.confidence}`);
process.exit(good >= 4 ? 0 : 1);

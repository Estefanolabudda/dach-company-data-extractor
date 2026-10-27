import { Actor, log } from 'apify';
import { CheerioCrawler, PlaywrightCrawler } from 'crawlee';
import * as cheerio from 'cheerio';
import { extractCompanyData, rankImpressumLinks, commonImpressumPaths, pageToText } from './extract.js';
import { checkVies } from './vies.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
  startUrls = [],
  validateVatId = true,
  maxCandidatesPerSite = 3,
  tryCommonPaths = true,
  useBrowserFallback = true,
  maxConcurrency = 10,
  proxyConfiguration,
} = input;

const GOOD = 0.5; // confidence at which we stop looking for better pages
const MIN_TEXT = 200; // below this many characters a page is considered JS-rendered / empty

const normalizeUrl = (u) => {
  const raw = typeof u === 'string' ? u : u?.url;
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw.trim() : `https://${raw.trim()}`;
  try { return new URL(withScheme).toString(); } catch { return null; }
};

const sites = [...new Set(startUrls.map(normalizeUrl).filter(Boolean))];
if (!sites.length) {
  log.error('No valid startUrls provided.');
  await Actor.exit({ exitCode: 1 });
}
log.info(`Processing ${sites.length} site(s)`);

const siteKey = (url) => new URL(url).hostname.replace(/^www\./, '');
const state = new Map(sites.map((u) => [siteKey(u), {
  inputUrl: u, best: null, homeRecord: null, candidates: [], pending: 0, commonTried: false, browserQueue: [], errors: [],
}]));

const proxyConf = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined;

const consider = (s, record, sourceUrl, via) => {
  if (!s.best || record.confidence > s.best.confidence
    || (record.confidence === s.best.confidence && record.fieldsFound.length > s.best.fieldsFound.length)) {
    s.best = { ...record, impressumUrl: sourceUrl, fetchedVia: via };
  }
};

const collectAnchors = ($) => {
  const anchors = [];
  $('a[href]').each((_, a) => anchors.push({ href: $(a).attr('href'), text: $(a).text().trim() }));
  return anchors;
};

/** Shared page logic for both crawlers. Returns true if the page looked JS-rendered/empty. */
async function handlePage({ s, key, label, depth, pageUrl, $, addRequests, via }) {
  const anchors = collectAnchors($);
  const text = pageToText($);
  const textLen = text.replace(/\s+/g, ' ').trim().length;
  const record = extractCompanyData(text);

  const addCandidates = async (urls, nextDepth) => {
    const fresh = urls.filter((u) => !s.candidates.includes(u)).slice(0, 6);
    s.candidates.push(...fresh);
    s.pending += fresh.length;
    if (fresh.length) await addRequests(fresh.map((url) => ({ url, label: 'impressum', userData: { key, depth: nextDepth } })));
    return fresh.length;
  };

  if (label === 'home') {
    if (record.confidence >= GOOD) s.homeRecord = { ...record, impressumUrl: pageUrl, fetchedVia: via };
    const candidates = rankImpressumLinks(anchors, pageUrl, maxCandidatesPerSite);
    let n = await addCandidates(candidates, 0);
    if (!n && tryCommonPaths) { s.commonTried = true; n = await addCandidates(commonImpressumPaths(pageUrl), 0); }
    if (!n) s.errors.push('no_impressum_link_found');
    return textLen < MIN_TEXT;
  }

  consider(s, record, pageUrl, via);
  if (record.confidence < GOOD && depth < 1) {
    // e.g. an "Impressum" index page that links to several sub-Impressums
    const sub = rankImpressumLinks(anchors, pageUrl, 2).filter((u) => u !== pageUrl);
    await addCandidates(sub, depth + 1);
  }
  s.pending -= 1;
  if (s.pending <= 0 && tryCommonPaths && !s.commonTried && (!s.best || s.best.confidence < GOOD)) {
    s.commonTried = true;
    await addCandidates(commonImpressumPaths(pageUrl), 0);
  }
  return textLen < MIN_TEXT;
}

const cheerioCrawler = new CheerioCrawler({
  proxyConfiguration: proxyConf,
  maxConcurrency,
  maxRequestRetries: 1,
  requestHandlerTimeoutSecs: 45,
  navigationTimeoutSecs: 30,
  useSessionPool: true,
  persistCookiesPerSession: true,
  ignoreHttpErrorStatusCodes: [404, 410],
  additionalMimeTypes: ['application/xhtml+xml'],
  async requestHandler({ request, $, response, crawler: c }) {
    const key = request.userData.key;
    const s = state.get(key);
    if (!s) return;
    const status = response?.statusCode ?? 200;
    const pageUrl = request.loadedUrl ?? request.url;
    if (status >= 400) {
      if (request.label === 'home') s.errors.push(`home_http_${status}`);
      else s.pending -= 1;
      return;
    }
    const empty = await handlePage({
      s, key, label: request.label, depth: request.userData.depth ?? 0, pageUrl, $, via: 'http',
      addRequests: (reqs) => c.addRequests(reqs),
    });
    if (empty && useBrowserFallback && s.browserQueue.length < 3) s.browserQueue.push({ url: pageUrl, label: request.label, depth: request.userData.depth ?? 0 });
  },
  async failedRequestHandler({ request }, error) {
    const s = state.get(request.userData.key);
    if (!s) return;
    s.errors.push(`${request.label}_failed: ${String(error?.message ?? error).slice(0, 120)}`);
    if (request.label === 'impressum') s.pending -= 1;
  },
});

await cheerioCrawler.run(sites.map((url) => ({ url, label: 'home', userData: { key: siteKey(url), depth: 0 }, uniqueKey: `home:${url}` })));

// ---- Browser fallback for JS-rendered sites ----
const browserTargets = [];
for (const [key, s] of state) {
  if (!useBrowserFallback) break;
  if (s.best && s.best.confidence >= GOOD) continue;
  const urls = s.browserQueue.length ? s.browserQueue : [{ url: s.inputUrl, label: 'home', depth: 0 }];
  for (const t of urls) browserTargets.push({ url: t.url, label: t.label, userData: { key, depth: t.depth, browser: true }, uniqueKey: `browser:${t.url}` });
}
if (browserTargets.length) {
  log.info(`Browser fallback for ${browserTargets.length} page(s)`);
  const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const pwCrawler = new PlaywrightCrawler({
    proxyConfiguration: proxyConf,
    maxConcurrency: Math.min(2, maxConcurrency),
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 40,
    launchContext: { launchOptions: { ...launchOptions, args: ['--disable-gpu', '--no-sandbox'] } },
    async requestHandler({ request, page, crawler: c }) {
      const key = request.userData.key;
      const s = state.get(key);
      if (!s) return;
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // accept common cookie banners so the legal text is in the DOM
      for (const sel of ['#onetrust-accept-btn-handler', 'button:has-text("Alle akzeptieren")', 'button:has-text("Akzeptieren")', 'button:has-text("Accept all")', '[data-testid="uc-accept-all-button"]']) {
        try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 500 })) { await b.click({ timeout: 2000 }); break; } } catch { /* ignore */ }
      }
      await page.waitForTimeout(800);
      const $ = cheerio.load(await page.content());
      await handlePage({
        s, key, label: request.label, depth: request.userData.depth ?? 0, pageUrl: page.url(), $, via: 'browser',
        addRequests: (reqs) => c.addRequests(reqs.map((r) => ({ ...r, userData: { ...r.userData, browser: true } }))),
      });
    },
    async failedRequestHandler({ request }, error) {
      const s = state.get(request.userData.key);
      s?.errors.push(`browser_${request.label}_failed: ${String(error?.message ?? error).slice(0, 120)}`);
    },
  });
  await pwCrawler.run(browserTargets);
}

// ---- Output ----
const tldCountry = (domain) => ({ de: 'DE', at: 'AT', ch: 'CH', li: 'LI' })[domain.split('.').pop()] ?? null;
let charged = 0; let withData = 0;
for (const [key, s] of state) {
  if (!s.best || (s.best.confidence < GOOD && s.homeRecord && s.homeRecord.confidence > s.best.confidence)) s.best = s.homeRecord;
  const out = {
    inputUrl: s.inputUrl, domain: key, impressumUrl: s.best?.impressumUrl ?? null, fetchedVia: s.best?.fetchedVia ?? null,
    companyName: null, legalForm: null, street: null, postalCode: null, city: null, country: null,
    registerCourt: null, registerType: null, registerNumber: null, vatId: null, taxNumber: null,
    representatives: [], responsiblePerson: null, email: null, phone: null, fax: null,
    supervisoryAuthority: null, profession: null, chamber: null, vies: null,
    confidence: 0, fieldsFound: [], candidatesTried: s.candidates, errors: s.errors, extractedAt: new Date().toISOString(),
  };
  if (s.best) { const { impressumUrl, fetchedVia, ...rest } = s.best; Object.assign(out, rest, { impressumUrl, fetchedVia }); }
  else if (!s.errors.length) out.errors = ['no_company_data_extracted'];
  if (!out.country && (out.postalCode || out.companyName)) out.country = tldCountry(key);
  if (validateVatId && out.vatId) out.vies = await checkVies(out.vatId);
  await Actor.pushData(out);
  if (out.confidence >= 0.25) {
    withData += 1;
    try { const res = await Actor.charge({ eventName: 'company-record', count: 1 }); if (res?.chargedCount) charged += res.chargedCount; }
    catch (e) { log.debug(`charge skipped: ${e.message}`); }
  }
}
log.info(`Done. ${state.size} site(s) processed, ${withData} with data, ${charged} event(s) charged.`);
await Actor.exit();

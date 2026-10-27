/**
 * Pure extraction logic for DACH legal-notice ("Impressum") pages.
 * No I/O here so it can be unit-tested in isolation.
 */

const LEGAL_FORMS = [
  'GmbH & Co. KGaA', 'GmbH & Co. KG', 'GmbH & Co.KG', 'AG & Co. KG', 'SE & Co. KGaA', 'SE & Co. KG',
  'UG (haftungsbeschränkt) & Co. KG', 'UG (haftungsbeschränkt)', 'gGmbH', 'gUG', 'GmbH', 'mbH',
  'KGaA', 'AG', 'SE', 'KG', 'OHG', 'e. K.', 'e.K.', 'e.Kfr.', 'e.Kfm.', 'e. V.', 'e.V.', 'GbR',
  'PartG mbB', 'PartGmbB', 'PartG', 'eG', 'Stiftung', 'AöR', 'KdöR', 'Ltd.', 'Ltd', 'Inc.', 'LLC',
  'S.A.', 'SARL', 'Sàrl', 'B.V.', 'N.V.', 'Genossenschaft', 'Verein', 'OG', 'KEG', 'Einzelunternehmen', 'e.U.', 'e. U.', 'Einzelfirma', 'GesmbH', 'Ges.m.b.H.',
];

const LEGAL_FORM_RE = new RegExp(
  '(?:^|[\\s,])(' + LEGAL_FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')).join('|') + ')(?=$|[\\s,.;:)])',
  'i',
);

const STREET_RE = /([A-ZÄÖÜa-zäöüß][\wäöüÄÖÜß.'\- ]{1,60}?(?:straße|strasse|str\.|Str\.|weg|Weg|platz|Platz|allee|Allee|gasse|Gasse|ring|Ring|damm|Damm|ufer|Ufer|chaussee|Chaussee|markt|Markt|promenade|Promenade|steig|Steig|hof|Hof|zeile|Zeile|wall|Wall|berg|Berg|pfad|Pfad|rain|Rain|tor|Tor|brücke|Brücke|graben|Graben|park|Park|gärten|Gärten|höhe|Höhe|kai|Kai|strand|Strand|weide|Weide)\s*\d{1,4}\s?[a-zA-Z]?(?:\s?[-/–]\s?\d{1,4}[a-zA-Z]?)?)/;
const STREET_FALLBACK_RE = /([A-ZÄÖÜ][\wäöüÄÖÜß.'\-]+(?: [A-ZÄÖÜa-zäöüß][\wäöüÄÖÜß.'\-]+){0,3}\s+\d{1,4}\s?[a-zA-Z]?(?:\s?[-/–]\s?\d{1,4}[a-zA-Z]?)?)\s*$/;
const POSTAL_RE = /(?:^|\s|,)(?:(D|DE|A|AT|CH)[-\s])?(\d{5}|\d{4})\s+([A-ZÄÖÜ][\wäöüÄÖÜß.\-]+(?:[ \-](?:am|an|der|im|bei|ob|unter|auf|a\.|i\.|b\.|[A-ZÄÖÜ][\wäöüÄÖÜß.\-]+)){0,4})/;

const VAT_RE = /\b(DE\s?\d{3}\s?\d{3}\s?\d{3}|ATU\s?\d{8}|CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s?(?:MWST|TVA|IVA|VAT))?)\b/i;
const VAT_CONTEXT_RE = /(USt|Ust|VAT|Umsatzsteuer|UID|MwSt|MWST|Mehrwertsteuer|Steuer-?ID|Identifikationsnummer)/i;
const TAX_NO_RE = /Steuer(?:-?\s?(?:nummer|nr\.?))\s*:?\s*(\d{2,3}\s?\/?\s?\d{3,4}\s?\/?\s?\d{4,5})/i;

const REGISTER_TYPE_RE = /\b(HRA|HRB|GnR|VR|PR|FN|CH-\d{3}\.\d\.\d{3}\.\d{3}-\d)(?![a-zA-Z])\s*\.?:?\s*(\d{1,7}(?:\s?[a-zA-Z](?![a-zA-Z]))?)?/;
const REGISTER_COURT_RE = /(?:Registergericht|Amtsgericht|Handelsregister(?:gericht)?|Firmenbuchgericht|Handelsgericht|Landesgericht|Handelsregisteramt)\s*(?:des Kantons\s+)?:?\s*([A-ZÄÖÜ][\wäöüÄÖÜß.\- ]{2,40}?)(?=\s*(?:,|;|\n|HR[AB]|FN|Nr|Registernummer|$|unter|Handelsregister))/;

const EMAIL_RE = /([\w.+-]+)\s*(?:@|\(at\)|\[at\]|\{at\}|\s+at\s+|\(ät\)|\[ät\])\s*([\w-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*[\w-]+)+)/i;
const PHONE_RE = /(?:Tel(?:efon|\.|:)?|Phone|Fon|Telefonnummer|Rufnummer)\s*\.?:?\s*(\+?\(?\d[\d\s()/\-.]{6,24}\d)/i;
const FAX_RE = /(?:Fax|Telefax)\s*\.?:?\s*(\+?\(?\d[\d\s()/\-.]{6,24}\d)/i;

const REPRESENTATIVE_RE = /(?:Geschäftsführende(?:r)? Gesellschafter(?:in)?|Geschäftsführer(?:in|innen|\/in)?|Geschäftsführung|Vertretungsberechtigte(?:r)?(?:\s+Geschäftsführer(?:in)?)?|Vertreten durch(?: die Geschäftsführer)?|Vorstand(?:svorsitzende(?:r)?)?|Inhaber(?:in)?|Verwaltungsrat|Gesellschafter|Vorstandsmitglieder|Komplementär(?:in)?|Director|Managing Director|CEO)\s*:?\s*([^\n]{3,160})/i;
const RESPONSIBLE_RE = /(?:Verantwortlich(?:e|er)?\s*(?:für den Inhalt|i\.?\s?S\.?\s?d\.?|im Sinne|gem(?:äß|\.)|nach)[^\n:]{0,40}|§\s*18\s*(?:Abs\.?\s*2\s*)?MStV|§\s*55\s*(?:Abs\.?\s*2\s*)?RStV|Inhaltlich Verantwortlicher?)\s*:?\s*([^\n]{3,120})/i;
const AUTHORITY_RE = /(?:Zuständige\s+)?Aufsichtsbehörde\s*:?\s*([^\n]{3,140})/i;
const PROFESSION_RE = /(?:Berufsbezeichnung|Gesetzliche Berufsbezeichnung)\s*:?\s*([^\n]{2,80})/i;
const CHAMBER_RE = /(?:Zuständige\s+)?(?:Kammer|Berufskammer|Handwerkskammer|IHK|Industrie- und Handelskammer|Rechtsanwaltskammer|Ärztekammer|Architektenkammer)\s*:?\s*([^\n]{3,120})/i;

const NOISE_PREFIX_RE = /^(?:Angaben gemäß\s*§\s*5\s*(?:TMG|DDG|ECG)\s*:?|Anbieter(?:kennzeichnung)?\s*:?|Firma\s*:?|Firmenname\s*:?|Unternehmen\s*:?|Herausgeber\s*:?|Betreiber(?: der Website)?\s*:?|Diensteanbieter\s*:?|Verantwortlich\s*:?|Impressum\s*:?|Name\s*:?|Medieninhaber\s*(?:und Herausgeber)?\s*:?)\s*/i;

/** Normalise HTML text content into clean lines. */
export function toLines(text) {
  return text
    .replace(/ /g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

function cleanName(line) {
  let n = line.replace(NOISE_PREFIX_RE, '').replace(/\s*[|·•]\s*.*$/, '').replace(/[,;:]\s*$/, '').trim();
  // "thalia.de ist ein Internetauftritt der Thalia Bücher GmbH" → "Thalia Bücher GmbH"
  const phrase = n.match(/^.*?\b(?:ist ein(?:e)? [^.]*?\b(?:der|des|von)|betrieben (?:von|durch)(?: der| die| das)?|ein (?:Angebot|Service|Unternehmen|Produkt|Dienst) (?:der|von|des)|(?:Website|Webseite|Internetauftritt|Onlineshop|Online-Shop|Seite) (?:der|des|von)|wird (?:betrieben|verantwortet) (?:von|durch)(?: der| die| das)?|verantwortlich ist(?: die| der)?|Anbieter ist(?: die| der)?|c\/o)\s+(?=[A-ZÄÖÜ])/);
  if (phrase) n = n.slice(phrase[0].length).trim();
  return n;
}

function splitPeople(s) {
  return s
    .replace(/^(?:Geschäftsführer(?:in|innen|\/in)?|Geschäftsführung|Inhaber(?:in)?|Vorstand|Verwaltungsrat|Gesellschafter)\s*:\s*/i, '')
    .replace(/\(.*?\)/g, ' ')
    .split(/\s*(?:,|;|\/|\bund\b|\bu\.\b|&|\bsowie\b)\s*/i)
    .map((p) => p.replace(/^(?:Herr|Frau|Hr\.|Fr\.|Dipl\.-?\w+\.?|Dr\.|Prof\.|Mag\.|Ing\.)\s+/g, '').trim())
    .filter((p) => p.length >= 3 && p.length <= 60 && /[A-Za-zÄÖÜäöüß]/.test(p) && !/^\d/.test(p))
    .slice(0, 8);
}

function countryFromSignals({ vatId, postalCode, prefix, text }) {
  if (vatId?.startsWith('ATU')) return 'AT';
  if (vatId?.startsWith('CHE')) return 'CH';
  if (vatId?.startsWith('DE')) return 'DE';
  if (prefix === 'A' || prefix === 'AT') return 'AT';
  if (prefix === 'CH') return 'CH';
  if (prefix === 'D' || prefix === 'DE') return 'DE';
  if (/\bÖsterreich\b|\bAustria\b|\bFirmenbuch\b|\bECG\b/.test(text)) return 'AT';
  if (/\bSchweiz\b|\bSwitzerland\b|\bSuisse\b|\bHandelsregisteramt\b|\bCHE-\b/.test(text)) return 'CH';
  if (/\bDeutschland\b|\bGermany\b|\bAmtsgericht\b|\bTMG\b|\bDDG\b/.test(text)) return 'DE';
  if (postalCode?.length === 5) return 'DE';
  return null;
}

/**
 * Extract structured company data from the plain text of an Impressum page.
 * @param {string} text plain text (newline-separated blocks)
 * @returns {object} record with null for fields not found
 */
export function extractCompanyData(text) {
  const lines = toLines(text);
  const joined = lines.join('\n');
  const r = {
    companyName: null, legalForm: null, street: null, postalCode: null, city: null, country: null,
    registerCourt: null, registerType: null, registerNumber: null, vatId: null, taxNumber: null,
    representatives: [], responsiblePerson: null, email: null, phone: null, fax: null,
    supervisoryAuthority: null, profession: null, chamber: null,
  };

  // --- VAT ID (with context check to avoid false positives) ---
  const vatMatchAll = [...joined.matchAll(new RegExp(VAT_RE.source, 'gi'))];
  for (const m of vatMatchAll) {
    const before = joined.slice(Math.max(0, m.index - 80), m.index);
    const id = m[1].replace(/[\s.]/g, '').replace(/-/g, '').toUpperCase();
    if (VAT_CONTEXT_RE.test(before) || /^(ATU|CHE)/.test(id)) {
      r.vatId = id.startsWith('CHE') ? id.replace(/^CHE(\d{3})(\d{3})(\d{3})(MWST|TVA|IVA|VAT)?$/, 'CHE-$1.$2.$3' + (id.match(/MWST|TVA|IVA|VAT$/) ? ' $4' : '')) : id;
      break;
    }
  }
  const tax = joined.match(TAX_NO_RE);
  if (tax) r.taxNumber = tax[1].replace(/\s/g, '');

  // --- Register ---
  const regType = joined.match(new RegExp('(?:Handelsregister|Registernummer|Register-?Nr\\.?|Firmenbuchnummer|Firmenbuch|HR-?Nr\\.?|Registereintrag)[^\\n]{0,40}?' + REGISTER_TYPE_RE.source, 'i')) || joined.match(REGISTER_TYPE_RE);
  if (regType) {
    r.registerType = regType[1].toUpperCase();
    if (regType[2]) r.registerNumber = regType[2].replace(/\s/g, '');
  }
  if (!r.registerNumber) {
    const fn = joined.match(/(?:Firmenbuch(?:nummer|-?Nr\.?)?|FN)\s*:?\s*(\d{4,7}\s?[a-z])/i);
    if (fn) { r.registerType = 'FN'; r.registerNumber = fn[1].replace(/\s/g, ''); }
  }
  if (!r.registerNumber) {
    const che = joined.match(/\b(CH-\d{3}\.\d\.\d{3}\.\d{3}-\d)\b/);
    if (che) { r.registerType = 'CH'; r.registerNumber = che[1]; }
  }
  const court = joined.match(REGISTER_COURT_RE);
  if (court) r.registerCourt = court[1].replace(/\s+/g, ' ').replace(/[,.;:]$/, '').trim();

  // --- Contact ---
  const email = joined.match(EMAIL_RE);
  if (email) r.email = (email[1] + '@' + email[2].replace(/\s*(?:\(dot\)|\[dot\]|\s+dot\s+|\.)\s*/gi, '.')).toLowerCase();
  const phone = joined.match(PHONE_RE);
  if (phone) r.phone = phone[1].replace(/\s+/g, ' ').trim();
  const fax = joined.match(FAX_RE);
  if (fax) r.fax = fax[1].replace(/\s+/g, ' ').trim();

  // --- People / authorities ---
  const rep = joined.match(REPRESENTATIVE_RE);
  if (rep) r.representatives = splitPeople(rep[1]);
  const resp = joined.match(RESPONSIBLE_RE);
  if (resp) r.responsiblePerson = resp[1].replace(/[,;:]\s*$/, '').trim();
  const auth = joined.match(AUTHORITY_RE);
  if (auth) r.supervisoryAuthority = auth[1].trim();
  const prof = joined.match(PROFESSION_RE);
  if (prof) r.profession = prof[1].trim();
  const chamber = joined.match(CHAMBER_RE);
  if (chamber) r.chamber = chamber[1].trim();

  // --- Address: locate postal line, then street in the 3 lines before ---
  let postalIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(POSTAL_RE);
    if (m) {
      // skip lines that are clearly phone/tax numbers
      if (/Tel|Fax|Steuer|USt|HRB|HRA|IBAN|BIC|Konto/i.test(lines[i])) continue;
      r.postalCode = m[2];
      r.city = m[3].replace(/\s*(?:Deutschland|Germany|Österreich|Austria|Schweiz|Switzerland)\s*$/i, '').trim();
      if (m[1]) r.country = countryFromSignals({ prefix: m[1], text: '' });
      postalIdx = i;
      // street may be on the same line before the postal code
      const sameLine = lines[i].slice(0, m.index);
      const s = sameLine.match(STREET_RE) || sameLine.match(STREET_FALLBACK_RE);
      if (s) r.street = s[1].trim().replace(/[,;]$/, '');
      break;
    }
  }
  if (!r.street) {
    const from = postalIdx > 0 ? Math.max(0, postalIdx - 3) : 0;
    const to = postalIdx > 0 ? postalIdx : Math.min(lines.length, 25);
    for (let i = to - 1; i >= from; i--) {
      const s = lines[i].match(STREET_RE) || (postalIdx > 0 ? lines[i].match(STREET_FALLBACK_RE) : null);
      if (s && !/\bTel|\bFax|@|\bHR[AB]\b|\bUSt/i.test(lines[i])) { r.street = s[1].trim().replace(/[,;]$/, ''); break; }
    }
  }

  // --- Company name: first line with a legal form, preferably above the address ---
  const limit = postalIdx > 0 ? postalIdx : Math.min(lines.length, 30);
  let nameIdx = -1;
  const NAME_EXCLUDE = /Öffnungszeiten|Filiale|Standort|Geschäftsführer|Vertreten durch|Registergericht|Amtsgericht|\bUSt|\bVAT\b|Handelsregister|Haftungsausschluss|Hinweis|gründen|Gründung|Vergleich|Ratgeber|Kosten|Vorteile|Nachteile|\?/i;
  const scan = Math.min(lines.length, Math.max(limit, 12));
  // pass 1: legal form at the END of the line (the normal case: "Musterfirma Software GmbH")
  for (let pass = 0; pass < 2 && nameIdx < 0; pass++) {
    for (let i = 0; i < scan; i++) {
      const line = lines[i];
      const m = line.match(LEGAL_FORM_RE);
      if (!m || line.length > 120 || NAME_EXCLUDE.test(line)) continue;
      const cleaned = cleanName(line);
      const atEnd = new RegExp(m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + '\\s*[.,)]?\\s*$', 'i').test(cleaned);
      if (pass === 0 && !atEnd) continue;
      if (cleaned.length < 4) continue;
      r.companyName = cleaned;
      r.legalForm = m[1].replace(/\s+/g, ' ');
      nameIdx = i;
      break;
    }
  }
  if (!r.companyName && postalIdx > 0) {
    // fall back: non-empty line 2-3 above the street/postal block (sole traders, e.g. "Max Mustermann Fotografie")
    const streetIdx = lines.findIndex((l, i) => i < postalIdx && r.street && l.includes(r.street));
    let j = (streetIdx > 0 ? streetIdx : postalIdx) - 1;
    while (j >= 0 && /Inhaber|Geschäftsführ|Vertreten|Verantwortlich|Öffnungszeiten|Filiale|Standort|Markt\b|Adresse|Anschrift|Postanschrift|Hauptsitz|Sitz\b/i.test(lines[j])) j--;
    const cand = lines[j];
    if (cand && cand.length <= 80 && !/@|Tel|www\.|http|Impressum|Angaben gemäß|Anbieter|Adresse|Anschrift|Kontakt|Postanschrift/i.test(cand)) {
      r.companyName = cleanName(cand);
    }
  }
  void nameIdx;
  // Public bodies: "IHK für München und Oberbayern" / "Körperschaft des öffentlichen Rechts"
  const kdoerIdx = lines.findIndex((l) => /^(Körperschaft|Anstalt|Stiftung) des öffentlichen Rechts$/i.test(l));
  if (kdoerIdx > 0 && (!r.companyName || /des öffentlichen Rechts/i.test(r.companyName))) {
    const prev = cleanName(lines[kdoerIdx - 1]);
    if (prev && prev.length <= 90 && !/@|\bTel|Impressum|Angaben gemäß/i.test(prev)) {
      r.companyName = prev;
      r.legalForm = /^Anstalt/i.test(lines[kdoerIdx]) ? 'AöR' : /^Stiftung/i.test(lines[kdoerIdx]) ? 'Stiftung des öffentlichen Rechts' : 'KdöR';
    }
  }
  if (r.companyName && r.city) {
    const suffix = new RegExp(',\\s*' + r.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
    r.companyName = r.companyName.replace(suffix, '').trim();
    if (r.companyName.endsWith(',')) r.companyName = r.companyName.slice(0, -1).trim();
  }

  r.country = r.country || countryFromSignals({ vatId: r.vatId, postalCode: r.postalCode, text: joined });

  // --- Confidence ---
  const core = [r.companyName, r.street && r.postalCode && r.city, r.registerNumber || r.vatId || r.taxNumber, r.email || r.phone];
  const found = core.filter(Boolean).length;
  r.fieldsFound = Object.entries(r).filter(([k, v]) => k !== 'fieldsFound' && v && (!Array.isArray(v) || v.length)).map(([k]) => k);
  r.confidence = Math.round((found / core.length) * 100) / 100;
  return r;
}

const SEGMENT_SCORES = [
  [/^(impressum|imprint|anbieterkennzeichnung|anbieterkennung|legal-?notice|legalnotice|mentions-?legales|impressum-datenschutz)$/i, 20],
  [/^(legal|rechtliches|rechtliche-?hinweise|colophon|impressum-und-datenschutz|datenschutz-impressum)$/i, 12],
  [/^(kontakt|contact|contact-?us|kontaktieren)$/i, 5],
  [/^(ueber-?uns|uber-?uns|about|about-?us|unternehmen)$/i, 3],
];
const TEXT_SCORES = [
  [/^(impressum|imprint|legal notice|legal|anbieterkennzeichnung|mentions légales|rechtliche hinweise|impressum & datenschutz|impressum \/ datenschutz)$/i, 18],
  [/^(impressum|imprint)\b/i, 10],
  [/\b(impressum|imprint|legal notice)\b/i, 6],
  [/^(kontakt|contact|contact us)$/i, 4],
];

function registeredDomain(hostname) {
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  if (/^(co|com|org|net|gov|ac)$/.test(sld) && parts[parts.length - 1].length === 2) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

/**
 * Given anchor candidates {href, text} from a page, return ranked absolute candidate URLs on the same registered domain.
 */
export function rankImpressumLinks(anchors, baseUrl, max = 3) {
  const scored = new Map();
  let base;
  try { base = new URL(baseUrl); } catch { return []; }
  const baseDomain = registeredDomain(base.hostname);
  for (const { href, text } of anchors) {
    if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
    let u;
    try { u = new URL(href, baseUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (registeredDomain(u.hostname) !== baseDomain) continue;
    u.hash = '';
    const segments = u.pathname.split('/').filter(Boolean).map((seg) => decodeURIComponent(seg).replace(/\.(html?|php|aspx?|jsp)$/i, ''));
    const last = segments[segments.length - 1] || '';
    let score = 0;
    for (const [re, sc] of SEGMENT_SCORES) if (re.test(last)) score = Math.max(score, sc);
    if (!score && /impressum|imprint|anbieterkennzeichnung/i.test(u.pathname)) score = 4; // substring only
    const t = (text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= 40) for (const [re, sc] of TEXT_SCORES) if (re.test(t)) score = Math.max(score, sc + (score ? 2 : 0));
    if (score === 0) continue;
    if (segments.length > 3) score -= 3;
    if (u.search) score -= 2;
    if (u.pathname.length > 60) score -= 3;
    const key = u.toString();
    scored.set(key, Math.max(scored.get(key) || 0, score));
  }
  return [...scored.entries()].filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, max);
}

const COMMON_PATHS = ['/impressum', '/impressum/', '/impressum.html', '/imprint', '/legal-notice', '/de/impressum', '/pages/impressum', '/kontakt'];

export function commonImpressumPaths(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return COMMON_PATHS.map((p) => new URL(p, u.origin).toString());
  } catch { return []; }
}

/** Reduce a Cheerio document to the text of the most likely Impressum content block. */
export function pageToText($) {
  $('script, style, noscript, svg, nav, header, footer, iframe, form, button, [role="navigation"], [aria-hidden="true"], .cookie, #cookie, .cookie-banner, .cc-window').remove();
  // Prefer <main> or an element whose id/class mentions impressum/content
  // 1) Smallest block that contains a register/VAT keyword – beats store locators, footers etc.
  const KEY = /Handelsregister|Registergericht|Firmenbuch|\bHR[AB]\b|USt-?\s?Id|Umsatzsteuer-?\s?Id|\bUID\b|Angaben gemäß|Informationspflicht/i;
  let best = null;
  let bestLen = Infinity;
  $('main, article, section, div, td, address').each((_, el) => {
    const $el = $(el);
    const t = $el.text().replace(/\s+/g, ' ').trim();
    if (t.length < 250 || t.length > 8000 || !KEY.test(t)) return;
    if (!/\b\d{4,5}\s+[A-ZÄÖÜ][a-zäöüß]/.test(t)) return; // must also contain a postal address
    if (t.length < bestLen) { best = $el; bestLen = t.length; }
  });
  const candidates = ['main', '[id*="impressum" i]', '[class*="impressum" i]', 'article', '#content', '.content', '#main', 'body'];
  for (const sel of candidates) {
    if (best) break;
    const el = $(sel).first();
    if (el.length && el.text().replace(/\s+/g, ' ').trim().length > 80) { best = el; break; }
  }
  const root = best || $('body');
  // insert newlines at block boundaries
  root.find('br').replaceWith('\n');
  root.find('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, dt, dd, section, address, span').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'span') return; // keep inline spans inline
    $el.prepend('\n'); $el.append('\n');
  });
  return root.text();
}

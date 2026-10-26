import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractCompanyData, rankImpressumLinks, pageToText, commonImpressumPaths } from '../src/extract.js';

const DE_GMBH = `Impressum
Angaben gemäß § 5 DDG
Musterfirma Software GmbH
Beispielstraße 12a
10115 Berlin
Deutschland

Vertreten durch:
Geschäftsführer: Dr. Anna Beispiel, Max Mustermann

Kontakt
Telefon: +49 (0)30 123456-0
Telefax: +49 30 123456-99
E-Mail: info (at) musterfirma-software (dot) de

Registereintrag
Eintragung im Handelsregister.
Registergericht: Amtsgericht Charlottenburg
Registernummer: HRB 123456 B

Umsatzsteuer-ID
Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE 123 456 789

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: Anna Beispiel, Beispielstraße 12a, 10115 Berlin`;

test('German GmbH impressum', () => {
  const r = extractCompanyData(DE_GMBH);
  assert.equal(r.companyName, 'Musterfirma Software GmbH');
  assert.equal(r.legalForm, 'GmbH');
  assert.equal(r.street, 'Beispielstraße 12a');
  assert.equal(r.postalCode, '10115');
  assert.equal(r.city, 'Berlin');
  assert.equal(r.country, 'DE');
  assert.deepEqual(r.representatives, ['Anna Beispiel', 'Max Mustermann']);
  assert.equal(r.phone, '+49 (0)30 123456-0');
  assert.equal(r.fax, '+49 30 123456-99');
  assert.equal(r.email, 'info@musterfirma-software.de');
  assert.equal(r.registerCourt, 'Amtsgericht Charlottenburg');
  assert.equal(r.registerType, 'HRB');
  assert.equal(r.registerNumber, '123456B');
  assert.equal(r.vatId, 'DE123456789');
  assert.match(r.responsiblePerson, /^Anna Beispiel/);
  assert.equal(r.confidence, 1);
});

const AT_GMBH = `Impressum
Informationspflicht laut § 5 ECG
Alpenblick Handels GmbH
Hauptplatz 3
A-8010 Graz
Österreich
Tel.: +43 316 123456
E-Mail: office@alpenblick.at
UID-Nummer: ATU12345678
Firmenbuchnummer: FN 123456a
Firmenbuchgericht: Landesgericht Graz
Geschäftsführung: Mag. Lisa Huber
Aufsichtsbehörde: Magistrat der Stadt Graz`;

test('Austrian GmbH impressum', () => {
  const r = extractCompanyData(AT_GMBH);
  assert.equal(r.companyName, 'Alpenblick Handels GmbH');
  assert.equal(r.postalCode, '8010');
  assert.equal(r.city, 'Graz');
  assert.equal(r.country, 'AT');
  assert.equal(r.vatId, 'ATU12345678');
  assert.equal(r.registerType, 'FN');
  assert.equal(r.registerNumber, '123456a');
  assert.equal(r.registerCourt, 'Landesgericht Graz');
  assert.deepEqual(r.representatives, ['Lisa Huber']);
  assert.equal(r.supervisoryAuthority, 'Magistrat der Stadt Graz');
});

const CH_AG = `Impressum
Helvetia Digital AG
Bahnhofstrasse 100
CH-8001 Zürich
Schweiz
Telefon +41 44 123 45 67
E-Mail: kontakt@helvetia-digital.ch
Handelsregisteramt des Kantons Zürich
UID: CHE-123.456.789 MWST
Verwaltungsrat: Peter Meier und Sandra Keller`;

test('Swiss AG impressum', () => {
  const r = extractCompanyData(CH_AG);
  assert.equal(r.companyName, 'Helvetia Digital AG');
  assert.equal(r.street, 'Bahnhofstrasse 100');
  assert.equal(r.postalCode, '8001');
  assert.equal(r.city, 'Zürich');
  assert.equal(r.country, 'CH');
  assert.equal(r.vatId, 'CHE-123.456.789 MWST');
  assert.deepEqual(r.representatives, ['Peter Meier', 'Sandra Keller']);
  assert.equal(r.phone, '+41 44 123 45 67');
});

const SOLE_TRADER = `Impressum
Angaben gemäß § 5 TMG
Jana Schulze Fotografie
Inhaberin: Jana Schulze
Lindenweg 7
04109 Leipzig
Kontakt
Telefon: 0341 9876543
E-Mail: hallo@jana-schulze.example
Steuernummer: 231/123/45678
Kleinunternehmerin gemäß § 19 UStG`;

test('Sole trader without legal form', () => {
  const r = extractCompanyData(SOLE_TRADER);
  assert.equal(r.companyName, 'Jana Schulze Fotografie');
  assert.equal(r.legalForm, null);
  assert.equal(r.street, 'Lindenweg 7');
  assert.equal(r.city, 'Leipzig');
  assert.equal(r.taxNumber, '231/123/45678');
  assert.equal(r.vatId, null);
  assert.deepEqual(r.representatives, ['Jana Schulze']);
  assert.equal(r.email, 'hallo@jana-schulze.example');
  assert.equal(r.confidence, 1);
});

test('No false VAT id without context', () => {
  const r = extractCompanyData('Kundennummer: DE123456789\nMusterladen e.K.\nMarktplatz 1\n80331 München');
  assert.equal(r.vatId, null);
  assert.equal(r.companyName, 'Musterladen e.K.');
});

test('rankImpressumLinks prefers impressum over kontakt and ignores external hosts', () => {
  const anchors = [
    { href: '/kontakt', text: 'Kontakt' },
    { href: 'https://other.example/impressum', text: 'Impressum' },
    { href: '/impressum', text: 'Impressum' },
    { href: '/legal-notice', text: 'Legal Notice' },
    { href: 'mailto:a@b.c', text: 'Mail' },
  ];
  const ranked = rankImpressumLinks(anchors, 'https://www.example.de/start');
  assert.deepEqual(ranked, ['https://www.example.de/impressum', 'https://www.example.de/legal-notice', 'https://www.example.de/kontakt']);
});

test('pageToText extracts main block with line breaks', () => {
  const $ = cheerio.load(`<html><body><nav><a href="/impressum">Impressum</a></nav>
  <main><h1>Impressum</h1><p>Test GmbH<br>Teststraße 1<br>12345 Teststadt</p><p>E-Mail: a@test.de</p></main>
  <footer>© 2026</footer></body></html>`);
  const text = pageToText($);
  const r = extractCompanyData(text);
  assert.equal(r.companyName, 'Test GmbH');
  assert.equal(r.street, 'Teststraße 1');
  assert.equal(r.postalCode, '12345');
  assert.equal(r.email, 'a@test.de');
});

test('commonImpressumPaths builds origin-based urls', () => {
  const p = commonImpressumPaths('https://shop.example.at/some/page?x=1');
  assert.equal(p[0], 'https://shop.example.at/impressum');
});

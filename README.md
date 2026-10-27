# DACH Company Data Extractor – Impressum → structured company record (+ VIES VAT check)

Give it a list of website URLs from Germany, Austria or Switzerland and get back **one clean, structured company record per domain**: legal name, legal form, street address, commercial-register court and number, VAT ID (validated live against the EU VIES service), managing directors / representatives, e-mail, phone and the URL the data was taken from.

Every DACH company website must publish these facts in its *Impressum* (§ 5 DDG in Germany, § 5 ECG in Austria, UWG/Impressumspflicht in Switzerland). This Actor finds that page, reads it and turns the free text into fields you can load straight into a CRM, a KYC workflow or an LLM pipeline.

## What you get

| Field | Example |
|---|---|
| `companyName`, `legalForm` | `Heise Medien GmbH & Co. KG`, `GmbH & Co. KG` |
| `street`, `postalCode`, `city`, `country` | `Karl-Wiechert-Allee 10`, `30625`, `Hannover`, `DE` |
| `registerCourt`, `registerType`, `registerNumber` | `Amtsgericht Hannover`, `HRB`, `60405` |
| `vatId` + `vies` | `DE813501887` → `{ valid: true, name: "...", address: "..." }` |
| `taxNumber` | `231/123/45678` (sole traders) |
| `representatives[]`, `responsiblePerson` | `["Ansgar Heise", "Beate Gerold"]` |
| `email`, `phone`, `fax` | |
| `supervisoryAuthority`, `chamber`, `profession` | regulated professions |
| `impressumUrl`, `fetchedVia`, `confidence`, `fieldsFound[]`, `errors[]` | provenance and quality signals |

`confidence` (0–1) tells you how many of the four core blocks were found: name, full address, an official identifier (register number / VAT ID / tax number) and a contact channel. Filter on `confidence >= 0.75` for CRM-grade data.

## Why this Actor

- **Legal-notice aware.** Finds the Impressum even when it is called *Imprint*, *Legal notice*, *Anbieterkennzeichnung* or hidden behind an index page with several sub-Impressums (e.g. one per product line).
- **Handles JavaScript shops.** If the legal page is rendered client-side (common for large e-commerce sites) it is automatically re-fetched with a headless browser.
- **DACH formats built in.** German `HRB/HRA`, Austrian `FN 123456a` + `ATU` UIDs, Swiss `CHE-123.456.789 MWST` UIDs, obfuscated e-mails (`info (at) firma (dot) de`), public bodies (KdöR), sole traders without a legal form.
- **VIES validation included.** DE/AT VAT IDs are checked against the official EU service and enriched with the registered name and address where the member state returns it. (Swiss UIDs are not in VIES.)
- **Agent-ready.** Works through the Apify MCP server, so an AI agent can call `dach-company-data-extractor` as a tool to look up a company before writing an offer, a contract or a due-diligence memo.

## Typical uses (Impressum scraper / imprint extractor / German company data API)

- Enrich a lead list of domains with legal entity, register number and VAT ID before importing into HubSpot, Pipedrive or Salesforce.
- Supplier / customer onboarding (KYB): confirm that the entity on the website matches the entity on the invoice.
- Verify Impressum completeness across your own portfolio of sites or client sites (agencies).
- Build a DACH company dataset from a list of websites.
- Replace manual Impressum lookups: works as an Impressum scraper, imprint extractor, Handelsregister-number finder and VAT-ID (VIES) checker in one run, for Germany (DE), Austria (AT) and Switzerland (CH).
- Call it from an AI agent via the Apify MCP server when a workflow needs the legal entity behind a website (offers, contracts, due diligence).

## Input

```json
{
  "startUrls": [{ "url": "https://www.sevdesk.de" }, { "url": "heise.de" }],
  "validateVatId": true,
  "maxCandidatesPerSite": 3,
  "tryCommonPaths": true,
  "useBrowserFallback": true
}
```

Any page of the site works as a start URL; the Actor always returns one record per domain.

## Output example

```json
{
  "inputUrl": "https://www.sevdesk.de/",
  "domain": "sevdesk.de",
  "impressumUrl": "https://sevdesk.de/impressum/",
  "fetchedVia": "http",
  "companyName": "sevDesk GmbH",
  "legalForm": "GmbH",
  "street": "Im Unteren Angel 1",
  "postalCode": "77652",
  "city": "Offenburg",
  "country": "DE",
  "registerCourt": "Amtsgericht Freiburg",
  "registerType": "HRB",
  "registerNumber": "710506",
  "vatId": "DE291779897",
  "vies": { "checked": true, "valid": true, "name": "---", "address": "---", "requestDate": "2026-10-27" },
  "representatives": ["Rico Andersen"],
  "email": "support@sevdesk.com",
  "phone": "+49-781-125508-10",
  "confidence": 1,
  "fieldsFound": ["companyName", "legalForm", "street", "postalCode", "city", "country", "registerCourt", "registerType", "registerNumber", "vatId", "representatives", "email", "phone"],
  "errors": []
}
```

## Pricing

Pay per event: you are charged **only for records with `confidence >= 0.25`**, i.e. domains where company data was actually found. Sites that are unreachable, blocked or have no legal notice cost nothing. Platform usage (compute) is billed separately by Apify as with every Actor; a typical plain-HTTP lookup uses a few seconds of compute, a browser fallback lookup a bit more.

## Accuracy and limits

- Benchmark on 20 well-known DACH sites (October 2026): 18/20 records with `confidence >= 0.75`, all 13 VAT IDs found confirmed valid by VIES. Failures were sites with aggressive bot protection.
- Impressum pages are free text; the extraction is heuristic. Always keep `impressumUrl` and `confidence` next to the data and spot-check records with `confidence < 0.75`.
- Sites that block automated access (some large retailers) may return `errors`. Use Apify Proxy (residential) via `proxyConfiguration` if you need those.
- VIES is an external EU service with occasional outages; `vies.checked = false` with a `reason` is returned in that case and the record is still delivered.

## Data protection

The Actor only reads information that the website operator is legally obliged to publish. Names of managing directors are such mandatory disclosures. Under the Apify Store terms you (the user) are the controller of the data you collect and are responsible for having a lawful basis for the intended use (e.g. B2B contact, KYB). Do not use the output for unsolicited marketing where local law requires consent.

## Changelog

- 0.1 – initial release: DACH extraction, index-page following, browser fallback, VIES validation, pay-per-event pricing.

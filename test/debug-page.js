// Usage: node test/debug-page.js <url>  → prints candidate links and extracted text/record
import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { extractCompanyData, rankImpressumLinks, pageToText } from '../src/extract.js';
const url = process.argv[2];
const res = await gotScraping({ url, timeout: { request: 20000 } });
const $ = cheerio.load(res.body);
const anchors = []; $('a[href]').each((_, a) => anchors.push({ href: $(a).attr('href'), text: $(a).text().trim() }));
console.log('final url:', res.url, 'status', res.statusCode, 'len', res.body.length);
console.log('candidates:', rankImpressumLinks(anchors, res.url, 5));
const text = pageToText($);
console.log('--- text (first 1500 chars) ---\n' + text.replace(/\n{2,}/g, '\n').slice(0, 1500));
console.log('--- record ---'); console.log(JSON.stringify(extractCompanyData(text), null, 1).slice(0, 1200));

/**
 * Google Scholar search — extracts academic paper results from scholar.google.com
 * Uses browser mode to navigate and extract results from the DOM.
 */

import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractYearFromUrl(url: string): string {
  // URLs with year in path: /2021/, /2022/, etc.
  // Note: m[0] is the full match including slashes (e.g. "/2017/")
  var m = url.match(/\/(19|20)\d{2}\//);
  if (m) return m[0].slice(1, -1); // remove leading/trailing slashes
  // arXiv: extract year from ID format like 2301.12345 (YYMM format)
  var arxivM = url.match(/arxiv\.org\/abs\/(\d{2})(\d{2})/);
  if (arxivM) {
    var year = 2000 + parseInt(arxivM[1], 10);
    return String(year);
  }
  return '';
}

function extractYearFromMeta(meta: string): string {
  if (!meta) return '';
  // Find the most likely year in meta text: a 4-digit number starting with 19 or 20
  var m = meta.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

cli({
  site: 'scholar',
  name: 'search',
  description: 'Search Google Scholar for academic papers',
  domain: 'scholar.google.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'keyword', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results (1-20)' },
    { name: 'lang', default: 'en', help: 'Language short code (e.g. en, zh)' },
    { name: 'sortBy', type: 'str', default: 'relevance', choices: ['relevance', 'date', 'citations'], help: 'Sort by: relevance, date (newest), or citations' },
  ],
  columns: ['rank', 'title', 'authors', 'publication', 'year', 'citations', 'url'],
  func: async (page, args) => {
    const limit = Math.max(1, Math.min(Number(args.limit), 20));
    const keyword = encodeURIComponent(args.keyword);
    const lang = encodeURIComponent(args.lang);
    const sortBy = args.sortBy || 'relevance';

    const url = `https://scholar.google.com/scholar?q=${keyword}&hl=${lang}&num=${limit}`;

    await page.goto(url);
    await page.wait(3);

    // For date sort, we'll sort client-side by year after fetching results
    // (Google Scholar's sort button DOM is complex to interact with via automation)

    const results = await page.evaluate(`
      (function() {
        var cards = document.querySelectorAll('.gs_ri');
        var out = [];
        var EM = 8212;
        var EN = 8211;

        for (var i = 0; i < cards.length; i++) {
          var c = cards[i];
          var t = c.querySelector('h3') || c.querySelector('.gs_rt');
          var title = t ? t.textContent.trim() : '';
          var linkEl = c.querySelector('h3 a') || c.querySelector('.gs_rt a');
          var link = linkEl ? linkEl.href : '';
          if (!title) continue;

          // Meta: .gs_a has structure: author links + em-dash + pub info
          var metaEl = c.querySelector('.gs_a');
          var raw = metaEl ? metaEl.textContent.trim() : '';
          var metaLinks = metaEl ? metaEl.querySelectorAll('a') : [];

          // Authors: first link(s) in .gs_a
          var authors = '';
          if (metaLinks.length > 0) {
            authors = metaLinks[0].textContent.trim();
            if (metaLinks.length > 1) {
              authors += ' et al.';
            }
          }

          // Publication: use the result link hostname (more reliable than meta links)
          var pub = '';
          try {
            pub = new URL(link).hostname.replace(/^www\./, '');
          } catch(e) {}

          // Citations
          var ce = c.querySelector('a[href*="cites="]') || c.querySelector('.gs_or_cit a');
          var ct = ce ? ce.textContent.trim() : '';
          var citations = ct.replace(/[^0-9]/g, '') || '';

          out.push({
            title: title,
            authors: authors,
            publication: pub,
            citations: citations,
            url: link,
            _meta: raw
          });
        }
        return out;
      })()
    `);

    if (!Array.isArray(results) || results.length === 0) {
      throw new CliError('NOT_FOUND', 'No scholar results found', 'Try a different keyword or check for CAPTCHA');
    }

    // Extract year for all results before sorting
    for (const r of results) {
      (r as any)._year = extractYearFromUrl(r.url) || extractYearFromMeta(r._meta);
    }

    // Sort results
    if (sortBy === 'citations') {
      results.sort((a, b) => (parseInt(b.citations, 10) || 0) - (parseInt(a.citations, 10) || 0));
    } else if (sortBy === 'date') {
      results.sort((a, b) => {
        const yearA = parseInt((a as any)._year, 10) || 0;
        const yearB = parseInt((b as any)._year, 10) || 0;
        return yearB - yearA; // newest first
      });
    }

    return results.slice(0, limit).map((r, i) => ({
      rank: i + 1,
      title: r.title,
      authors: r.authors,
      publication: r.publication,
      year: (r as any)._year,
      citations: r.citations,
      url: r.url,
    }));
  },
});

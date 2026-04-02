/**
 * CNKI (知网) search - navigates to CNKI search page and extracts results via DOM.
 *
 * NOTE: This adapter uses browser automation to load CNKI's Vue SPA and extract results.
 * CNKI's search results are dynamically loaded via Vue.js after initial page render.
 *
 * Tips for better results:
 * 1. Log in to CNKI in Chrome for full access
 * 2. Results improve with longer waits for Vue to hydrate
 */

import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';

cli({
  site: 'cnki',
  name: 'search',
  description: 'Search CNKI papers (中国知网)',
  domain: 'cnki.net',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results' },
  ],
  columns: ['rank', 'title', 'authors', 'source', 'date', 'url'],
  func: async (page, args) => {
    const keyword = args.query as string;
    const limit = Math.max(1, Math.min(Number(args.limit), 20));

    // Navigate to CNKI search (Vue SPA)
    await page.goto(`https://scholar.cnki.net/Search/Index?searchword=${encodeURIComponent(keyword)}`);
    await page.wait(3);

    // Try to click on "学术期刊" (Chinese Journals) tab if visible
    // The page defaults to searching foreign literature (外文总库)
    await page.evaluate(`
      (function() {
        // Look for tab buttons that switch database
        var tabs = document.querySelectorAll('[class*="tab"], [class*="nav"] li, [class*="menu"] li, [role="tab"]');
        for (var i = 0; i < tabs.length; i++) {
          var text = (tabs[i].textContent || '').trim();
          if (text.includes('学术期刊') || text.includes('中文期刊') || text.includes('期刊')) {
            tabs[i].click();
            return 'clicked';
          }
        }
        return 'not_found';
      })()
    `);
    await page.wait(5);

    // Multiple scroll passes to trigger lazy loading
    for (let i = 0; i < 5; i++) {
      await page.scroll('down', 800);
      await page.wait(2);
    }

    const pageData = await page.evaluate(`
      (function() {
        var results = [];
        var seen = new Set();

        // Check for login wall
        var loginPatterns = ['登录', 'login', '请先登录', '登录后查看', 'auth', '权限'];
        var pageText = document.body.innerText || '';
        var isLoginWall = loginPatterns.some(function(p) {
          return pageText.includes(p) && pageText.length < 500;
        });

        // CNKI result items - multiple selector patterns
        var selectors = [
          '.search-result-list .result-item',
          '.search-result-list li',
          '.article-list .article-item',
          '.thesis-list .item',
          '[class*="result-item"]',
          '[class*="list-item"]',
          '.brief-list .brief-item',
          'ul.search-list li',
          '.papers-list .paper-item'
        ];

        var listItems = [];
        selectors.forEach(function(sel) {
          try {
            var found = document.querySelectorAll(sel);
            if (found.length > 0) listItems = Array.from(found);
          } catch(e) {}
        });

        // Also check for Vue-rendered content
        if (listItems.length === 0) {
          var vueContent = document.querySelectorAll('[class*="item"], [class*="result"]');
          if (vueContent.length > 0) listItems = Array.from(vueContent).slice(0, 30);
        }

        for (var i = 0; i < listItems.length && results.length < 30; i++) {
          var item = listItems[i];
          var titleEl = item.querySelector('a[href*="cnki"], a[href*="knsi"]');
          if (!titleEl) {
            var allLinks = item.querySelectorAll('a');
            for (var j = 0; j < allLinks.length; j++) {
              var href = allLinks[j].href || '';
              if ((href.includes('cnki') || href.includes('knsi')) && !href.includes('login') && !href.includes('user')) {
                titleEl = allLinks[j];
                break;
              }
            }
          }
          var title = titleEl ? (titleEl.textContent || '').trim() : (item.textContent || '').trim().slice(0, 100);
          if (!title || title.length < 5) continue;
          var url = titleEl ? titleEl.href : '';

          // Skip navigation links
          if (url.includes('navi.cnki') || url.includes('knavi')) continue;
          if (url.includes('login') || url.includes('user')) continue;

          if (seen.has(url + title)) continue;
          seen.add(url + title);

          var authorEl = item.querySelector('[class*="author"], [class*="writer"], .authors');
          var authors = authorEl ? (authorEl.textContent || '').trim().replace(/\\s+/g, ' ') : '';
          var sourceEl = item.querySelector('[class*="source"], [class*="journal"], [class*="periodical"]');
          var source = sourceEl ? (sourceEl.textContent || '').trim() : '';
          var dateEl = item.querySelector('[class*="date"], [class*="year"], [class*="time"]');
          var date = dateEl ? (dateEl.textContent || '').trim() : '';

          results.push({ title, authors, source, date, url });
        }

        // Fallback: look for any cnki links with substantial text
        if (results.length === 0) {
          var links = document.querySelectorAll('a[href]');
          for (var i = 0; i < links.length && results.length < 30; i++) {
            var link = links[i];
            var text = (link.textContent || '').trim();
            var href = link.href || '';
            if (text.length > 10 && text.length < 300 &&
                (href.includes('cnki') || href.includes('knsi')) &&
                !href.includes('navi.cnki') && !href.includes('login') && !href.includes('user')) {
              if (!seen.has(href)) {
                seen.add(href);
                results.push({ title: text, authors: '', source: '', date: '', url: href });
              }
            }
          }
        }

        return { results: results, isLoginWall: isLoginWall };
      })()
    `);

    const results = pageData?.results || [];
    const isLoginWall = pageData?.isLoginWall || false;

    if (!Array.isArray(results) || results.length === 0) {
      if (isLoginWall) {
        throw new CliError(
          'AUTH_REQUIRED',
          'CNKI requires login',
          'Please log in to CNKI in Chrome, then try again'
        );
      }
      throw new CliError(
        'NOT_FOUND',
        'No CNKI results found for: ' + keyword,
        'Try a different keyword, or log in to CNKI in Chrome for full access'
      );
    }

    // Helper: check if text contains Chinese characters
    const hasChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

    // Helper: check if text is likely a foreign journal name
    const isForeignJournal = (title: string, source: string) => {
      const foreignPatterns = ['Nature', 'Science', 'Cell', 'Physic', 'Chemistry', 'Biology', 'Review', 'International Journal', 'European', 'American', 'Journal of', 'Living Reviews', 'Annual Review', 'Trends in'];
      const text = (title + ' ' + source).toLowerCase();
      return foreignPatterns.some(p => text.includes(p.toLowerCase()));
    };

    // Filter and sort results: separate Chinese and foreign results
    const chineseResults = results.filter(r => hasChinese(r.title) && !isForeignJournal(r.title, r.source));
    const otherResults = results.filter(r => !chineseResults.includes(r));

    // If we have Chinese results, use only those; otherwise use all results
    const finalResults = chineseResults.length > 0 ? chineseResults : results;

    return finalResults.slice(0, limit).map((r: any, i: number) => ({
      rank: i + 1,
      title: r.title,
      authors: r.authors,
      source: r.source,
      date: r.date,
      url: r.url,
    }));
  },
});

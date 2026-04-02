/**
 * VIP (维普) search - browser-based search with DOM extraction.
 *
 * NOTE: VIP uses Vue.js SPA architecture. Results are dynamically loaded.
 *
 * Tips for better results:
 * 1. Log in to VIP in Chrome for full access
 * 2. Wait time may need adjustment based on network speed
 */

import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';

cli({
  site: 'vip',
  name: 'search',
  description: 'Search VIP papers (维普)',
  domain: 'cqvip.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results' },
  ],
  columns: ['rank', 'title', 'authors', 'source', 'date', 'url'],
  func: async (page, args) => {
    const keyword = args.query as string;
    const limit = Math.max(1, Math.min(Number(args.limit), 20));

    // Navigate to VIP search (Vue SPA)
    await page.goto(`https://www.cqvip.com/so/journal/?q=${encodeURIComponent(keyword)}`);
    await page.wait(15);

    // Manual scroll to trigger lazy loading
    for (let i = 0; i < 5; i++) {
      await page.scroll('down', 800);
      await page.wait(2);
    }

    const pageData = await page.evaluate(`
      (function() {
        var results = [];
        var seen = new Set();

        // Check for login wall
        var loginPatterns = ['登录', 'login', '请先登录', '登录后查看', '权限', '认证'];
        var pageText = document.body.innerText || '';
        var isLoginWall = loginPatterns.some(function(p) {
          return pageText.includes(p) && pageText.length < 500;
        });

        // VIP result item selectors
        var selectors = [
          '.result-item',
          '.list-item',
          '.article-item',
          '.paper-item',
          '[class*="result-item"]',
          '[class*="list-item"]',
          '.search-result .item',
          '.article-list .item',
          'ul li'
        ];

        var listItems = [];
        selectors.forEach(function(sel) {
          try {
            var found = document.querySelectorAll(sel);
            if (found.length > 0) listItems = Array.from(found);
          } catch(e) {}
        });

        // Vue-rendered content check
        if (listItems.length === 0) {
          var vueContent = document.querySelectorAll('[class*="item"], [class*="result"]');
          if (vueContent.length > 0) listItems = Array.from(vueContent).slice(0, 30);
        }

        for (var i = 0; i < listItems.length && results.length < 30; i++) {
          var item = listItems[i];
          var titleEl = item.querySelector('a[href*="cqvip"], a[href*="qikan"]');
          if (!titleEl) {
            var allLinks = item.querySelectorAll('a');
            for (var j = 0; j < allLinks.length; j++) {
              var href = allLinks[j].href || '';
              if (href.includes('cqvip') && !href.includes('login') && !href.includes('user')) {
                titleEl = allLinks[j];
                break;
              }
            }
          }
          var title = titleEl ? (titleEl.textContent || '').trim() : (item.textContent || '').trim().slice(0, 100);
          if (!title || title.length < 5) continue;
          var url = titleEl ? titleEl.href : '';

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

        // Fallback: look for any cqvip links
        if (results.length === 0) {
          var links = document.querySelectorAll('a[href]');
          for (var i = 0; i < links.length && results.length < 30; i++) {
            var link = links[i];
            var text = (link.textContent || '').trim();
            var href = link.href || '';
            if (text.length > 10 && text.length < 300 &&
                href.includes('cqvip') &&
                !href.includes('login') && !href.includes('user')) {
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
          'VIP requires login',
          'Please log in to VIP in Chrome, then try again'
        );
      }
      throw new CliError(
        'NOT_FOUND',
        'No VIP results found for: ' + keyword,
        'Try a different keyword, or log in to VIP in Chrome for full access'
      );
    }

    return results.slice(0, limit).map((r: any, i: number) => ({
      rank: i + 1,
      title: r.title,
      authors: r.authors,
      source: r.source,
      date: r.date,
      url: r.url,
    }));
  },
});

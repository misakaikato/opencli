/**
 * Shidian Guji (识典古籍) search - browser-based search with DOM extraction.
 *
 * NOTE: Shidian Guji is a Chinese classical literature platform by ByteDance.
 * Public search returns limited results. Login provides better access.
 *
 * Tips for better results:
 * 1. Log in to Shidian Guji in Chrome for full access
 * 2. Public search may return few or no results without login
 */

import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';

cli({
  site: 'shidianguji',
  name: 'search',
  description: 'Search Shidian Guji classical texts (识典古籍)',
  domain: 'shidianguji.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results' },
  ],
  columns: ['rank', 'title', 'author', 'dynasty', 'url'],
  func: async (page, args) => {
    const keyword = args.query as string;
    const limit = Math.max(1, Math.min(Number(args.limit), 20));

    // Navigate to Shidian Guji search
    await page.goto(`https://www.shidianguji.com/search?q=${encodeURIComponent(keyword)}`);
    await page.wait(10);

    // Multiple scroll passes to trigger lazy loading
    for (let i = 0; i < 8; i++) {
      await page.scroll('down', 600);
      await page.wait(2);
    }

    const pageData = await page.evaluate(`
      (function() {
        var results = [];
        var seen = new Set();

        // Check for login wall
        var loginPatterns = ['登录后', '请先登录', '登录后查看', '认证后才', '登录后阅读'];
        var pageText = document.body.innerText || '';
        var isLoginWall = loginPatterns.some(function(p) {
          return pageText.includes(p) && pageText.length < 1000;
        });

        // UI text to exclude (filter out navigation/filter elements)
        var uiTexts = ['相关度排序', '按朝代排序', '搜全文', '搜书籍', '仅搜索正文', '仅搜索原字', '模糊搜索', '登录后阅读更方便'];

        // Get all links and filter for book/content results
        var links = document.querySelectorAll('a[href]');
        for (var i = 0; i < links.length && results.length < 50; i++) {
          var link = links[i];
          var href = link.href || '';
          var text = (link.textContent || '').trim();

          // Skip UI elements and navigation
          if (uiTexts.indexOf(text) > -1) continue;
          if (href.includes('login') || href.includes('user') || href.includes('account')) continue;

          // Must be a shidianguji link
          if (href.indexOf('shidianguji.com') === -1) continue;

          // Skip the search page itself (but keep results within search)
          if (href.indexOf('/search') > -1 && href.indexOf('shidianguji.com/search') > -1 && href.indexOf('q=') === -1) continue;
          if (href === 'https://www.shidianguji.com/search' || href.indexOf('shidianguji.com/search?q=') > -1) continue;

          // Filter by meaningful text content
          if (text.length < 2 || text.length > 200) continue;

          // Skip if it looks like a UI button
          if (text === '<' || text === '>' || text === '&lt;' || text === '&gt;') continue;

          if (seen.has(href)) continue;
          seen.add(href);

          // Try to extract author/dynasty from surrounding context
          var parent = link.closest('li, div[class], article');
          var author = '';
          var dynasty = '';

          if (parent) {
            var authorEl = parent.querySelector('[class*="author"], [class*="writer"], [class*="by"], .author');
            if (authorEl) author = (authorEl.textContent || '').trim().replace(/\\s+/g, ' ');
            var dynastyEl = parent.querySelector('[class*="dynasty"], [class*="period"], [class*="era"], .dynasty');
            if (dynastyEl) dynasty = (dynastyEl.textContent || '').trim();
          }

          results.push({ title: text, author: author, dynasty: dynasty, url: href });
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
          'Shidian Guji requires login',
          'Please log in to Shidian Guji in Chrome, then try again'
        );
      }
      throw new CliError(
        'NOT_FOUND',
        'No Shidian Guji results found for: ' + keyword,
        'Try a different keyword, or log in to Shidian Guji in Chrome for full access'
      );
    }

    return results.slice(0, limit).map((r: any, i: number) => ({
      rank: i + 1,
      title: r.title,
      author: r.author,
      dynasty: r.dynasty,
      url: r.url,
    }));
  },
});

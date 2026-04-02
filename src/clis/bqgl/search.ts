/**
 * 笔趣阁搜索
 *
 * 用法: opencli bqgl search <keyword>
 *
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'bqgl',
  name: 'search',
  description: '笔趣阁搜索小说',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'keyword', positional: true, required: true, help: '搜索关键词' },
  ],
  columns: ['rank', 'bookId', 'title', 'author', 'intro'],
  func: async (_page, args) => {
    const keyword = args.keyword;
    const url = `https://www.bqg291.cc/api/search?q=${encodeURIComponent(keyword)}`;
    const data = await fetch(url).then(r => r.json());

    const results: any[] = [];

    if (data.data) {
      let rank = 1;
      for (const item of data.data) {
        results.push({
          rank: rank++,
          bookId: item.id,
          title: item.title,
          author: (item.author || '').trim(),
          intro: (item.intro || '').substring(0, 80) + '...',
          url: `https://www.bqg291.cc/#/book/${item.id}/1.html`,
        });
      }
    }

    return results;
  },
});

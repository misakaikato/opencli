/**
 * 笔趣阁首页 - 最新入库和最近更新小说
 *
 * 用法: opencli bqgl home
 *
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'bqgl',
  name: 'home',
  description: '笔趣阁首页 - 最新入库和最近更新的小说',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['title', 'author', 'category', 'lastChapter', 'updateTime'],
  func: async () => {
    const data = await fetch('https://www.bqg291.cc/api/index?sort=index').then(r => r.json());

    const results: any[] = [];

    // 最新入库 (addlist)
    if (data.addlist) {
      for (const item of data.addlist) {
        results.push({
          title: item.title,
          author: item.author,
          category: item.sortname || '最新入库',
          lastChapter: '',
          updateTime: '',
          url: `https://www.bqg291.cc/#/book/${item.id}/1.html`,
          bookId: item.id,
        });
      }
    }

    // 最近更新 (uplist)
    if (data.uplist) {
      for (const item of data.uplist) {
        results.push({
          title: item.title,
          author: item.author,
          category: item.sortname || '最近更新',
          lastChapter: item.lastchapter,
          updateTime: item.uptime,
          url: `https://www.bqg291.cc/#/book/${item.id}/${item.lastchapterid}.html`,
          bookId: item.id,
        });
      }
    }

    // 去重
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(String(r.bookId))) return false;
      seen.add(String(r.bookId));
      return true;
    }).slice(0, 30);
  },
});

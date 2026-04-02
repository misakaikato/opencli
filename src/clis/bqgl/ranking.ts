/**
 * 笔趣阁排行榜
 *
 * 用法: opencli bqgl ranking [category]
 * 分类: xuanhuan | wuxia | dushi | lishi | wangyou | kehuan | mm | finish | all
 *
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';

const CATEGORIES: Record<string, { name: string }> = {
  xuanhuan: { name: '玄幻' },
  wuxia: { name: '武侠' },
  dushi: { name: '都市' },
  lishi: { name: '历史' },
  wangyou: { name: '网游' },
  kehuan: { name: '科幻' },
  mm: { name: '女生' },
  finish: { name: '完本' },
};

cli({
  site: 'bqgl',
  name: 'ranking',
  description: '笔趣阁排行榜 - 各分类热门小说排名',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'category', positional: true, default: 'all', help: '分类: xuanhuan | wuxia | dushi | lishi | wangyou | kehuan | mm | finish | all' },
    { name: 'limit', type: 'int', default: 20, help: '返回数量' },
  ],
  columns: ['rank', 'title', 'author', 'category'],
  func: async (_page, args) => {
    const cat = args.category?.toLowerCase() || 'all';
    const limit = Number(args.limit) || 20;
    const results: any[] = [];

    if (cat === 'all') {
      // 获取所有分类的排行榜
      const data = await fetch('https://www.bqg291.cc/api/index?sort=index').then(r => r.json());

      // 从首页获取排行榜 (toplist)
      if (data.toplist) {
        let rank = 1;
        for (const item of data.toplist) {
          if (rank > limit) break;
          results.push({
            rank: rank++,
            title: item.title,
            author: item.author || '',
            category: item.sortname || '',
            url: `https://www.bqg291.cc/#/book/${item.id}/1.html`,
            bookId: item.id,
          });
        }
      }
    } else {
      // 获取指定分类的排行榜
      const catInfo = CATEGORIES[cat] || { name: cat };
      const data = await fetch(`https://www.bqg291.cc/api/sort?sort=${cat}`).then(r => r.json());

      if (data.data) {
        let rank = 1;
        for (const item of data.data.slice(0, limit)) {
          results.push({
            rank: rank++,
            title: item.title,
            author: (item.author || '').trim(),
            category: catInfo.name,
            url: `https://www.bqg291.cc/#/book/${item.id}/1.html`,
            bookId: item.id,
          });
        }
      }
    }

    return results.slice(0, limit);
  },
});

export { CATEGORIES };

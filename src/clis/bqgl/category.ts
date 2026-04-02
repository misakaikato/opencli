/**
 * 笔趣阁分类页面 - 按分类查看小说
 *
 * 用法: opencli bqgl category [category] [page]
 * 分类: xuanhuan, wuxia, dushi, lishi, wangyou, kehuan, mm, finish
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
  name: 'category',
  description: '笔趣阁分类小说列表',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'category', positional: true, default: 'xuanhuan', help: '分类: xuanhuan | wuxia | dushi | lishi | wangyou | kehuan | mm | finish' },
    { name: 'page', type: 'int', default: 1, help: '页码' },
  ],
  columns: ['rank', 'title', 'author', 'intro'],
  func: async (_page, args) => {
    const cat = args.category?.toLowerCase() || 'xuanhuan';
    const page = Number(args.page) || 1;
    const url = `https://www.bqg291.cc/api/sort?sort=${cat}`;

    const data = await fetch(url).then(r => r.json());
    const results: any[] = [];

    if (data.data) {
      const start = (page - 1) * 15;
      const end = start + 15;
      data.data.slice(start, end).forEach((item: any, i: number) => {
        results.push({
          rank: start + i + 1,
          title: item.title,
          author: (item.author || '').trim(),
          intro: (item.intro || '').substring(0, 80) + '...',
          url: `https://www.bqg291.cc/#/book/${item.id}/1.html`,
          bookId: item.id,
        });
      });
    }

    return results;
  },
});

export { CATEGORIES };

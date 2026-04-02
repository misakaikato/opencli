/**
 * 笔趣阁小说详情 - 获取小说信息和章节列表
 *
 * 用法: opencli bqgl book <book_id>
 *
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'bqgl',
  name: 'book',
  description: '笔趣阁小说详情和章节列表',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'book_id', positional: true, required: true, help: '小说 ID (如 1152)' },
    { name: 'chapters', type: 'int', default: 50, help: '显示章节数量 (默认50, 0=全部)' },
  ],
  columns: ['bookId', 'chapterNum', 'chapterTitle', 'url'],
  func: async (_page, args) => {
    const bookId = args.book_id;
    const showChapters = Number(args.chapters) || 50;

    // 获取书籍详情
    const bookData = await fetch(`https://www.bqg291.cc/api/book?id=${bookId}`).then(r => r.json());
    // 获取章节列表
    const listData = await fetch(`https://www.bqg291.cc/api/booklist?id=${bookId}`).then(r => r.json());

    const results: any = {
      bookId,
      title: bookData.title || '',
      author: bookData.author || '',
      sortname: bookData.sortname || '',
      status: bookData.full || '',
      intro: (bookData.intro || '').replace(/\s+/g, ' ').trim(),
      lastChapter: bookData.lastchapter || '',
      lastUpdate: bookData.lastupdate || '',
      totalChapters: listData.list?.length || 0,
      chapters: [],
    };

    // 解析章节列表
    if (listData.list) {
      listData.list.forEach((name: string, i: number) => {
        results.chapters.push({
          bookId,
          chapterNum: i + 1,
          chapterTitle: name,
          url: `https://www.bqg291.cc/#/book/${bookId}/${i + 1}.html`,
        });
      });
    }

    // 如果只需要基本信息，返回汇总；否则返回章节列表
    if (showChapters === 0) {
      return [results];
    }
    return results.chapters.slice(0, showChapters);
  },
});

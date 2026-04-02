/**
 * 笔趣阁小说阅读 - 获取章节内容
 *
 * 用法: opencli bqgl read <book_id> <chapter>
 * 示例:
 *   opencli bqgl read 1152 1      # 第1章
 *   opencli bqgl read 1152 -1     # 最后一章
 *   opencli bqgl read 1152 -2     # 倒数第二章
 *
 * 支持负数序号（从尾部倒序），-1 表示最后一章
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'bqgl',
  name: 'read',
  description: '笔趣阁小说章节内容',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'book_id', positional: true, required: true, help: '小说 ID (如 1152)' },
    { name: 'chapter', positional: true, required: true, type: 'int', help: '章节编号 (1=第一章, -1=最后一章, -2=倒数第二章)' },
  ],
  columns: ['bookId', 'chapter', 'chapterTitle', 'content', 'prevChapter', 'nextChapter'],
  func: async (_page, args) => {
    const bookId = args.book_id;
    let chapterNum = Number(args.chapter) || 1;

    // 获取书籍详情以确定总章节数
    const bookData = await fetch(`https://www.bqg291.cc/api/book?id=${bookId}`).then(r => r.json());
    const totalChapters = bookData.lastchapterid || 0;

    // 处理负数序号（从尾部倒序）
    if (chapterNum < 0) {
      chapterNum = totalChapters + chapterNum + 1;
      if (chapterNum < 1) {
        chapterNum = 1;
      }
    }

    // 确保章节号在有效范围内
    if (chapterNum < 1) chapterNum = 1;
    if (chapterNum > totalChapters) chapterNum = totalChapters;

    const url = `https://www.bqg291.cc/api/chapter?id=${bookId}&chapterid=${chapterNum}`;
    const data = await fetch(url).then(r => r.json());

    // 格式化内容
    const content = (data.txt || '')
      .split('\n')
      .map((line: string) => '　　' + line)
      .join('\n');

    return [{
      bookId,
      chapter: chapterNum,
      chapterTitle: data.chaptername || '',
      title: data.title || '',
      content,
      author: data.author || '',
      totalChapters,
      prevChapter: chapterNum > 1 ? -(chapterNum - 1) : null,
      nextChapter: chapterNum < totalChapters ? -(chapterNum + 1) : null,
    }];
  },
});

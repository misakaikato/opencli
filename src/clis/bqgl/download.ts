/**
 * 笔趣阁下载全本 - 下载小说所有章节内容
 *
 * 用法:
 *   opencli bqgl download <book_id>              # 下载全部章节
 *   opencli bqgl download <book_id> 1 100       # 下载第1-100章
 *   opencli bqgl download <book_id> -100          # 下载最后100章
 *   opencli bqgl download <book_id> --continue    # 继续未完成的下载
 *   opencli bqgl download <book_id> --update      # 更新最新章节
 *
 * 特性:
 * - 并发下载 (默认5个并发)
 * - 随机 User-Agent 轮换
 * - 随机请求间隔 (0.5-2秒)
 * - 自动保存进度 (JSON)
 * - 支持断点续传
 * - 合并为 txt (正文) + md (元信息+目录) + json (元信息+章节，适合程序处理)
 *
 * 使用 bqg291.cc 的 API
 */
import { cli, Strategy } from '../../registry.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

// 随机 User-Agent 列表
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function getProgressPath(bookId: string): string {
  const dir = path.join(homedir(), '.bqgl-downloads');
  return path.join(dir, `${bookId}-progress.json`);
}

// 下载进度接口 (使用普通对象而非 Map，以便 JSON 序列化)
interface DownloadProgress {
  bookId: string;
  title: string;
  author: string;
  totalChapters: number;
  // 使用 Record<number, {...}> 而不是 Map，以便 JSON 序列化
  downloadedChapters: Record<number, { title: string; content: string }>;
  completedChapters: number[];
  lastUpdated: string;
  startChapter: number;
  endChapter: number;
}

function loadProgress(bookId: string): DownloadProgress | null {
  try {
    const filePath = getProgressPath(bookId);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // 确保 downloadedChapters 是对象
      if (!data.downloadedChapters || typeof data.downloadedChapters !== 'object') {
        data.downloadedChapters = {};
      }
      return data as DownloadProgress;
    }
  } catch {}
  return null;
}

function saveProgress(progress: DownloadProgress): void {
  try {
    const dir = path.join(homedir(), '.bqgl-downloads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getProgressPath(progress.bookId), JSON.stringify(progress, null, 2));
  } catch (e) {
    console.error('保存进度失败:', e);
  }
}

async function downloadChapter(
  bookId: string,
  chapter: number,
  userAgent: string
): Promise<{ chapter: number; title: string; content: string } | null> {
  try {
    const url = `https://www.bqg291.cc/api/chapter?id=${bookId}&chapterid=${chapter}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Referer': 'https://www.bqg291.cc/',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = (data.txt || '')
      .split('\n')
      .map((line: string) => '　　' + line)
      .join('\n');

    return {
      chapter,
      title: data.chaptername || `第${chapter}章`,
      content,
    };
  } catch {
    return null;
  }
}

function formatProgressBar(current: number, total: number, width: number = 30): string {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percent.toFixed(1)}% (${current}/${total})`;
}

cli({
  site: 'bqgl',
  name: 'download',
  description: '笔趣阁下载全本小说',
  domain: 'www.bqg291.cc',
  strategy: Strategy.PUBLIC,
  browser: false,
  columns: ['title', 'author', 'bookId', 'txtFile', 'mdFile', 'jsonFile', 'chaptersDownloaded', 'outputDir'],
  args: [
    { name: 'book_id', positional: true, required: true, help: '小说 ID (如 1152)' },
    { name: 'start', positional: true, type: 'int', default: 1, help: '起始章节 (默认1, 负数表示从尾部倒序)' },
    { name: 'end', positional: true, type: 'int', default: 0, help: '结束章节 (默认0表示到最后一章, 负数表示从尾部倒序)' },
    { name: 'continue', type: 'boolean', default: false, help: '继续未完成的下载' },
    { name: 'update', type: 'boolean', default: false, help: '更新最新章节' },
    { name: 'concurrency', type: 'int', default: 5, help: '并发数 (默认5)' },
    { name: 'output', type: 'string', help: '输出目录 (默认当前目录)' },
  ],
  func: async (_page, args) => {
    const bookId = args.book_id;
    const concurrency = Math.min(Math.max(Number(args.concurrency) || 5, 1), 10);
    let outputDir = args.output as string || '.';

    // 确保输出目录存在
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch {}

    // 获取书籍信息
    const bookData = await fetch(`https://www.bqg291.cc/api/book?id=${bookId}`).then(r => r.json());
    const totalChapters = bookData.lastchapterid || 0;
    const bookTitle = bookData.title || `book_${bookId}`;
    const bookAuthor = bookData.author || '未知';

    // 处理更新模式
    if (args.update) {
      const progress = loadProgress(bookId);
      if (!progress) {
        return [{ error: '没有找到下载记录，请先执行完整下载' }];
      }
      args.start = progress.completedChapters.length > 0
        ? Math.max(...progress.completedChapters) + 1
        : totalChapters;
      args.end = totalChapters;
      console.log(`\n📡 更新模式: 从第 ${args.start} 章开始...\n`);
    }

    // 处理继续模式
    if (args.continue) {
      const progress = loadProgress(bookId);
      if (!progress) {
        return [{ error: '没有找到下载记录' }];
      }
      const missingChapters: number[] = [];
      for (let i = progress.startChapter; i <= progress.endChapter; i++) {
        if (!progress.completedChapters.includes(i)) {
          missingChapters.push(i);
        }
      }
      if (missingChapters.length === 0) {
        console.log('\n✅ 下载已完成!\n');
        return generateFiles(progress, outputDir);
      }
      console.log(`\n📡 继续模式: 还有 ${missingChapters.length} 章未下载\n`);
      args.start = Math.min(...missingChapters);
      args.end = Math.max(...missingChapters);
    }

    // 计算下载范围
    let start = Number(args.start) || 1;
    let end = Number(args.end) || totalChapters;

    if (start < 0) start = totalChapters + start + 1;
    if (end < 0) end = totalChapters + end + 1;
    else if (end === 0) end = totalChapters;

    if (start < 1) start = 1;
    if (end > totalChapters) end = totalChapters;
    if (start > end) [start, end] = [end, start];

    const totalToDownload = end - start + 1;

    console.log(`\n📚 开始下载: ${bookTitle}`);
    console.log(`👤 作者: ${bookAuthor}`);
    console.log(`📖 章节范围: ${start} - ${end} (共 ${totalToDownload} 章)`);
    console.log(`⚡ 并发数: ${concurrency}`);
    console.log('');

    // 初始化进度
    let progress = loadProgress(bookId);
    if (!progress || !args.continue && !args.update) {
      progress = {
        bookId,
        title: bookTitle,
        author: bookAuthor,
        totalChapters,
        downloadedChapters: {},
        completedChapters: [],
        lastUpdated: new Date().toISOString(),
        startChapter: start,
        endChapter: end,
      };
    }

    // 确定需要下载的章节
    const toDownload: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!progress.completedChapters.includes(i)) {
        toDownload.push(i);
      }
    }

    if (toDownload.length === 0) {
      console.log('✅ 所有章节已下载完成!\n');
      return generateFiles(progress, outputDir);
    }

    // 使用 Promise.all 进行并发控制
    const chunks: number[][] = [];
    for (let i = 0; i < toDownload.length; i += concurrency) {
      chunks.push(toDownload.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (chapter) => {
        const userAgent = getRandomUserAgent();
        const result = await downloadChapter(bookId, chapter, userAgent);

        if (result) {
          progress.downloadedChapters[chapter] = {
            title: result.title,
            content: result.content,
          };
          progress.completedChapters.push(chapter);
          progress.lastUpdated = new Date().toISOString();
          saveProgress(progress);

          const downloaded = progress.completedChapters.filter(
            c => c >= start && c <= end
          ).length;
          process.stdout.write(`\r${formatProgressBar(downloaded, totalToDownload)}  `);
        }

        return result;
      });

      await Promise.all(promises);
      await randomDelay(200, 500);
    }

    console.log('\n\n✅ 下载完成!\n');

    return generateFiles(progress, outputDir);
  },
});

function generateFiles(progress: DownloadProgress, outputDir: string): any[] {
  const { bookId, title, author, startChapter, endChapter, completedChapters, downloadedChapters } = progress;

  const cleanTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
  const txtPath = path.join(outputDir, `${cleanTitle}.txt`);
  const mdPath = path.join(outputDir, `${cleanTitle}.md`);
  const jsonPath = path.join(outputDir, `${cleanTitle}.json`);

  // 生成 JSON (适合程序后处理)
  const sortedChapters = completedChapters
    .filter(c => c >= startChapter && c <= endChapter)
    .sort((a, b) => a - b);

  const jsonData = {
    meta: {
      bookId,
      title,
      author,
      totalChapters: progress.totalChapters,
      downloadedRange: { start: startChapter, end: endChapter },
      downloadedAt: new Date().toISOString(),
      lastUpdated: progress.lastUpdated,
    },
    chapters: sortedChapters.map(chapterNum => ({
      chapterNum,
      title: downloadedChapters[chapterNum]?.title || `第${chapterNum}章`,
      content: downloadedChapters[chapterNum]?.content || '',
    })),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');

  // 生成 TXT
  let txtContent = `${title}\n`;
  txtContent += `${'='.repeat(40)}\n\n`;
  txtContent += `作者: ${author}\n`;
  txtContent += `下载范围: 第${startChapter}章 - 第${endChapter}章\n`;
  txtContent += `下载时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  txtContent += `${'='.repeat(40)}\n\n`;

  for (const chapterNum of sortedChapters) {
    const chapter = downloadedChapters[chapterNum];
    if (chapter) {
      txtContent += `\n\n${'#'.repeat(20)}\n`;
      txtContent += `${chapter.title}\n`;
      txtContent += `${'#'.repeat(20)}\n\n`;
      txtContent += chapter.content;
      txtContent += '\n\n';
    }
  }

  fs.writeFileSync(txtPath, txtContent, 'utf-8');

  // 生成 MD
  let mdContent = `---\n`;
  mdContent += `title: "${title}"\n`;
  mdContent += `author: "${author}"\n`;
  mdContent += `bookId: ${bookId}\n`;
  mdContent += `totalChapters: ${progress.totalChapters}\n`;
  mdContent += `downloadedRange: "${startChapter}-${endChapter}"\n`;
  mdContent += `downloadedAt: "${new Date().toISOString()}"\n`;
  mdContent += `lastUpdated: "${progress.lastUpdated}"\n`;
  mdContent += `---\n\n`;

  mdContent += `# ${title}\n\n`;
  mdContent += `**作者**: ${author}\n\n`;
  mdContent += `**bookId**: ${bookId}\n\n`;
  mdContent += `**总章节数**: ${progress.totalChapters}\n\n`;
  mdContent += `**下载范围**: 第${startChapter}章 - 第${endChapter}章\n\n`;
  mdContent += `**下载完成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  mdContent += `> 📖 正文: \`${cleanTitle}.txt\`\n\n`;
  mdContent += `---\n\n`;
  mdContent += `## 📑 目录\n\n`;

  for (const chapterNum of sortedChapters) {
    const chapter = downloadedChapters[chapterNum];
    if (chapter) {
      mdContent += `- 第${chapterNum}章: ${chapter.title}\n`;
    }
  }

  mdContent += `\n---\n\n`;
  mdContent += `*此文件由 bqgl opencli 适配器自动生成*\n`;

  fs.writeFileSync(mdPath, mdContent, 'utf-8');

  console.log(`📄 已生成: ${txtPath}`);
  console.log(`📄 已生成: ${mdPath}`);
  console.log(`📄 已生成: ${jsonPath}`);

  return [{
    title,
    author,
    bookId,
    txtFile: txtPath,
    mdFile: mdPath,
    jsonFile: jsonPath,
    chaptersDownloaded: sortedChapters.length,
    outputDir,
  }];
}

export { loadProgress, saveProgress, getProgressPath };

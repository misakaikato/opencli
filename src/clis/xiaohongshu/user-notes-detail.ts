/**
 * 小红书用户笔记详情 - 获取指定用户的笔记列表，每篇包含完整互动数据和正文
 */
import { cli, Strategy } from '../../registry.js';
import { normalizeXhsUserId } from './user-helpers.js';

function parseChineseCount(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = String(text).trim();
  const match = trimmed.match(/^([\d.]+)(万|亿)?$/);
  if (!match) return 0;
  let num = parseFloat(match[1]) || 0;
  if (match[2] === '万') num *= 10000;
  else if (match[2] === '亿') num *= 100000000;
  return Math.round(num);
}

async function readUserPageSnapshot(page: any) {
  return await page.evaluate(`
    (() => {
      const safeClone = (value) => {
        try {
          return JSON.parse(JSON.stringify(value ?? null));
        } catch {
          return null;
        }
      };
      const userStore = window.__INITIAL_STATE__?.user || {};
      return {
        noteGroups: safeClone(userStore.notes?._value || userStore.notes || []),
        pageData: safeClone(userStore.userPageData?._value || userStore.userPageData || {}),
        basicInfo: safeClone(userStore?.basicInfo?._value || userStore?.basicInfo || {}),
      };
    })()
  `);
}

function flattenNoteGroups(noteGroups: unknown): any[] {
  if (!Array.isArray(noteGroups)) return [];
  const notes: any[] = [];
  for (const group of noteGroups) {
    if (!group) continue;
    if (Array.isArray(group)) {
      for (const item of group) {
        if (item) notes.push(item);
      }
      continue;
    }
    notes.push(group);
  }
  return notes;
}

function toCleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function extractNotesFromSnapshot(snapshot: any, userId: string): any[] {
  const notes: any[] = [];
  const seen = new Set<string>();
  const noteGroups = flattenNoteGroups(snapshot.noteGroups);

  for (const entry of noteGroups) {
    const noteCard = entry?.noteCard ?? entry?.note_card ?? entry;
    if (!noteCard || typeof noteCard !== 'object') continue;

    const noteId = toCleanString(
      noteCard.noteId ?? noteCard.note_id ?? entry?.noteId ?? entry?.note_id ?? entry?.id
    );
    if (!noteId || seen.has(noteId)) continue;
    seen.add(noteId);

    const xsecToken = toCleanString(
      entry?.xsecToken ?? entry?.xsec_token ?? noteCard.xsecToken ?? noteCard.xsec_token
    );

    const interactInfo = noteCard.interactInfo ?? noteCard.interact_info ?? {};
    const likedCount = interactInfo.likedCount ?? interactInfo.liked_count ?? interactInfo.likes ?? 0;
    const collectedCount = interactInfo.collectedCount ?? interactInfo.collected_count ?? interactInfo.collects ?? 0;
    const commentCount = interactInfo.commentCount ?? interactInfo.comment_count ?? interactInfo.comments ?? 0;

    notes.push({
      id: noteId,
      title: toCleanString(noteCard.displayTitle ?? noteCard.display_title ?? noteCard.title),
      type: toCleanString(noteCard.type),
      url: noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : '',
      xsecToken,
      likes: typeof likedCount === 'number' ? likedCount : parseInt(String(likedCount), 10) || 0,
      collects: typeof collectedCount === 'number' ? collectedCount : parseInt(String(collectedCount), 10) || 0,
      comments: typeof commentCount === 'number' ? commentCount : parseInt(String(commentCount), 10) || 0,
    });
  }

  return notes;
}

function extractUserInfo(snapshot: any): any {
  // 从 basicInfo 直接获取（snapshot.basicInfo 已包含 basicInfo 数据）
  let basicInfo = snapshot.basicInfo || {};
  // 处理嵌套的 basicInfo 结构
  if (basicInfo.basicInfo) {
    basicInfo = { ...basicInfo, ...basicInfo.basicInfo };
  }
  const pageData = snapshot.pageData || {};
  // pageData 中也可能有 basicInfo
  if (pageData.basicInfo) {
    basicInfo = { ...basicInfo, ...pageData.basicInfo };
  }

  // 从 interactions 获取粉丝/关注/获赞
  const interactions = pageData.interactions || [];
  let fans = 0, follow = 0, liked = 0;
  for (const item of interactions) {
    if (item.type === 'fans') fans = parseChineseCount(item.count);
    else if (item.type === 'follows') follow = parseChineseCount(item.count);
    else if (item.type === 'interaction') liked = parseChineseCount(item.count);
  }

  // 如果 interactions 为空，尝试从 basicInfo 获取
  if (fans === 0 && basicInfo.fans) fans = basicInfo.fans;
  if (follow === 0 && basicInfo.follows) follow = basicInfo.follows;
  if (liked === 0 && basicInfo.liked) liked = basicInfo.liked;

  // 尝试多种路径获取 nickname
  const nickname = basicInfo.nickname || basicInfo.name || basicInfo.displayName ||
                   pageData.nickname || pageData.name || '未知';

  return {
    nickname,
    fans,
    follow,
    liked,
  };
}

async function fetchNoteDetail(page: any, noteId: string, xsecToken: string): Promise<any> {
  const noteUrl = `https://www.xiaohongshu.com/explore/${noteId}${xsecToken ? `?xsec_token=${xsecToken}` : ''}`;

  // 直接导航到笔记页面
  await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.wait(3);

  const result = await page.evaluate(`
    (targetNoteId) => {
      const parseNum = (text) => {
        if (!text) return 0;
        const t = String(text).trim();
        const m = t.match(/^([\\d.]+)(万|亿)?$/);
        if (!m) return parseInt(t.replace(/[^\\d]/g, '')) || 0;
        let n = parseFloat(m[1]) || 0;
        if (m[2] === '万') n *= 10000;
        else if (m[2] === '亿') n *= 100000000;
        return Math.round(n);
      };

      let likes = 0, collects = 0, comments = 0, content = '';

      // 优先从 __INITIAL_STATE__ 获取（DOM 选择器不稳定）
      try {
        const state = window.__INITIAL_STATE__ || {};
        const noteMap = state.note?.noteDetailMap || state.noteDetailMap || {};
        const keys = Object.keys(noteMap);

        // 优先找匹配 targetNoteId 的 key，避免读到上一页缓存
        let noteData = null;
        for (const key of keys) {
          const d = noteMap[key];
          const n = d?.note || d || {};
          if (n.noteId === targetNoteId || n.id === targetNoteId) {
            noteData = d;
            break;
          }
        }
        // 兜底：取第一个 key（页面刚加载完时通常是目标笔记）
        if (!noteData && keys.length > 0) {
          noteData = noteMap[keys[0]];
        }
        if (noteData) {
          const n = noteData?.note || noteData || {};
          const info = n.interactInfo || n.interact_info || {};
          likes = info.likedCount || info.liked_count || 0;
          collects = info.collectedCount || info.collected_count || 0;
          comments = info.commentCount || info.comment_count || 0;
          if (n.desc) content = n.desc;
        }
      } catch (e) {}

      // DOM 兜底（当 __INITIAL_STATE__ 没有时）
      if (likes === 0 || collects === 0 || comments === 0 || !content) {
        const likeEl = document.querySelector('.like-wrapper span.count') ||
                       document.querySelector('span.like-wrapper span.count');
        const collectEl = document.querySelector('.collect-wrapper span.count') ||
                          document.querySelector('#note-page-collect-board-guide span.count') ||
                          document.querySelector('#note-page-collect-board-guide > span');
        const commentEl = document.querySelector('.chat-wrapper span.count') ||
                          document.querySelector('span.chat-wrapper span.count');
        const contentEl = document.querySelector('#detail-desc') ||
                          document.querySelector('.note-content') ||
                          document.querySelector('.desc');

        if (likes === 0 && likeEl) likes = parseNum(likeEl.textContent);
        if (collects === 0 && collectEl) collects = parseNum(collectEl.textContent);
        if (comments === 0 && commentEl) comments = parseNum(commentEl.textContent);
        if (!content && contentEl) content = (contentEl.textContent || '').trim();
      }

      return { likes, collects, comments, content: content.substring(0, 5000) };
    }
  `, noteId);

  return {
    likes: typeof result?.likes === 'number' ? result.likes : parseInt(String(result?.likes || '0'), 10) || 0,
    collects: typeof result?.collects === 'number' ? result.collects : parseInt(String(result?.collects || '0'), 10) || 0,
    comments: typeof result?.comments === 'number' ? result.comments : parseInt(String(result?.comments || '0'), 10) || 0,
    content: result?.content || '',
  };
}

function formatProgressBar(current: number, total: number, width: number = 30): string {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percent.toFixed(1)}% (${current}/${total})`;
}

cli({
  site: 'xiaohongshu',
  name: 'user-notes-detail',
  description: '小红书用户笔记详情 - 含互动数据和正文',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'id', positional: true, required: true, help: '用户 ID 或主页 URL' },
    { name: 'notes', type: 'int', default: 10, help: '获取笔记数量 (默认10，建议不超过20)' },
    { name: 'concurrency', type: 'int', default: 1, help: '并发数 (默认1，小红书建议使用1)' },
  ],
  columns: ['rank', 'id', 'title', 'type', 'likes', 'collects', 'comments', 'contentLength'],
  func: async (page, kwargs) => {
    console.log('DEBUG: Main func started');
    const userId = normalizeXhsUserId(String(kwargs.id));
    const notesLimit = Math.max(1, Math.min(Number(kwargs.notes ?? 10), 50));
    const concurrency = Math.max(1, Math.min(Number(kwargs.concurrency ?? 3), 5));
    await page.goto(`https://www.xiaohongshu.com/user/profile/${userId}`);
    await page.wait(3);
    const snapshot = await readUserPageSnapshot(page);
    const userInfo = extractUserInfo(snapshot);
    const allNotes = extractNotesFromSnapshot(snapshot, userId);
    const fmtNum = (n: number) => n >= 10000 ? `${(n/10000).toFixed(1)}万` : String(n);
    console.log(`\n📕 用户: ${userInfo.nickname || '未知'}`);
    console.log(`👥 粉丝: ${fmtNum(userInfo.fans)} | 关注: ${fmtNum(userInfo.follow)} | 获赞: ${fmtNum(userInfo.liked)}`);
    console.log(`📝 找到 ${allNotes.length} 篇笔记，将获取前 ${notesLimit} 篇的详情...\n`);
    const notesToProcess = allNotes.slice(0, notesLimit);
    const results: any[] = [];
    for (let i = 0; i < notesToProcess.length; i += concurrency) {
      const batch = notesToProcess.slice(i, i + concurrency);
      const batchPromises = batch.map(async (note: any, idx: number) => {
        console.log('DEBUG: Processing note', note.id);
        try {
          const detail = await fetchNoteDetail(page, note.id, note.xsecToken);
          process.stdout.write(`\r${formatProgressBar(i + idx + 1, notesToProcess.length)}  `);
          return {
            rank: i + idx + 1,
            id: note.id,
            title: note.title,
            type: note.type,
            likes: detail.likes || note.likes || 0,
            collects: detail.collects || note.collects || 0,
            comments: detail.comments || note.comments || 0,
            content: detail.content,
            contentLength: detail.content.length,
            url: note.url,
          };
        } catch {
          return {
            rank: i + idx + 1,
            id: note.id,
            title: note.title,
            type: note.type,
            likes: note.likes || 0,
            collects: note.collects || 0,
            comments: note.comments || 0,
            content: '',
            contentLength: 0,
            url: note.url,
          };
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }
    console.log('\n\n✅ 获取完成!\n');

    // 在结果开头添加用户信息行
    const userRow = {
      rank: '👤',
      id: userId,
      title: userInfo.nickname || '未知',
      type: `粉丝:${userInfo.fans || 0} 关注:${userInfo.follow || 0} 获赞:${userInfo.liked || 0}`,
      likes: userInfo.fans || 0,
      collects: userInfo.follow || 0,
      comments: userInfo.liked || 0,
      content: '',
      contentLength: 0,
      url: `https://www.xiaohongshu.com/user/profile/${userId}`,
    };
    return [userRow, ...results];
  },
});

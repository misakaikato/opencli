/**
 * 小红书用户详情 - 获取任意用户的账号信息和笔记互动数据
 *
 * 用法:
 *   opencli xiaohongshu user-stats <user-id-or-url> [--notes 50]
 *
 * 获取：
 * - 账号信息：粉丝数、关注数、获赞与收藏数
 * - 最近笔记：点赞、收藏、评论数
 *
 * 使用公开页面数据，不需要登录
 */
import { cli, Strategy } from '../../registry.js';
import { normalizeXhsUserId, buildXhsNoteUrl } from './user-helpers.js';

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

function extractUserInfo(pageData: any, basicInfo: any): any {
  // 尝试从多种数据结构中提取用户信息
  const info = basicInfo || pageData?.basicInfo || pageData?.userInfo || pageData || {};

  // 从 basicInfo 中提取
  if (info.basicInfo) {
    const basic = info.basicInfo;
    return {
      userId: basic.userId || basic.user_id || '',
      nickname: basic.nickname || basic.name || '',
      avatar: basic.avatar || '',
      fans: basic.fans || basic.follower_count || basic.followers || 0,
      follow: basic.follow || basic.following_count || 0,
      liked: basic.liked || basic.liked_count || basic.favorited || 0,
      collected: basic.collected || basic.collect_count || 0,
      intro: basic.intro || basic.desc || basic.description || '',
      ipLocation: basic.ip_location || basic.ipLocation || '',
      gender: basic.gender || '',
      tags: basic.tags || [],
    };
  }

  // 从 pageData 中提取
  const user = info.user || info;
  return {
    userId: user.userId || user.user_id || '',
    nickname: user.nickname || user.name || '',
    avatar: user.avatar || '',
    fans: user.fans || user.follower_count || user.followers || pageData.fans || 0,
    follow: user.follow || user.following_count || user.following || pageData.follows || 0,
    liked: user.liked || user.liked_count || user.favorited || pageData.liked || 0,
    collected: user.collected || user.collect_count || pageData.collected || 0,
    intro: user.intro || user.desc || user.description || '',
    ipLocation: user.ip_location || user.ipLocation || '',
    gender: user.gender || '',
    tags: [],
  };
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

function extractNotesWithStats(notes: any[], userId: string): any[] {
  const rows: any[] = [];
  const seen = new Set<string>();

  for (const entry of notes) {
    const noteCard = entry?.noteCard ?? entry?.note_card ?? entry;
    if (!noteCard || typeof noteCard !== 'object') continue;

    const noteId = toCleanString(noteCard.noteId ?? noteCard.note_id ?? entry?.noteId ?? entry?.note_id ?? entry?.id);
    if (!noteId || seen.has(noteId)) continue;
    seen.add(noteId);

    const xsecToken = toCleanString(entry?.xsecToken ?? entry?.xsec_token ?? noteCard.xsecToken ?? noteCard.xsec_token);

    // 提取互动数据
    const interactInfo = noteCard.interactInfo ?? noteCard.interact_info ?? {};
    const likedCount = interactInfo.likedCount ?? interactInfo.liked_count ?? interactInfo.likes ?? 0;
    const collectedCount = interactInfo.collectedCount ?? interactInfo.collected_count ?? interactInfo.collects ?? 0;
    const commentCount = interactInfo.commentCount ?? interactInfo.comment_count ?? interactInfo.comments ?? 0;

    // 某些数据可能在 other_data 或 similar_list 中
    const otherData = noteCard.otherData ?? noteCard.other_data ?? {};
    const viewCount = otherData.viewCount ?? otherData.view_count ?? otherData.views ?? 0;

    rows.push({
      id: noteId,
      title: toCleanString(noteCard.displayTitle ?? noteCard.display_title ?? noteCard.title),
      type: toCleanString(noteCard.type),
      likes: typeof likedCount === 'number' ? likedCount : parseInt(String(likedCount), 10) || 0,
      collects: typeof collectedCount === 'number' ? collectedCount : parseInt(String(collectedCount), 10) || 0,
      comments: typeof commentCount === 'number' ? commentCount : parseInt(String(commentCount), 10) || 0,
      views: typeof viewCount === 'number' ? viewCount : parseInt(String(viewCount), 10) || 0,
      url: buildXhsNoteUrl(userId, noteId, xsecToken),
      date: toCleanString(noteCard.time ?? noteCard.lastUpdateTime ?? noteCard.update_time ?? ''),
    });
  }

  return rows;
}

cli({
  site: 'xiaohongshu',
  name: 'user-stats',
  description: '小红书用户详情 - 账号信息 + 笔记互动数据',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'id', positional: true, required: true, help: '用户 ID 或主页 URL' },
    { name: 'notes', type: 'int', default: 50, help: '获取笔记数量 (默认50)' },
  ],
  columns: ['rank', 'id', 'title', 'type', 'likes', 'collects', 'comments', 'views', 'url'],
  func: async (page, kwargs) => {
    const userId = normalizeXhsUserId(String(kwargs.id));
    const notesLimit = Math.max(1, Math.min(Number(kwargs.notes ?? 50), 100));

    await page.goto(`https://www.xiaohongshu.com/user/profile/${userId}`);

    let snapshot = await readUserPageSnapshot(page);
    let userInfo = extractUserInfo(snapshot.pageData, snapshot.basicInfo);
    let notes = extractNotesWithStats(flattenNoteGroups(snapshot.noteGroups), userId);

    // 如果笔记数量不够，尝试滚动加载更多
    let previousCount = notes.length;
    for (let i = 0; notes.length < notesLimit && i < 5; i += 1) {
      await page.autoScroll({ times: 1, delayMs: 1500 });
      await page.wait(1);

      snapshot = await readUserPageSnapshot(page);
      notes = extractNotesWithStats(flattenNoteGroups(snapshot.noteGroups), userInfo.userId || userId);

      if (notes.length <= previousCount) break;
      previousCount = notes.length;
    }

    // 如果还没获取到用户信息，尝试从 pageData 直接提取
    if (!userInfo.nickname) {
      const pageData = snapshot.pageData || {};
      userInfo = {
        userId,
        nickname: pageData.nickname || pageData.name || userId,
        avatar: '',
        fans: pageData.fans || pageData.follower_count || 0,
        follow: pageData.follow || pageData.following_count || 0,
        liked: pageData.liked || pageData.liked_count || 0,
        collected: pageData.collected || pageData.collect_count || 0,
        intro: '',
        ipLocation: '',
        gender: '',
        tags: [],
      };
    }

    // 限制笔记数量
    const limitedNotes = notes.slice(0, notesLimit);

    // 构建输出：用户信息 + 笔记列表
    const results: any[] = [];

    // 第一行：用户基本信息
    results.push({
      rank: '👤',
      id: userId,
      title: userInfo.nickname || '未知',
      type: `粉丝:${userInfo.fans || 0} 关注:${userInfo.follow || 0} 获赞:${userInfo.liked || 0} 收藏:${userInfo.collected || 0}`,
      likes: userInfo.fans || 0,
      collects: userInfo.follow || 0,
      comments: userInfo.liked || 0,
      views: userInfo.collected || 0,
      url: `https://www.xiaohongshu.com/user/profile/${userId}`,
    });

    // 后续行：每篇笔记的数据
    for (let i = 0; i < limitedNotes.length; i++) {
      const note = limitedNotes[i];
      results.push({
        rank: i + 1,
        id: note.id,
        title: note.title,
        type: note.type,
        likes: note.likes,
        collects: note.collects,
        comments: note.comments,
        views: note.views,
        url: note.url,
      });
    }

    return results;
  },
});

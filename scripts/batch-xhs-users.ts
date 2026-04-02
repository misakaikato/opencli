/**
 * 批量处理小红书用户数据
 * 从 Excel 读取用户链接，获取每个用户的笔记数据，保存到新 Excel
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import XLSX from 'xlsx';

const INPUT_FILE = '/Users/mayu/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_qynrjjqydnqm22_915b/temp/drag/小红书账号链接0326.xlsx';
const OUTPUT_FILE = '/Users/mayu/Projects/opencli/xhs_user_data.xlsx';
const NOTES_PER_USER = 50;

interface NoteData {
  rank: number;
  id: string;
  title: string;
  type: string;
  likes: number;
  collects: number;
  comments: number;
  content: string;
  contentLength: number;
  url: string;
}

interface UserData {
  nickname: string;
  fans: number;
  follow: number;
  liked: number;
  notes: NoteData[];
  url: string;
}

function extractUserId(url: string): string {
  const match = url.match(/profile\/([a-f0-9]+)/i);
  return match ? match[1] : url;
}

async function fetchUserData(userUrl: string): Promise<UserData | null> {
  const userId = extractUserId(userUrl);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📥 正在获取用户: ${userId}`);
  console.log(`${'='.repeat(60)}}\n`);

  try {
    const cmd = `opencli xiaohongshu user-notes-detail "${userUrl}" --notes ${NOTES_PER_USER} --concurrency 1 -f json`;
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 600000, // 10 minutes
      maxBuffer: 50 * 1024 * 1024, // 50MB
      env: { ...process.env, OPENCLI_BROWSER_COMMAND_TIMEOUT: '300000' }, // 5 minutes per command
    });

    // 解析 JSON 输出（跳过控制台日志）
    const lines = output.split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('[')) {
        jsonStart = i;
        break;
      }
    }

    if (jsonStart === -1) {
      console.error('❌ 未找到 JSON 数据');
      return null;
    }

    const jsonStr = lines.slice(jsonStart).join('\n');
    const allData: any[] = JSON.parse(jsonStr);

    // 从 JSON 数据的第一行提取用户信息（第一行是用户信息，后续行是笔记）
    let nickname = userId;
    let fans = 0, follow = 0, liked = 0;

    if (allData.length > 0 && allData[0].rank === '👤') {
      nickname = allData[0].title || userId;
      // 从 type 字段解析：'粉丝:XXX 关注:XXX 获赞:XXX 收藏:XXX'
      const typeStr = allData[0].type || '';
      const fansMatch = typeStr.match(/粉丝[:：](\d+)/);
      const followMatch = typeStr.match(/关注[:：](\d+)/);
      const likedMatch = typeStr.match(/获赞[:：](\d+)/);
      if (fansMatch) fans = parseInt(fansMatch[1]);
      if (followMatch) follow = parseInt(followMatch[1]);
      if (likedMatch) liked = parseInt(likedMatch[1]);
    }

    // 剩余行是笔记数据（跳过第一行用户信息）
    const notes: NoteData[] = allData.slice(1);

    console.log(`✅ 获取成功: ${nickname} (${notes.length} 篇笔记)`);

    return {
      nickname,
      fans,
      follow,
      liked,
      notes,
      url: userUrl,
    };
  } catch (error: any) {
    console.error(`❌ 获取失败: ${error.message}`);
    return null;
  }
}

function sanitizeSheetName(name: string): string {
  // Excel sheet 名称限制：31 字符，不能包含 : \ / ? * [ ]
  return name
    .replace(/[:\\\/?*\[\]]/g, '_')
    .substring(0, 31);
}

async function main() {
  console.log('🚀 开始批量处理小红书用户数据\n');
  console.log(`📥 输入文件: ${INPUT_FILE}`);
  console.log(`📤 输出文件: ${OUTPUT_FILE}`);
  console.log(`📝 每用户笔记数: ${NOTES_PER_USER}\n`);

  // 读取输入 Excel
  const wb = XLSX.readFile(INPUT_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const urls = data.flat().filter((cell: any) =>
    typeof cell === 'string' && cell.includes('xiaohongshu.com/user/profile')
  );

  console.log(`📋 找到 ${urls.length} 个用户链接\n`);

  const outputWb = XLSX.utils.book_new();
  const summaryData: any[] = [];

  // 处理每个用户
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n📍 进度: ${i + 1}/${urls.length}`);

    const userData = await fetchUserData(url);

    if (userData) {
      // 创建用户 sheet（添加序号避免重名）
      const baseName = sanitizeSheetName(userData.nickname || `User${i + 1}`);
      const sheetName = `${i + 1}_${baseName}`.substring(0, 31);

      // 添加用户信息行
      const sheetData = [
        ['用户信息', '', '', '', '', '', '', '', '', ''],
        ['昵称', userData.nickname, '', '', '', '', '', '', '', ''],
        ['粉丝', userData.fans, '关注', userData.follow, '获赞', userData.liked, '', '', '', ''],
        ['链接', userData.url, '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['笔记列表', '', '', '', '', '', '', '', '', ''],
        ['序号', 'ID', '标题', '类型', '点赞', '收藏', '评论', '内容长度', '链接'],
      ];

      // 添加笔记数据
      for (const note of userData.notes) {
        sheetData.push([
          note.rank,
          note.id,
          note.title,
          note.type,
          note.likes,
          note.collects,
          note.comments,
          note.contentLength,
          note.url,
        ]);
      }

      const newWs = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(outputWb, newWs, sheetName);

      // 添加到汇总
      summaryData.push({
        序号: i + 1,
        昵称: userData.nickname,
        粉丝: userData.fans,
        关注: userData.follow,
        获赞: userData.liked,
        笔记数: userData.notes.length,
        链接: userData.url,
      });
    }

    // 用户间间隔
    if (i < urls.length - 1) {
      console.log('⏳ 等待 5 秒...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // 创建汇总 sheet
  if (summaryData.length > 0) {
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(outputWb, summaryWs, '汇总');
  }

  // 保存输出
  XLSX.writeFile(outputWb, OUTPUT_FILE);
  console.log(`\n\n🎉 处理完成!`);
  console.log(`📤 输出文件: ${OUTPUT_FILE}`);
  console.log(`📊 共处理 ${summaryData.length} 个用户`);
}

main().catch(console.error);

#!/usr/bin/env bun

import { execSync } from "child_process";

const VIRLAL_THRESHOLD = 500;
const OUTPUT_FILE = "爆款作者记录.json";

interface Note {
  title: string;
  author: string;
  likes: number;
  type: string;
  url: string;
  author_url: string;
}

interface AuthorRecord {
  detected_at: string;
  note_title: string;
  note_likes: number;
  note_url: string;
  author_url: string;
  author_info?: {
    fans: string;
    following: string;
    likes: string;
  };
}

// Parse feed output to extract notes
function parseFeed(output: string): Note[] {
  const notes: Note[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    // Skip header, separator lines and empty lines
    if (line.includes("Title") || line.includes("─") || line.trim() === "" || !line.includes("│")) continue;

    // Split by │ and extract fields
    const parts = line.split("│").map(p => p.trim()).filter(p => p);
    if (parts.length < 6) continue;

    const title = parts[0] || "";
    const author = parts[1] || "";
    const likesStr = parts[2] || "0";
    const type = parts[3] || "";
    const url = parts[4] || "";
    const authorUrl = parts[5] || "";

    if (!url || url === "undefined" || !url.startsWith("http")) continue;

    const likes = parseLikes(likesStr);
    if (likes >= VIRLAL_THRESHOLD) {
      notes.push({ title, author, likes, type, url, author_url: authorUrl });
    }
  }
  return notes;
}

// Parse likes string like "9万", "3.5万", "6816" to number
function parseLikes(likesStr: string): number {
  if (likesStr.includes("万")) {
    const num = parseFloat(likesStr.replace("万", ""));
    if (isNaN(num)) return 0;
    return Math.round(num * 10000);
  }
  return parseInt(likesStr) || 0;
}

// Get author details using user-notes-detail
async function getAuthorInfo(authorUrl: string): Promise<{ fans: string; following: string; likes: string } | null> {
  try {
    const output = execSync(`opencli xiaohongshu user-notes-detail -f json "${authorUrl}"`, {
      timeout: 30000,
      encoding: "utf-8",
    });
    // Extract basic info from text output
    const fansMatch = output.match(/粉丝:\s*([\d.\w万]+)/);
    const followingMatch = output.match(/关注:\s*([\d.\w万]+)/);
    const totalLikesMatch = output.match(/获赞:\s*([\d.\w万]+)/);

    if (fansMatch) {
      return {
        fans: fansMatch[1],
        following: followingMatch?.[1] || "",
        likes: totalLikesMatch?.[1] || "",
      };
    }
  } catch {
    // Ignore errors, continue without author info
  }
  return null;
}

// Load existing records
function loadRecords(): AuthorRecord[] {
  try {
    return JSON.parse(Bun.file(OUTPUT_FILE).text());
  } catch {
    return [];
  }
}

// Save records
function saveRecords(records: AuthorRecord[]) {
  Bun.write(OUTPUT_FILE, JSON.stringify(records, null, 2));
}

async function main() {
  console.log("🔍 抓取小红书 feed...");
  const output = execSync("opencli xiaohongshu feed --limit 20", {
    timeout: 60000,
    encoding: "utf-8",
  });

  const viralNotes = parseFeed(output);

  if (viralNotes.length === 0) {
    console.log("✅ 未发现新的爆款笔记");
    return;
  }

  console.log(`\n🚨 发现 ${viralNotes.length} 篇爆款笔记!\n`);

  const existingRecords = loadRecords();
  const existingUrls = new Set(existingRecords.map((r) => r.note_url));

  let newCount = 0;

  for (const note of viralNotes) {
    if (existingUrls.has(note.url)) {
      console.log(`⏭️  已记录: ${note.title}`);
      continue;
    }

    console.log(`📝 新爆款: ${note.title} (${note.likes} likes)`);
    console.log(`   作者: ${note.author}`);
    console.log(`   获取作者信息...`);

    const authorInfo = await getAuthorInfo(note.author_url);

    const record: AuthorRecord = {
      detected_at: new Date().toISOString(),
      note_title: note.title,
      note_likes: note.likes,
      note_url: note.url,
      author_url: note.author_url,
      author_info: authorInfo || undefined,
    };

    existingRecords.push(record);
    newCount++;

    if (authorInfo) {
      console.log(`   ✅ 作者: 粉丝 ${authorInfo.fans} | 获赞 ${authorInfo.likes}`);
    } else {
      console.log(`   ⚠️  作者信息获取失败`);
    }
  }

  if (newCount > 0) {
    saveRecords(existingRecords);
    console.log(`\n💾 已保存 ${newCount} 条新记录到 ${OUTPUT_FILE}`);
  } else {
    console.log("\n✅ 没有新的爆款需要记录");
  }
}

main().catch(console.error);

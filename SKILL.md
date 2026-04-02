---
name: opencli
description: "OpenCLI (fork) — Make any website or Electron App your CLI. Zero risk, AI-powered, reuse Chrome login."
version: 1.4.2
author: misakaikato
tags: [cli, browser, web, chrome-extension, cdp, bilibili, zhihu, twitter, github, v2ex, hackernews, reddit, xiaohongshu, xueqiu, youtube, boss, coupang, yollomi, bqgl, scholar, cnki, wanfangdata, vip, AI, agent]
---

# OpenCLI

> 把任意网站、Electron 应用或本地工具变成你的 CLI。复用 Chrome 登录状态，零风险，AI 驱动发现。

> [!CAUTION]
> **AI Agent 必读：创建或修改任何适配器之前，你必须先阅读 [CLI-EXPLORER.md](./CLI-EXPLORER.md)！**
> 该文档包含完整的 API 发现工作流（必须使用浏览器探索）、5 级认证策略决策树、平台 SDK 速查表、`tap` 步骤调试流程、分页 API 模板、级联请求模式、以及常见陷阱。
> **本文件（SKILL.md）仅提供命令参考和简化模板，不足以正确开发适配器。**

> [!IMPORTANT]
> 创建或修改 adapter 时，再额外遵守 3 条收口规则：
> 1. 主参数优先用 positional arg，不要把 `query` / `id` / `url` 默认做成 `--query` / `--id` / `--url`
> 2. 预期中的 adapter 失败优先抛 `CliError` 子类，不要直接 throw 原始 `Error`
> 3. 新增 adapter 或新增用户可发现命令时，同步更新 adapter docs、`docs/adapters/index.md`、sidebar，以及 README/README.zh-CN 中受影响的入口

## 安装与运行

```bash
# 从源码构建（推荐）
git clone git@github.com:misakaikato/opencli.git
cd opencli && bun install
bun run build
npm link
opencli <command>
```

## 前置条件

浏览器命令需要：
1. Chrome 浏览器已启动**（并已登录目标网站）**
2. 已安装 **opencli Browser Bridge** Chrome 扩展（在 `chrome://extensions` 中加载 `extension/` 目录）
3. 无需额外配置 — 首次运行浏览器命令时守护进程会自动启动

> **注意**：运行命令前必须先在 Chrome 中登录目标网站。命令执行期间打开的标签页会在完成后自动关闭。

公开 API 命令（`hackernews`、`v2ex`）无需浏览器。

## 命令参考

### 数据命令

```bash
# Bilibili B站 (browser)
opencli bilibili hot --limit 10          # B站热门视频
opencli bilibili search "rust"            # 搜索视频 (query positional)
opencli bilibili me                       # 我的信息
opencli bilibili favorite                 # 我的收藏
opencli bilibili history --limit 20       # 观看历史
opencli bilibili feed --limit 10          # 动态时间线
opencli bilibili user-videos --uid 12345  # 用户投稿
opencli bilibili subtitle --bvid BV1xxx   # 获取视频字幕 (支持 --lang zh-CN)
opencli bilibili dynamic --limit 10       # 动态
opencli bilibili ranking --limit 10       # 排行榜
opencli bilibili following --limit 20     # 我的关注列表 (支持 --uid 查看他人)

# 知乎 (browser)
opencli zhihu hot --limit 10             # 知乎热榜
opencli zhihu search "AI"                # 搜索 (query positional)
opencli zhihu question 34816524            # 问题详情和回答 (id positional)

# 小红书 (browser)
opencli xiaohongshu search "美食"           # 搜索笔记 (query positional)
opencli xiaohongshu notifications             # 通知（mentions/likes/connections）
opencli xiaohongshu feed --limit 10           # 推荐 Feed
opencli xiaohongshu user xxx               # 用户主页 (id positional)
opencli xiaohongshu creator-notes --limit 10   # 创作者笔记列表
opencli xiaohongshu creator-note-detail --note-id xxx  # 笔记详情
opencli xiaohongshu creator-notes-summary      # 笔记数据概览
opencli xiaohongshu creator-profile            # 创作者资料
opencli xiaohongshu creator-stats              # 创作者数据统计
opencli xiaohongshu user-notes-detail --user-id xxx --cursor xxx  # 用户笔记详情
opencli xiaohongshu user-stats xxx             # 用户数据统计 (user-id positional)

# 雪球 Xueqiu (browser)
opencli xueqiu hot-stock --limit 10      # 雪球热门股票榜
opencli xueqiu stock --symbol SH600519   # 查看股票实时行情
opencli xueqiu watchlist                 # 获取自选股/持仓列表
opencli xueqiu feed                      # 我的关注 timeline
opencli xueqiu hot --limit 10            # 雪球热榜
opencli xueqiu search "特斯拉"            # 搜索 (query positional)
opencli xueqiu earnings-date SH600519    # 股票财报发布日期 (symbol positional)
opencli xueqiu fund-holdings             # 蛋卷基金持仓明细 (支持 --account 过滤)
opencli xueqiu fund-snapshot             # 蛋卷基金快照（总资产、子账户、持仓）

# GitHub（通过 gh 外部 CLI）
opencli gh repo list                     # 列出仓库（透传到 gh）
opencli gh pr list --limit 5             # PR 列表
opencli gh issue list                    # Issue 列表

# Twitter/X 推特 (browser)
opencli twitter trending --limit 10      # 热门趋势
opencli twitter search "AI"              # 搜索推文 (query positional)
opencli twitter profile elonmusk         # 用户资料
opencli twitter timeline --limit 20      # 时间线
opencli twitter thread 1234567890        # 推文 thread（原文 + 回复）
opencli twitter article 1891511252174299446 # 推文长文内容
opencli twitter follow elonmusk          # 关注用户
opencli twitter unfollow elonmusk        # 取消关注
opencli twitter bookmark https://x.com/... # 收藏推文
opencli twitter unbookmark https://x.com/... # 取消收藏
opencli twitter post "Hello world"       # 发布推文 (text positional)
opencli twitter like https://x.com/...   # 点赞推文 (url positional)
opencli twitter reply https://x.com/... "Nice!" # 回复推文 (url + text positional)
opencli twitter delete https://x.com/... # 删除推文 (url positional)
opencli twitter block elonmusk           # 屏蔽用户 (username positional)
opencli twitter unblock elonmusk         # 取消屏蔽 (username positional)
opencli twitter followers elonmusk       # 用户的粉丝列表 (user positional)
opencli twitter following elonmusk       # 用户的关注列表 (user positional)
opencli twitter notifications --limit 20 # 通知列表
opencli twitter hide-reply https://x.com/... # 隐藏回复 (url positional)
opencli twitter download elonmusk        # 下载用户媒体 (username positional, 支持 --tweet-url)
opencli twitter accept "群,微信"          # 自动接受含关键词的 DM 请求 (query positional)
opencli twitter reply-dm "消息内容"       # 批量回复 DM (text positional)

# Reddit (browser)
opencli reddit hot --limit 10            # 热门帖子
opencli reddit hot --subreddit programming  # 指定子版块
opencli reddit frontpage --limit 10      # 首页 /r/all
opencli reddit popular --limit 10        # /r/popular 热门
opencli reddit search "AI" --sort top --time week  # 搜索（支持排序+时间过滤）
opencli reddit subreddit rust --sort top --time month  # 子版块浏览（支持时间过滤）
opencli reddit read --post-id 1abc123    # 阅读帖子 + 评论
opencli reddit user spez                 # 用户资料（karma、注册时间）
opencli reddit user-posts spez           # 用户发帖历史
opencli reddit user-comments spez        # 用户评论历史
opencli reddit upvote --post-id xxx --direction up  # 投票（up/down/none）
opencli reddit save --post-id xxx        # 收藏帖子
opencli reddit comment --post-id xxx "Great!"  # 发表评论 (text positional)
opencli reddit subscribe --subreddit python  # 订阅子版块
opencli reddit saved --limit 10          # 我的收藏
opencli reddit upvoted --limit 10        # 我的赞

# V2EX (public + browser)
opencli v2ex hot --limit 10              # 热门话题
opencli v2ex latest --limit 10           # 最新话题
opencli v2ex topic 1024                  # 主题详情 (id positional)
opencli v2ex daily                       # 每日签到 (browser)
opencli v2ex me                          # 我的信息 (browser)
opencli v2ex notifications --limit 10    # 通知 (browser)
opencli v2ex node python                 # 节点话题列表 (name positional)
opencli v2ex nodes --limit 30            # 所有节点列表
opencli v2ex member username             # 用户资料 (username positional)
opencli v2ex user username               # 用户发帖列表 (username positional)
opencli v2ex replies 1024                # 主题回复列表 (id positional)

# Hacker News (public)
opencli hackernews top --limit 10        # 热门
opencli hackernews new --limit 10        # 最新
opencli hackernews best --limit 10       # 精华
opencli hackernews ask --limit 10        # Ask HN
opencli hackernews show --limit 10       # Show HN
opencli hackernews jobs --limit 10       # 招聘
opencli hackernews search "rust"         # 搜索 (query positional)
opencli hackernews user dang             # 用户资料 (username positional)

# BBC (public)
opencli bbc news --limit 10             # BBC 新闻头条

# 微博 (browser)
opencli weibo hot --limit 10            # 微博热搜

# BOSS直聘 (browser)
opencli boss search "AI agent"          # 搜索职位 (query positional)
opencli boss detail --security-id xxx    # 职位详情
opencli boss recommend --limit 10        # 推荐职位
opencli boss joblist --limit 10          # 职位列表
opencli boss greet --security-id xxx     # 打招呼
opencli boss batchgreet --job-id xxx     # 批量打招呼
opencli boss send --uid xxx "消息内容"    # 发消息 (text positional)
opencli boss chatlist --limit 10         # 聊天列表
opencli boss chatmsg --security-id xxx   # 聊天记录
opencli boss invite --security-id xxx    # 邀请沟通
opencli boss mark --security-id xxx      # 标记管理
opencli boss exchange --security-id xxx  # 交换联系方式
opencli boss resume                    # 简历管理
opencli boss stats                     # 数据统计

# YouTube (browser)
opencli youtube search "rust"            # 搜索视频 (query positional)
opencli youtube video "https://www.youtube.com/watch?v=xxx"  # 视频元数据
opencli youtube transcript "https://www.youtube.com/watch?v=xxx"  # 获取视频字幕/转录
opencli youtube transcript "xxx" --lang zh-Hans --mode raw  # 指定语言 + 原始时间戳模式

# Yahoo Finance (browser)
opencli yahoo-finance quote --symbol AAPL  # 股票行情

# Sina Finance
opencli sinafinance news --limit 10 --type 1  # 7x24实时快讯 (0=全部 1=A股 2=宏观 3=公司 4=数据 5=市场 6=国际 7=观点 8=央行 9=其它)

# Reuters (browser)
opencli reuters search "AI"              # 路透社搜索 (query positional)

# 什么值得买 (browser)
opencli smzdm search "耳机"              # 搜索好价 (query positional)

# 携程 (browser)
opencli ctrip search "三亚"              # 搜索目的地 (query positional)

# Antigravity 反重力 (Electron/CDP)
opencli antigravity status              # 检查 CDP 连接
opencli antigravity send "hello"        # 发送文本到当前 agent 聊天框
opencli antigravity read                # 读取整个聊天记录面板
opencli antigravity new                 # 清空聊天、开启新对话
opencli antigravity dump               # 导出 DOM 和快照调试信息
opencli antigravity extract-code        # 自动抽取 AI 回复中的代码块
opencli antigravity model claude        # 切换底层模型
opencli antigravity watch               # 流式监听增量消息

# Barchart 期权数据 (browser)
opencli barchart quote --symbol AAPL     # 股票行情
opencli barchart options --symbol AAPL   # 期权链
opencli barchart greeks --symbol AAPL    # 期权希腊值
opencli barchart flow --limit 20         # 异常期权异动

# Jike 即刻 (browser)
opencli jike feed --limit 10             # 动态流
opencli jike search "AI"                 # 搜索 (query positional)
opencli jike create "内容"                # 发布动态 (text positional)
opencli jike like xxx                    # 点赞 (id positional)
opencli jike comment xxx "评论"           # 评论 (id + text positional)
opencli jike repost xxx                  # 转发 (id positional)
opencli jike notifications               # 通知

# Linux.do (public + browser)
opencli linux-do hot --limit 10          # 热门话题
opencli linux-do latest --limit 10       # 最新话题
opencli linux-do search "rust"           # 搜索 (query positional)
opencli linux-do topic 1024              # 主题详情 (id positional)
opencli linux-do categories --limit 20   # 分类列表 (browser)
opencli linux-do category dev 7          # 分类内话题 (slug + id positional, browser)

# StackOverflow (public)
opencli stackoverflow hot --limit 10     # 热门问题
opencli stackoverflow search "typescript"  # 搜索 (query positional)
opencli stackoverflow bounties --limit 10  # 悬赏问题

# WeRead 微信读书 (browser)
opencli weread shelf --limit 10          # 书架
opencli weread search "AI"               # 搜索图书 (query positional)
opencli weread book xxx                  # 图书详情 (book-id positional)
opencli weread highlights xxx            # 划线笔记 (book-id positional)
opencli weread notes xxx                 # 想法笔记 (book-id positional)
opencli weread ranking --limit 10        # 排行榜

# Jimeng 即梦 AI (browser)
opencli jimeng generate --prompt "描述"  # AI 生图
opencli jimeng history --limit 10        # 生成历史

# Yollomi 图像/视频 AI (browser — 需在 Chrome 登录 yollomi.com，复用站点 session)
opencli yollomi models --type image      # 列出图像模型与积分
opencli yollomi generate "提示词" --model z-image-turbo   # 文生图
opencli yollomi video "提示词" --model kling-2-1        # 视频
opencli yollomi upload ./photo.jpg       # 上传得 URL，供 img2img / 工具链使用
opencli yollomi remove-bg <image-url>    # 去背景（免费）
opencli yollomi edit <image-url> "改成油画风格"        # Qwen 图像编辑
opencli yollomi background <image-url>   # AI 背景生成 (5 credits)
opencli yollomi face-swap --source <url> --target <url>  # 换脸 (3 credits)
opencli yollomi object-remover <image-url> <mask-url>    # AI 去除物体 (3 credits)
opencli yollomi restore <image-url>      # AI 修复老照片 (4 credits)
opencli yollomi try-on --person <url> --cloth <url>      # 虚拟试衣 (3 credits)
opencli yollomi upscale <image-url>      # AI 超分辨率 (1 credit, 支持 --scale 2/4)

# Grok (默认 + 显式 web)
opencli grok ask --prompt "问题"         # 提问 Grok（兼容默认路径）
opencli grok ask --prompt "问题" --web   # 显式 grok.com consumer web UI 路径

# HuggingFace (public)
opencli hf top --limit 10                # 热门模型

# 超星学习通 (browser)
opencli chaoxing assignments             # 作业列表
opencli chaoxing exams                   # 考试列表

# Douban 豆瓣 (browser)
opencli douban search "三体"              # 搜索 (query positional)
opencli douban top250                     # 豆瓣 Top 250
opencli douban subject 1234567            # 条目详情 (id positional)
opencli douban marks --limit 10           # 我的标记
opencli douban reviews --limit 10         # 短评

# Facebook (browser)
opencli facebook feed --limit 10          # 动态流
opencli facebook profile username         # 用户资料 (id positional)
opencli facebook search "AI"              # 搜索 (query positional)
opencli facebook friends                  # 好友列表
opencli facebook groups                   # 群组
opencli facebook events                   # 活动
opencli facebook notifications            # 通知
opencli facebook memories                 # 回忆
opencli facebook add-friend username      # 添加好友 (id positional)
opencli facebook join-group groupid       # 加入群组 (id positional)

# Instagram (browser)
opencli instagram explore                 # 探索
opencli instagram profile username        # 用户资料 (id positional)
opencli instagram search "AI"             # 搜索 (query positional)
opencli instagram user username           # 用户详情 (id positional)
opencli instagram followers username      # 粉丝 (id positional)
opencli instagram following username      # 关注 (id positional)
opencli instagram follow username         # 关注用户 (id positional)
opencli instagram unfollow username       # 取消关注 (id positional)
opencli instagram like postid             # 点赞 (id positional)
opencli instagram unlike postid           # 取消点赞 (id positional)
opencli instagram comment postid "评论"   # 评论 (id + text positional)
opencli instagram save postid             # 收藏 (id positional)
opencli instagram unsave postid           # 取消收藏 (id positional)
opencli instagram saved                   # 已收藏列表

# TikTok (browser)
opencli tiktok explore                    # 探索
opencli tiktok search "AI"                # 搜索 (query positional)
opencli tiktok profile username           # 用户资料 (id positional)
opencli tiktok user username              # 用户详情 (id positional)
opencli tiktok following username         # 关注列表 (id positional)
opencli tiktok follow username            # 关注 (id positional)
opencli tiktok unfollow username          # 取消关注 (id positional)
opencli tiktok like videoid               # 点赞 (id positional)
opencli tiktok unlike videoid             # 取消点赞 (id positional)
opencli tiktok comment videoid "评论"     # 评论 (id + text positional)
opencli tiktok save videoid               # 收藏 (id positional)
opencli tiktok unsave videoid             # 取消收藏 (id positional)
opencli tiktok live                       # 直播
opencli tiktok notifications              # 通知
opencli tiktok friends                    # 朋友

# Medium (browser)
opencli medium feed --limit 10            # 动态流
opencli medium search "AI"                # 搜索 (query positional)
opencli medium user username              # 用户主页 (id positional)

# Substack (browser)
opencli substack feed --limit 10          # 订阅动态
opencli substack search "AI"              # 搜索 (query positional)
opencli substack publication name         # 出版物详情 (id positional)

# Sinablog 新浪博客 (browser)
opencli sinablog hot --limit 10           # 热门
opencli sinablog search "AI"              # 搜索 (query positional)
opencli sinablog article url              # 文章详情
opencli sinablog user username            # 用户主页 (id positional)

# Lobsters (public)
opencli lobsters hot --limit 10           # 热门
opencli lobsters newest --limit 10        # 最新
opencli lobsters active --limit 10        # 活跃
opencli lobsters tag rust                 # 按标签筛选 (tag positional)

# Google (public)
opencli google news --limit 10            # 新闻
opencli google search "AI"                # 搜索 (query positional)
opencli google suggest "AI"               # 搜索建议 (query positional)
opencli google trends                     # 趋势

# DEV.to (public)
opencli devto top --limit 10              # 热门文章
opencli devto tag javascript --limit 10   # 按标签 (tag positional)
opencli devto user username               # 用户文章 (username positional)

# Steam (public)
opencli steam top-sellers --limit 10      # 热销游戏

# Apple Podcasts (public)
opencli apple-podcasts top --limit 10     # 热门播客排行榜 (支持 --country us/cn/gb/jp)
opencli apple-podcasts search "科技"       # 搜索播客 (query positional)
opencli apple-podcasts episodes 12345     # 播客剧集列表 (id positional, 用 search 获取 ID)

# arXiv (public)
opencli arxiv search "attention"          # 搜索论文 (query positional)
opencli arxiv paper 1706.03762            # 论文详情 (id positional)

# CNKI 知网 (browser - 需要 Chrome 登录)
opencli cnki search "人工智能"           # 搜索论文 (query positional)

# 万方数据 (browser - 需要 Chrome 登录)
opencli wanfangdata search "人工智能"    # 搜索论文 (query positional)

# 维普 (browser - 需要 Chrome 登录)
opencli vip search "人工智能"           # 搜索论文 (query positional)

# 笔趣阁 bqgl (public)
opencli bqgl search "斗破苍穹"           # 搜索小说 (query positional)
opencli bqgl book 1152                   # 小说详情+章节列表 (book-id positional)
opencli bqgl read 1152 1                 # 阅读章节 (book-id + chapter positional, -1=最新章)
opencli bqgl download 1152               # 下载小说 (book-id positional, 支持 --start/--end/--concurrency/--continue/--update)
opencli bqgl ranking xuanhuan            # 排行榜 (category positional, 可选: xuanhuan|wuxia|dushi|lishi|wangyou|kehuan|mm|finish|all)
opencli bqgl category xuanhuan           # 分类浏览 (category positional, 支持 --page)
opencli bqgl home                        # 首页推荐

# Google Scholar 学术搜索 (browser)
opencli scholar search "attention is all you need"  # 搜索学术论文 (query positional)

# Bloomberg 彭博 (public RSS + browser)
opencli bloomberg main --limit 10         # 彭博首页头条 (RSS)
opencli bloomberg markets --limit 10      # 市场新闻 (RSS)
opencli bloomberg tech --limit 10         # 科技新闻 (RSS)
opencli bloomberg politics --limit 10     # 政治新闻 (RSS)
opencli bloomberg economics --limit 10    # 经济新闻 (RSS)
opencli bloomberg opinions --limit 10     # 观点评论 (RSS)
opencli bloomberg industries --limit 10   # 行业新闻 (RSS)
opencli bloomberg businessweek --limit 10 # 商业周刊 (RSS)
opencli bloomberg feeds                   # 列出所有 RSS feed 别名
opencli bloomberg news "https://..."      # 阅读文章全文 (link positional, browser)

# Coupang 酷澎 (browser)
opencli coupang search "耳机"             # 搜索商品 (query positional, 支持 --filter rocket)
opencli coupang add-to-cart 12345         # 加入购物车 (product-id positional, 或 --url)

# Dictionary (public)
opencli dictionary search "serendipity"   # 单词释义 (word positional)
opencli dictionary synonyms "happy"       # 近义词 (word positional)
opencli dictionary examples "ubiquitous"  # 例句 (word positional)

# 豆包 Doubao Web (browser)
opencli doubao status                     # 检查豆包页面状态
opencli doubao new                        # 新建对话
opencli doubao send "你好"                # 发送消息 (text positional)
opencli doubao read                       # 读取对话记录
opencli doubao ask "问题"                 # 一键提问并等回复 (text positional)

# 京东 JD (browser)
opencli jd item 100291143898             # 商品详情 (sku positional, 含价格/主图/规格)

# LinkedIn (browser)
opencli linkedin search "AI engineer"    # 搜索职位 (query positional, 支持 --location/--company/--remote)
opencli linkedin timeline --limit 20     # 首页动态流

# Pixiv (browser)
opencli pixiv ranking --limit 20         # 插画排行榜 (支持 --mode daily/weekly/monthly)
opencli pixiv search "風景"               # 搜索插画 (query positional)
opencli pixiv user 12345                 # 画师资料 (uid positional)
opencli pixiv illusts 12345              # 画师作品列表 (user-id positional)
opencli pixiv detail 12345               # 插画详情 (id positional)
opencli pixiv download 12345             # 下载插画 (illust-id positional)

# Web (browser)
opencli web read --url "https://..."     # 抓取任意网页并导出为 Markdown

# 微信公众号 Weixin (browser)
opencli weixin download --url "https://mp.weixin.qq.com/s/xxx"  # 下载公众号文章为 Markdown

# 小宇宙 Xiaoyuzhou (public)
opencli xiaoyuzhou podcast 12345          # 播客资料 (id positional)
opencli xiaoyuzhou podcast-episodes 12345 # 播客剧集列表 (id positional)
opencli xiaoyuzhou episode 12345          # 单集详情 (id positional)

# Wikipedia (public)
opencli wikipedia search "AI"             # 搜索 (query positional)
opencli wikipedia summary "Python"        # 摘要 (title positional)
```

### 桌面应用命令

```bash
# Cursor (桌面 — Electron CDP)
opencli cursor status                    # 检查连接
opencli cursor send "message"            # 发送消息
opencli cursor read                      # 读取回复
opencli cursor new                       # 新建对话
opencli cursor dump                      # 导出 DOM 调试信息
opencli cursor composer                  # Composer 模式
opencli cursor model claude              # 切换模型
opencli cursor extract-code              # 提取代码块
opencli cursor ask "question"            # 一键提问并等回复
opencli cursor screenshot                # 截图
opencli cursor history                   # 对话历史
opencli cursor export                    # 导出对话

# Codex (桌面 — 无头 CLI agent)
opencli codex status                     # 检查连接
opencli codex send "message"             # 发送消息
opencli codex read                       # 读取回复
opencli codex new                        # 新建对话
opencli codex dump                       # 导出调试信息
opencli codex extract-diff               # 提取 diff
opencli codex model gpt-4                # 切换模型
opencli codex ask "question"             # 一键提问并等回复
opencli codex screenshot                 # 截图
opencli codex history                    # 对话历史
opencli codex export                     # 导出对话

# ChatGPT (桌面 — macOS AppleScript/CDP)
opencli chatgpt status                   # 检查应用状态
opencli chatgpt new                      # 新建对话
opencli chatgpt send "message"           # 发送消息
opencli chatgpt read                     # 读取回复
opencli chatgpt ask "question"           # 一键提问并等回复

# ChatWise (桌面 — 多 LLM 客户端)
opencli chatwise status                  # 检查连接
opencli chatwise new                     # 新建对话
opencli chatwise send "message"          # 发送消息
opencli chatwise read                    # 读取回复
opencli chatwise ask "question"          # 一键提问并等回复
opencli chatwise model claude            # 切换模型
opencli chatwise history                 # 对话历史
opencli chatwise export                  # 导出对话
opencli chatwise screenshot              # 截图

# Notion (桌面 — Electron CDP)
opencli notion status                    # 检查连接
opencli notion search "keyword"          # 搜索页面
opencli notion read                      # 读取当前页面
opencli notion new                       # 新建页面
opencli notion write "content"           # 写入内容
opencli notion sidebar                   # 侧边栏导航
opencli notion favorites                 # 收藏列表
opencli notion export                    # 导出

# Discord App (桌面 — Electron CDP)
opencli discord-app status               # 检查连接
opencli discord-app send "message"       # 发送消息
opencli discord-app read                 # 读取消息
opencli discord-app channels             # 频道列表
opencli discord-app servers              # 服务器列表
opencli discord-app search "keyword"     # 搜索
opencli discord-app members              # 成员列表

# Doubao App 豆包桌面版 (桌面 — Electron CDP)
opencli doubao-app status                # 检查连接
opencli doubao-app new                   # 新建对话
opencli doubao-app send "message"        # 发送消息
opencli doubao-app read                  # 读取回复
opencli doubao-app ask "question"        # 一键提问并等回复
opencli doubao-app screenshot            # 截图
opencli doubao-app dump                  # 导出 DOM 调试信息
```

### 管理命令

```bash
opencli list                # 列出所有命令（包含外部 CLI）
opencli list --json         # JSON 输出
opencli list -f yaml        # YAML 输出
opencli install <name>      # 自动安装外部 CLI（如 gh、obsidian）
opencli register <name>     # 注册本地自定义 CLI，供统一发现
opencli validate            # 校验所有 CLI 定义
opencli validate bilibili   # 校验指定站点
opencli doctor              # 诊断浏览器桥接（自动启动守护进程，包含连接测试）
```

### AI Agent 工作流

```bash
# 深度探索：网络拦截 → 响应分析 → 能力推断
opencli explore <url> --site <name>

# 合成：根据探索产物生成基于 evaluate 的 YAML 管道
opencli synthesize <site>

# 一键生成：探索 → 合成 → 注册
opencli generate <url> --goal "hot"

# 录制：你操作页面，opencli 捕获所有 API 调用 → YAML 候选
# 在自动化窗口中打开 URL，向所有标签页注入 fetch/XHR 拦截器，
# 每 2s 轮询一次，60s 后自动停止（或按 Enter 提前停止）。
opencli record <url>                            # 录制，site name 从域名推断
opencli record <url> --site mysite             # 指定 site name
opencli record <url> --timeout 120000          # 自定义超时（毫秒，默认 60000）
opencli record <url> --poll 1000               # 缩短轮询间隔（毫秒，默认 2000）
opencli record <url> --out .opencli/record/x   # 自定义输出目录
# 输出：
#   .opencli/record/<site>/captured.json        ← 原始捕获数据（带 url/method/body）
#   .opencli/record/<site>/candidates/*.yaml    ← 高置信度候选适配器（score ≥ 8，有 array 结果）

# 策略级联：自动探测 PUBLIC → COOKIE → HEADER
opencli cascade <api-url>

# 带交互式 fuzzing 的探索（点击按钮触发懒加载 API）
opencli explore <url> --auto --click "字幕,CC,评论"

# 校验适配器定义
opencli validate
```

## 输出格式

所有内置命令支持 `--format` / `-f` 参数，可选 `table`、`json`、`yaml`、`md` 和 `csv`。
`list` 命令同样支持这些格式，并保留 `--json` 作为向后兼容别名。

```bash
opencli list -f yaml            # YAML 命令注册表
opencli bilibili hot -f table   # 默认：富文本表格
opencli bilibili hot -f json    # JSON（可管道到 jq，或喂给 AI agent）
opencli bilibili hot -f yaml    # YAML（可读的结构化输出）
opencli bilibili hot -f md      # Markdown
opencli bilibili hot -f csv     # CSV
```

## 详细模式

```bash
opencli bilibili hot -v         # 显示每个管道步骤和数据流
```

## Record Workflow

`record` 是为「无法用 `explore` 自动发现」的页面（需要登录操作、复杂交互、SPA 内路由）准备的手动录制方案。

### 工作原理

```
opencli record <url>
  → 打开 automation window 并导航到目标 URL
  → 向所有 tab 注入 fetch/XHR 拦截器（幂等，可重复注入）
  → 每 2s 轮询一次：发现新 tab 自动注入，drain 所有 tab 的捕获缓冲区
  → 超时（默认 60s）或按 Enter 停止
  → 分析捕获到的 JSON 请求：去重 → 评分 → 生成候选 YAML
```

**拦截器特性**：
- 同时 patch `window.fetch` 和 `XMLHttpRequest`
- 只捕获 `Content-Type: application/json` 的响应
- 过滤纯对象少于 2 个 key 的响应（避免 tracking/ping）
- 跨 tab 隔离：每个 tab 独立缓冲区，轮询时分别 drain
- 幂等注入：同一 tab 二次注入时先 restore 原始函数再重新 patch，不丢失已捕获数据

### 使用步骤

```bash
# 1. 启动录制（建议 --timeout 给足操作时间）
opencli record "https://example.com/page" --timeout 120000

# 2. 在弹出的 automation window 里正常操作页面：
#    - 打开列表、搜索、点击条目、切换 Tab
#    - 凡是触发网络请求的操作都会被捕获

# 3. 完成操作后按 Enter 停止（或等超时自动停止）

# 4. 查看结果
cat .opencli/record/<site>/captured.json        # 原始捕获
ls  .opencli/record/<site>/candidates/          # 候选 YAML
```

### 页面类型与捕获预期

| 页面类型 | 预期捕获量 | 说明 |
|---------|-----------|------|
| 列表/搜索页 | 多（5~20+） | 每次搜索/翻页都会触发新请求 |
| 详情页（只读） | 少（1~5） | 首屏数据一次性返回，后续操作走 form/redirect |
| SPA 内路由跳转 | 中等 | 路由切换会触发新接口，但首屏请求在注入前已发出 |
| 需要登录的页面 | 视操作而定 | 确保 Chrome 已登录目标网站 |

> **注意**：如果页面在导航完成前就发出了大部分请求（服务端渲染 / SSR 注水），拦截器会错过这些请求。
> 解决方案：在页面加载完成后，手动触发能产生新请求的操作（搜索、翻页、切 Tab、展开折叠项等）。

### 候选 YAML → TS CLI 转换

生成的候选 YAML 是起点，通常需要转换为 TypeScript（尤其是 tae 等内部系统）：

**候选 YAML 结构**（自动生成）：
```yaml
site: tae
name: getList          # 从 URL path 推断的名称
strategy: cookie
browser: true
pipeline:
  - navigate: https://...
  - evaluate: |
      (async () => {
        const res = await fetch('/approval/getList.json?procInsId=...', { credentials: 'include' });
        const data = await res.json();
        return (data?.content?.operatorRecords || []).map(item => ({ ... }));
      })()
```

**转换为 TS CLI**（参考 `src/clis/tae/add-expense.ts` 风格）：
```typescript
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'tae',
  name: 'get-approval',
  description: '查看报销单审批流程和操作记录',
  domain: 'tae.alibaba-inc.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'proc_ins_id', type: 'string', required: true, positional: true, help: '流程实例 ID（procInsId）' },
  ],
  columns: ['step', 'operator', 'action', 'time'],
  func: async (page, kwargs) => {
    await page.goto('https://tae.alibaba-inc.com/expense/pc.html?_authType=SAML');
    await page.wait(2);
    const result = await page.evaluate(`(async () => {
      const res = await fetch('/approval/getList.json?taskId=&procInsId=${kwargs.proc_ins_id}', {
        credentials: 'include'
      });
      const data = await res.json();
      return data?.content?.operatorRecords || [];
    })()`);
    return (result as any[]).map((r, i) => ({
      step: i + 1,
      operator: r.operatorName || r.userId,
      action: r.operationType,
      time: r.operateTime,
    }));
  },
});
```

**转换要点**：
1. URL 中的动态 ID（`procInsId`、`taskId` 等）提取为 `args`
2. `captured.json` 里的真实 body 结构用于确定正确的数据路径（如 `content.operatorRecords`）
3. tae 系统统一用 `{ success, content, errorCode, errorMsg }` 外层包裹，取数据要走 `content.*`
4. 认证方式：cookie（`credentials: 'include'`），不需要额外 header
5. 文件放入 `src/clis/<site>/`，无需手动注册，`bun run build` 后自动发现

### 故障排查

| 现象 | 原因 | 解法 |
|------|------|------|
| 捕获 0 条请求 | 拦截器注入失败，或页面无 JSON API | 检查 daemon 是否运行：`curl localhost:19825/status` |
| 捕获量少（1~3 条） | 页面是只读详情页，首屏数据已在注入前发出 | 手动操作触发更多请求（搜索/翻页），或换用列表页 |
| 候选 YAML 为 0 | 捕获到的 JSON 都没有 array 结构 | 直接看 `captured.json` 手写 TS CLI |
| 新开的 tab 没有被拦截 | 轮询间隔内 tab 已关闭 | 缩短 `--poll 500` |
| 二次运行 record 时数据不连续 | 正常，每次 `record` 启动都是新的 automation window | 无需处理 |

## 创建适配器

> [!TIP]
> **快速模式**：如果你只想为一个具体页面生成一个命令，直接看 [CLI-ONESHOT.md](./CLI-ONESHOT.md)。
> 只需要一个 URL + 一句话描述，4 步搞定。

> [!IMPORTANT]
> **完整模式 — 在写任何代码之前，先阅读 [CLI-EXPLORER.md](./CLI-EXPLORER.md)。**
> 它包含：① AI Agent 浏览器探索工作流 ② 认证策略决策树 ③ 平台 SDK（如 Bilibili 的 `apiGet`/`fetchJson`）④ YAML vs TS 选择指南 ⑤ `tap` 步骤调试方法 ⑥ 级联请求模板 ⑦ 常见陷阱表。
> **下方仅为简化模板参考，直接使用极易踩坑。**

### YAML 管道（声明式，推荐）

创建 `src/clis/<site>/<name>.yaml`：

```yaml
site: mysite
name: hot
description: 热门话题
domain: www.mysite.com
strategy: cookie        # public | cookie | header | intercept | ui
browser: true

args:
  limit:
    type: int
    default: 20
    description: 返回数量

pipeline:
  - navigate: https://www.mysite.com

  - evaluate: |
      (async () => {
        const res = await fetch('/api/hot', { credentials: 'include' });
        const d = await res.json();
        return d.data.items.map(item => ({
          title: item.title,
          score: item.score,
        }));
      })()

  - map:
      rank: ${{ index + 1 }}
      title: ${{ item.title }}
      score: ${{ item.score }}

  - limit: ${{ args.limit }}

columns: [rank, title, score]
```

公开 API（无需浏览器）：

```yaml
strategy: public
browser: false

pipeline:
  - fetch:
      url: https://api.example.com/hot.json
  - select: data.items
  - map:
      title: ${{ item.title }}
  - limit: ${{ args.limit }}
```

### TypeScript 适配器（编程式）

创建 `src/clis/<site>/<name>.ts`。文件会被自动动态加载（不要在 `index.ts` 中手动导入）：

```typescript
import { cli, Strategy } from '../../registry.js';

cli({
  site: 'mysite',
  name: 'search',
  strategy: Strategy.INTERCEPT, // Or COOKIE
  args: [{ name: 'query', required: true, positional: true }],
  columns: ['rank', 'title', 'url'],
  func: async (page, kwargs) => {
    await page.goto('https://www.mysite.com/search');
    
    // 注入原生 XHR/Fetch 拦截器钩子
    await page.installInterceptor('/api/search');

    // 自动向下滚动以触发懒加载
    await page.autoScroll({ times: 3, delayMs: 2000 });

    // 获取拦截到的 JSON 数据
    const requests = await page.getInterceptedRequests();
    
    let results = [];
    for (const req of requests) {
      results.push(...req.data.items);
    }
    return results.map((item, i) => ({
      rank: i + 1, title: item.title, url: item.url,
    }));
  },
});
```

**何时使用 TS**：XHR 拦截（`page.installInterceptor`）、无限滚动（`page.autoScroll`）、cookie 提取、复杂数据转换（如 GraphQL 解包）。

## 管道步骤

| 步骤 | 说明 | 示例 |
|------|------|------|
| `navigate` | 导航到 URL | `navigate: https://example.com` |
| `fetch` | HTTP 请求（浏览器 cookie） | `fetch: { url: "...", params: { q: "..." } }` |
| `evaluate` | 在页面中执行 JS | `evaluate: \| (async () => { ... })()` |
| `select` | 提取 JSON 路径 | `select: data.items` |
| `map` | 映射字段 | `map: { title: "${{ item.title }}" }` |
| `filter` | 过滤条目 | `filter: item.score > 100` |
| `sort` | 排序 | `sort: { by: score, order: desc }` |
| `limit` | 限制结果数量 | `limit: ${{ args.limit }}` |
| `intercept` | 声明式 XHR 捕获 | `intercept: { trigger: "navigate:...", capture: "api/hot" }` |
| `tap` | 存储操作 + XHR 捕获 | `tap: { store: "feed", action: "fetchFeeds", capture: "homefeed" }` |
| `snapshot` | 页面无障碍树 | `snapshot: { interactive: true }` |
| `click` | 点击元素 | `click: ${{ ref }}` |
| `type` | 输入文本 | `type: { ref: "@1", text: "hello" }` |
| `wait` | 等待时间/文本 | `wait: 2` 或 `wait: { text: "loaded" }` |
| `press` | 按键 | `press: Enter` |

## 模板语法

```yaml
# 带默认值的参数
${{ args.query }}
${{ args.limit | default(20) }}

# 当前条目（在 map/filter 中）
${{ item.title }}
${{ item.data.nested.field }}

# 索引（从 0 开始）
${{ index }}
${{ index + 1 }}
```

## 5 级认证策略

| 级别 | 名称 | 方式 | 示例 |
|------|------|------|------|
| 1 | `public` | 无认证，Node.js fetch | Hacker News, V2EX |
| 2 | `cookie` | 浏览器 fetch + `credentials: include` | Bilibili, 知乎 |
| 3 | `header` | 自定义请求头（ct0、Bearer） | Twitter GraphQL |
| 4 | `intercept` | XHR 拦截 + store 修改 | 小红书 Pinia |
| 5 | `ui` | 完整 UI 自动化（点击/输入/滚动） | 最后手段 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLI_DAEMON_PORT` | 19825 | 守护进程监听端口 |
| `OPENCLI_BROWSER_CONNECT_TIMEOUT` | 30 | 浏览器连接超时（秒） |
| `OPENCLI_BROWSER_COMMAND_TIMEOUT` | 45 | 命令执行超时（秒） |
| `OPENCLI_BROWSER_EXPLORE_TIMEOUT` | 120 | 探索超时（秒） |
| `OPENCLI_VERBOSE` | — | 显示守护进程/扩展日志 |

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| `npx not found` | 安装 Node.js：`brew install node` |
| `Extension not connected` | 1) 确保 Chrome 已打开 2) 安装 opencli Browser Bridge 扩展 |
| `Target page context` 错误 | 在 YAML 的 `evaluate:` 前添加 `navigate:` 步骤 |
| 表格数据为空 | 检查 evaluate 是否返回了正确的数据路径 |
| 守护进程问题 | `curl localhost:19825/status` 检查状态，`curl localhost:19825/logs` 查看扩展日志 |

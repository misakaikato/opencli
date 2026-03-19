# 学习通（Chaoxing）适配器

通过复用 Chrome 登录态，在终端查看学习通的作业和考试列表。

## 前置条件

1. Chrome 必须正在运行，且已经登录学习通（`i.chaoxing.com`）。
2. 需安装 opencli Browser Bridge 扩展。

## 命令

| 命令 | 说明 |
|------|------|
| `opencli chaoxing assignments` | 列出所有课程的作业 |
| `opencli chaoxing assignments --course "数学"` | 按课程名模糊过滤 |
| `opencli chaoxing assignments --status pending` | 按状态过滤：`all` / `pending` / `submitted` / `graded` |
| `opencli chaoxing exams` | 列出所有课程的考试 |
| `opencli chaoxing exams --course "数学"` | 按课程名模糊过滤 |
| `opencli chaoxing exams --status upcoming` | 按状态过滤：`all` / `upcoming` / `ongoing` / `finished` |

## 工作原理

学习通没有扁平的"作业列表"API，适配器模拟学生在浏览器中的操作流程：

1. 通过交互页建立会话
2. 通过 `backclazzdata` JSON API 获取课程列表
3. 通过 `stucoursemiddle` 重定向进入课程（获取会话 `enc`）
4. 点击作业/考试标签，捕获 iframe URL
5. 导航到该 URL 并解析 DOM

## 限制

- 实际使用建议配合 `--course` 过滤（扫描全部 40+ 门课程较慢）
- 不提交作业、不参加考试
- 如学习通页面结构变动，DOM 解析器需同步更新

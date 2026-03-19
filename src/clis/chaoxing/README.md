# Chaoxing (学习通) Adapter

View your Chaoxing assignments and exams from the terminal by reusing your Chrome login session.

## Prerequisites

1. Chrome must be running and already logged into Chaoxing (`i.chaoxing.com`).
2. The opencli Browser Bridge extension must be installed.

## Commands

| Command | Description |
|---------|-------------|
| `opencli chaoxing assignments` | List assignments across all courses |
| `opencli chaoxing assignments --course "数学"` | Filter by course name (fuzzy match) |
| `opencli chaoxing assignments --status pending` | Filter: `all` / `pending` / `submitted` / `graded` |
| `opencli chaoxing exams` | List exams across all courses |
| `opencli chaoxing exams --course "数学"` | Filter by course name |
| `opencli chaoxing exams --status upcoming` | Filter: `all` / `upcoming` / `ongoing` / `finished` |

## How It Works

Chaoxing has no flat API for listing assignments/exams. The adapter follows the same
flow a student would in the browser:

1. Establish session via the interaction page
2. Fetch enrolled course list (`backclazzdata` JSON API)
3. Enter each course via `stucoursemiddle` redirect (obtains session `enc`)
4. Click the 作业/考试 tab and capture the iframe URL
5. Navigate to that URL and parse the DOM

## Limitations

- Requires `--course` filter for practical use (scanning all 40+ courses is slow)
- Does not submit homework or exams
- If Chaoxing changes page structure, the DOM parser may need updates

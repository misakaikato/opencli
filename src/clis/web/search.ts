/**
 * Web Search - aggregate search results from all available search commands.
 *
 * Uses a concurrency-controlled queue to avoid overwhelming search targets.
 *
 * Usage:
 *   opencli web search "AI"                      # Search across all platforms
 *   opencli web search "AI" --limit 50          # Limit total results
 *   opencli web search "AI" --concurrency 5     # Run 5 searches in parallel (default: 3)
 *   opencli web search "AI" -f json             # JSON output
 */

import { cli, getRegistry, fullName } from '../../registry.js';
import { executeCommand } from '../../execution.js';
import { CliError } from '../../errors.js';

interface SearchResult {
  source: string;
  title: string;
  url: string;
  [key: string]: unknown;
}

// Sites blocked from web search results
const BLOCKED_SOURCES = ['smzdm', 'ctrip', 'pixiv', 'boss', 'discord-app', 'instagram', 'linkedin', 'notion'];

/**
 * Concurrency-controlled search runner with progress callbacks.
 * Consumes tasks from a queue with at most `concurrency` running at a time.
 */
async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  onStart?: (site: string) => void,
  onDone?: (site: string, count: number, hadError: boolean) => void,
  onError?: (site: string) => void,
): Promise<void> {
  let currentIndex = 0;
  const running: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (true) {
      const index = currentIndex++;
      if (index >= tasks.length) break;
      const site = (tasks[index] as any)._site as string | undefined;
      if (site && onStart) onStart(site);
      let hadError = false;
      try {
        await tasks[index]();
      } catch {
        hadError = true;
        if (site && onError) onError(site);
      } finally {
        if (site) {
          const count = (tasks[index] as any)._resultCount as number ?? 0;
          if (onDone) onDone(site, count, hadError);
        }
      }
    }
  }

  const workers = Math.min(concurrency, tasks.length);
  for (let i = 0; i < workers; i++) {
    running.push(worker());
  }
  await Promise.all(running);
}

/** Write a progress line to stderr (overwrites previous line with \r) */
function progressLine(msg: string): void {
  process.stderr.write(`\r${msg}${' '.repeat(Math.max(0, 80 - msg.length))}`);
}

/** Clear the progress line */
function clearProgress(): void {
  process.stderr.write('\r' + ' '.repeat(80) + '\r');
}

cli({
  site: 'web',
  name: 'search',
  description: 'Search across all platforms with search commands',
  strategy: 0 as any, // No browser needed, we execute sub-commands
  timeoutSeconds: 300, // 5 minutes — individual sources have their own 30s timeout
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results per source (default 10)' },
    { name: 'concurrency', type: 'int', default: 3, help: 'Number of concurrent searches (default 3)' },
  ],
  columns: ['source', 'title', 'url'],
  footerExtra: () => undefined, // Will be overridden dynamically
  func: async (_page, kwargs) => {
    const query = kwargs.query as string;
    const limitPerSource = Math.max(1, Math.min(Number(kwargs.limit) || 10, 50));
    const concurrency = Math.max(1, Math.min(Number(kwargs.concurrency) || 3, 20));

    // Find all search commands
    const registry = getRegistry();
    const searchCommands: Array<{ site: string; name: string; url?: string }> = [];

    for (const [key, cmd] of registry) {
      if (cmd.name === 'search') {
        // Skip the web search itself to avoid recursion
        if (key === 'web/search' || key === 'web/search-list') continue;
        // Skip blocked sources to avoid wasting resources on unwanted tabs
        if (BLOCKED_SOURCES.includes(cmd.site)) continue;
        searchCommands.push({ site: cmd.site, name: cmd.name, url: cmd.domain });
      }
    }

    if (searchCommands.length === 0) {
      throw new CliError('NO_SEARCH_COMMANDS', 'No search commands found', 'This should not happen');
    }

    // Collect results and errors
    const results: SearchResult[] = [];
    const errors: Array<{ site: string; error: string }> = [];
    const SUB_COMMAND_TIMEOUT = 30000; // 30s per source

    const tasks: Array<() => Promise<void>> = searchCommands.map(({ site }) => {
      // Attach metadata to the function for progress callbacks
      const fn: any = async () => {
        let resultCount = 0;
        try {
          const cmd = registry.get(`${site}/search`);
          if (!cmd) return;

          // Find the first positional arg name (query, keyword, word, etc.)
          const queryArgName = cmd.args.find((a) => a.positional)?.name ?? 'query';
          const result = await Promise.race([
            executeCommand(cmd, { [queryArgName]: query, limit: limitPerSource }, false),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), SUB_COMMAND_TIMEOUT))
          ]);

          if (Array.isArray(result)) {
            for (const item of result) {
              if (item && typeof item === 'object') {
                // Normalize: extract title and url from various possible field names
                const title = String(item.title || item.name || item.text || item.subject || '');
                let url = String(item.url || item.link || item.href || '');

                // Skip if no meaningful title or URL
                if (!title || !url) continue;

                // Skip login/auth pages
                if (url.includes('login') || url.includes('signin') || url.includes('auth')) continue;

                // For searxng, prefix the source with "searxng:" to indicate origin
                const itemSource = String(item.source || '');
                const { source: _itemSource, ...rest } = item as any;
                const finalSource = site === 'searxng' && itemSource
                  ? `searxng:${itemSource}`
                  : (itemSource || site);

                results.push({
                  source: finalSource,
                  title,
                  url,
                  ...rest,
                });
                resultCount++;
              }
            }
          }
        } catch (err: any) {
          // Collect errors but don't fail the whole command
          errors.push({ site, error: err?.message || String(err) });
        } finally {
          fn._resultCount = resultCount;
        }
      };
      fn._site = site;
      return fn;
    });

    // Progress tracking
    let completed = 0;

    const onStart = (site: string) => {
      progressLine(`Searching [${site}]...`);
    };
    const onDone = (site: string, count: number, hadError: boolean) => {
      completed++;
      if (hadError) {
        progressLine(`[${completed}/${searchCommands.length}] ${site} failed`);
      } else {
        progressLine(`[${completed}/${searchCommands.length}] ${site} returned ${count} results`);
      }
    };
    const onError = (_site: string) => {
      completed++;
      progressLine(`[${completed}/${searchCommands.length}] ${_site} failed`);
    };

    await runWithConcurrency(tasks, concurrency, onStart, onDone, onError);
    clearProgress();
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of results) {
      // Use normalized URL as dedup key
      const normalizedUrl = r.url.split('?')[0].toLowerCase();
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        deduped.push(r);
      }
    }

    // Filter out blocked sources
    const filtered = deduped.filter((r) => !BLOCKED_SOURCES.includes(r.source));

    // Sort by source then title
    filtered.sort((a, b) => {
      const sourceCmp = a.source.localeCompare(b.source);
      if (sourceCmp !== 0) return sourceCmp;
      return a.title.localeCompare(b.title);
    });

    // Calculate per-source counts
    const sourceCounts: Record<string, number> = {};
    for (const r of filtered) {
      sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
    }

    // Log any errors at verbose level
    if (errors.length > 0 && process.env.OPENCLI_VERBOSE) {
      console.error(`\n[web/search] ${errors.length} sources failed:`);
      for (const e of errors) {
        console.error(`  - ${e.site}: ${e.error}`);
      }
    }

    if (filtered.length === 0) {
      throw new CliError(
        'NO_RESULTS',
        `No search results for: ${query}`,
        `Tried ${searchCommands.length} sources, all returned empty or failed`
      );
    }

    // Build source summary string
    const sourceSummary = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => `${source}:${count}`)
      .join(', ');

    // Return results with _sourceCounts metadata for JSON output
    return {
      _meta: { sourceCounts, sourceSummary },
      _data: filtered.map((r) => ({
        source: r.source,
        title: r.title,
        url: r.url,
      })),
    };
  },
});

/**
 * Web Search - aggregate search results from all available search commands.
 *
 * Discovers all commands with name='search' and executes them in parallel,
 * then aggregates and deduplicates the results.
 *
 * Usage:
 *   opencli web search "AI"                    # Search across all platforms
 *   opencli web search "AI" --limit 50        # Limit total results
 *   opencli web search "AI" -f json           # JSON output
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

cli({
  site: 'web',
  name: 'search',
  description: 'Search across all platforms with search commands',
  strategy: 0 as any, // No browser needed, we execute sub-commands
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results per source (default 10)' },
  ],
  columns: ['source', 'title', 'url'],
  footerExtra: () => undefined, // Will be overridden dynamically
  func: async (_page, kwargs) => {
    const query = kwargs.query as string;
    const limitPerSource = Math.max(1, Math.min(Number(kwargs.limit) || 10, 50));

    // Find all search commands
    const registry = getRegistry();
    const searchCommands: Array<{ site: string; name: string; url?: string }> = [];

    for (const [key, cmd] of registry) {
      if (cmd.name === 'search') {
        // Skip the web search itself to avoid recursion
        if (key === 'web/search' || key === 'web/search-list') continue;
        searchCommands.push({ site: cmd.site, name: cmd.name, url: cmd.domain });
      }
    }

    if (searchCommands.length === 0) {
      throw new CliError('NO_SEARCH_COMMANDS', 'No search commands found', 'This should not happen');
    }

    // Execute all search commands in parallel with timeout
    const results: SearchResult[] = [];
    const errors: Array<{ site: string; error: string }> = [];
    const SUB_COMMAND_TIMEOUT = 15000; // 15s per source

    const searchPromises = searchCommands.map(async ({ site }) => {
      try {
        const cmd = registry.get(`${site}/search`);
        if (!cmd) return;

        const result = await Promise.race([
          executeCommand(cmd, { query, limit: limitPerSource }, false),
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

              results.push({
                source: site,
                title,
                url,
                ...item,
              });
            }
          }
        }
      } catch (err: any) {
        // Collect errors but don't fail the whole command
        errors.push({ site, error: err?.message || String(err) });
      }
    });

    await Promise.all(searchPromises);

    // Deduplicate by URL
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

    // Sort by source then title
    deduped.sort((a, b) => {
      const sourceCmp = a.source.localeCompare(b.source);
      if (sourceCmp !== 0) return sourceCmp;
      return a.title.localeCompare(b.title);
    });

    // Calculate per-source counts
    const sourceCounts: Record<string, number> = {};
    for (const r of deduped) {
      sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
    }

    // Log any errors at verbose level
    if (errors.length > 0 && process.env.OPENCLI_VERBOSE) {
      console.error(`\n[web/search] ${errors.length} sources failed:`);
      for (const e of errors) {
        console.error(`  - ${e.site}: ${e.error}`);
      }
    }

    if (deduped.length === 0) {
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
      _data: deduped.map((r) => ({
        source: r.source,
        title: r.title,
        url: r.url,
      })),
    };
  },
});

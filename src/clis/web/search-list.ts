/**
 * Web Search Sources - list all available search sources for web search.
 *
 * Lists all registered commands with name='search' that can be used with web search.
 *
 * Usage:
 *   opencli web search list
 */

import { cli, getRegistry } from '../../registry.js';

cli({
  site: 'web',
  name: 'search-list',
  description: 'List all search sources available for web search',
  strategy: 0 as any, // No browser needed, just reads registry
  args: [],
  columns: ['site', 'domain', 'description'],
  func: async () => {
    const registry = getRegistry();
    const sources: Array<{ site: string; domain?: string; description: string }> = [];

    for (const [key, cmd] of registry) {
      if (cmd.name === 'search') {
        // Skip the web search itself
        if (key === 'web/search' || key === 'web/search-list') continue;
        sources.push({
          site: cmd.site,
          domain: cmd.domain,
          description: cmd.description || '',
        });
      }
    }

    // Sort by site name
    sources.sort((a, b) => a.site.localeCompare(b.site));

    return sources.map((s, i) => ({
      site: s.site,
      domain: s.domain || '-',
      description: s.description,
    }));
  },
});

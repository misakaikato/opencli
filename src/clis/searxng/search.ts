/**
 * SearXNG meta search engine - aggregates results from multiple search engines.
 *
 * Requires SEARXNG_BASEURL environment variable pointing to your SearXNG instance.
 * Example: SEARXNG_BASEURL=http://localhost:10086
 *
 * Usage:
 *   SEARXNG_BASEURL=http://localhost:10086 opencli searxng search "query"
 *   SEARXNG_BASEURL=http://localhost:10086 opencli searxng search "query" --limit 20
 */

import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';

cli({
  site: 'searxng',
  name: 'search',
  description: 'Search via SearXNG meta search engine',
  domain: 'searxng',
  strategy: Strategy.PUBLIC,
  requiredEnv: [
    { name: 'SEARXNG_BASEURL', help: 'Base URL of SearXNG instance (e.g. http://localhost:10086)' },
  ],
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 20, help: 'Max results' },
    { name: 'language', default: 'auto', help: 'Language code (e.g. en, zh, auto)' },
    { name: 'safesearch', type: 'int', default: 0, help: 'Safe search: 0=none, 1=moderate, 2=strict' },
    { name: 'time_range', help: 'Time range: day, month, year' },
  ],
  columns: ['title', 'url', 'source', 'content'],
  func: async (_page, args) => {
    const baseUrl = process.env.SEARXNG_BASEURL;
    if (!baseUrl) {
      throw new CliError(
        'MISSING_ENV',
        'SEARXNG_BASEURL environment variable is required',
        'Set SEARXNG_BASEURL to your SearXNG instance URL (e.g. http://localhost:10086)'
      );
    }

    const query = args.query as string;
    const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      pageno: '1',
      safesearch: String(args.safesearch ?? 0),
    });

    if (args.language && args.language !== 'auto') {
      params.set('language', String(args.language));
    }
    if (args.time_range) {
      params.set('time_range', String(args.time_range));
    }

    const url = `${baseUrl.replace(/\/$/, '')}/search?${params.toString()}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new CliError(
        'NETWORK_ERROR',
        `Failed to connect to SearXNG at ${baseUrl}`,
        'Make sure SearXNG is running and SEARXNG_BASEURL is correct'
      );
    }

    if (!response.ok) {
      throw new CliError(
        'HTTP_ERROR',
        `SearXNG returned ${response.status}`,
        `Check that SearXNG is running at ${baseUrl}`
      );
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        engine?: string;
        pretty_url?: string;
      }>;
      answers?: string[];
      infoboxes?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const results = data.results || [];
    const processed = results.slice(0, limit).map((r, i) => ({
      title: r.title || '',
      url: r.url || r.pretty_url || '',
      source: r.engine || '',
      content: r.content || '',
    })).filter(r => r.title && r.url);

    if (processed.length === 0) {
      throw new CliError(
        'NO_RESULTS',
        `No results found for: ${query}`,
        'Try a different query, or check SearXNG settings'
      );
    }

    return processed;
  },
});

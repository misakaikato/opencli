/**
 * 殆知阁 adapter utilities.
 *
 * daizhige.org exposes a public JSON search API — no key required.
 * API: /api/search, /api/search/fulltext, /api/stats
 */

import { CliError } from '../../errors.js';

export const DAIZHIGE_BASE = 'https://daizhige.org';

export const COLLECTIONS = [
	'儒藏',
	'史藏',
	'子藏',
	'集藏',
	'诗藏',
	'艺藏',
	'易藏',
	'医藏',
	'佛藏',
	'道藏',
] as const;

export type Collection = (typeof COLLECTIONS)[number];

export interface DaizhigeResult {
	id: string;
	score: number;
	source: {
		title: string;
		chapter: string;
		collection: string;
		collection_en: string;
		book_category: string;
		filepath: string;
		char_count: number;
		is_classical: boolean;
		url: string;
	};
	highlight?: {
		title?: string[];
		chapter?: string[];
		content?: string[];
	};
}

export interface DaizhigeSearchResponse {
	success: boolean;
	data: {
		total: number;
		page: number;
		size: number;
		results: DaizhigeResult[];
	};
	error?: { reason?: string; message?: string };
}

export interface DaizhigeStatsResponse {
	success: boolean;
	data: {
		totalDocs: number;
		indexSizeMB: number;
		lastUpdated?: string;
		supportsFulltextMatchMode: boolean;
	};
}

function stripHighlightTags(html: string): string {
	return html.replace(/<[^>]+>/g, '');
}

export async function daizhigeFetch<T>(
	endpoint: string,
	params: Record<string, string | string[]>,
): Promise<T> {
	const url = new URL(endpoint, DAIZHIGE_BASE);
	for (const [key, value] of Object.entries(params)) {
		if (Array.isArray(value)) {
			for (const v of value) url.searchParams.append(key, v);
		} else {
			url.searchParams.set(key, value);
		}
	}
	const resp = await fetch(url);
	if (!resp.ok) {
		throw new CliError(
			'FETCH_ERROR',
			`殆知阁 API HTTP ${resp.status}`,
			'请检查网络连接或稍后重试',
		);
	}
	return resp.json() as Promise<T>;
}

export function formatResult(
	result: DaizhigeResult,
	index: number,
): Record<string, unknown> {
	const { source, highlight } = result;
	const title = highlight?.title?.[0]
		? stripHighlightTags(highlight.title[0])
		: source.title;
	const content = highlight?.content?.[0]
		? stripHighlightTags(highlight.content[0]).slice(0, 200)
		: '';

	return {
		rank: index + 1,
		title,
		chapter: source.chapter || '-',
		collection: source.collection,
		category: source.book_category || '-',
		chars: source.char_count.toLocaleString(),
		classical: source.is_classical ? '是' : '否',
		snippet: content || '-',
		url: `${DAIZHIGE_BASE}${source.url}`,
	};
}

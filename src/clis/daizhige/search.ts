import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import {
    DAIZHIGE_BASE,
    COLLECTIONS,
    daizhigeFetch,
    formatResult,
    type DaizhigeSearchResponse,
} from './utils.js';

cli({
    site: 'daizhige',
    name: 'search',
    description: '搜索殆知阁中国古典文献',
    domain: 'daizhige.org',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        {
            name: 'query',
            positional: true,
            required: true,
            help: '搜索关键词（书名、内容、作者等）',
        },
        {
            name: 'collection',
            type: 'str',
            help: `典籍分类（${[...COLLECTIONS].join('、')}）`,
        },
        { name: 'page', type: 'int', default: 0, help: '页码（从 0 开始）' },
        {
            name: 'limit',
            type: 'int',
            default: 20,
            help: '每页结果数（0=获取全部，10/20/50/100）',
        },
        {
            name: 'fulltext',
            type: 'bool',
            default: false,
            help: '使用全文匹配模式',
        },
        {
            name: 'exact',
            type: 'bool',
            default: false,
            help: '精确匹配（自动为关键词加引号，匹配完整短语）',
        },
    ],
    columns: ['rank', 'title', 'collection', 'category', 'chapter', 'chars', 'snippet'],
    func: async (_page, args) => {
        let query = args.query as string;
        const page = Number(args.page ?? 0);
        const limit = Number(args.limit ?? 20);
        const fulltext = Boolean(args.fulltext);
        const exact = Boolean(args.exact);
        const collection = args.collection as string | undefined;

        if (exact && !query.startsWith('"')) {
            query = `"${query}"`;
        }

        if (collection && !COLLECTIONS.includes(collection as never)) {
            throw new CliError(
                'INVALID_ARG',
                `无效的分类: ${collection}`,
                `可选分类: ${[...COLLECTIONS].join('、')}`,
            );
        }

        const endpoint = fulltext
            ? '/api/search/fulltext'
            : '/api/search';

        // limit=0 means fetch all results via pagination
        if (limit === 0) {
            const allResults = [];
            let curPage = 0;
            const batchSize = 100;
            let total = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const params: Record<string, string | string[]> = {
                    q: query,
                    page: curPage.toString(),
                    size: batchSize.toString(),
                };
                if (collection) params.collection = [collection];

                const result = await daizhigeFetch<DaizhigeSearchResponse>(
                    endpoint,
                    params,
                );

                if (!result.success || !result.data) {
                    const msg = result.error?.reason || result.error?.message || '搜索失败';
                    throw new CliError('SEARCH_ERROR', msg, '请尝试其他关键词');
                }

                const { results, total: t } = result.data;
                total = t;
                if (!results.length) break;
                allResults.push(...results);
                if (allResults.length >= total) break;
                curPage++;
            }
            if (!allResults.length) {
                const hint = !exact
                    ? '尝试使用 --exact 进行精确搜索，或更换关键词'
                    : '尝试更换关键词或去掉 --exact 使用模糊搜索';
                throw new CliError(
                    'NOT_FOUND',
                    `未找到与「${query}」相关的文献`,
                    hint,
                );
            }
            return allResults.map((r, i) => formatResult(r, i));
        }

        const params: Record<string, string | string[]> = {
            q: query,
            page: page.toString(),
            size: limit.toString(),
        };
        if (collection) params.collection = [collection];

        const result = await daizhigeFetch<DaizhigeSearchResponse>(
            endpoint,
            params,
        );

        if (!result.success || !result.data) {
            const msg = result.error?.reason || result.error?.message || '搜索失败';
            throw new CliError('SEARCH_ERROR', msg, '请尝试其他关键词');
        }

        const { results, total } = result.data;
        if (!results.length) {
            const hint = !exact
                ? '尝试使用 --exact 进行精确搜索，或更换关键词'
                : '尝试更换关键词或去掉 --exact 使用模糊搜索';
            throw new CliError(
                'NOT_FOUND',
                `未找到与「${query}」相关的文献`,
                hint,
            );
        }

        return results.map((r, i) => formatResult(r, page * limit + i));
    },
    footerExtra: (kwargs) => {
        const page = Number(kwargs.page ?? 0);
        if (page > 0) return `提示: 使用 --page ${page + 1} 查看下一页`;
        return undefined;
    },
});

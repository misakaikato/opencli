import { cli, Strategy } from '../../registry.js';
import { daizhigeFetch, type DaizhigeStatsResponse } from './utils.js';

cli({
	site: 'daizhige',
	name: 'stats',
	description: '查看殆知阁文献库统计信息',
	domain: 'daizhige.org',
	strategy: Strategy.PUBLIC,
	browser: false,
	args: [],
	columns: ['metric', 'value'],
	func: async () => {
		const result = await daizhigeFetch<DaizhigeStatsResponse>(
			'/api/stats',
			{},
		);

		if (!result.success || !result.data) {
			return [{ metric: '状态', value: '无法获取统计信息' }];
		}

		const { totalDocs, indexSizeMB, lastUpdated, supportsFulltextMatchMode } =
			result.data;
		const updated = lastUpdated
			? new Date(lastUpdated).toLocaleDateString('zh-CN')
			: '未知';

		return [
			{ metric: '收录文献', value: `${totalDocs.toLocaleString()} 部` },
			{ metric: '索引大小', value: `${indexSizeMB.toLocaleString()} MB` },
			{ metric: '最近更新', value: updated },
			{
				metric: '全文匹配',
				value: supportsFulltextMatchMode ? '支持' : '不支持',
			},
		];
	},
});

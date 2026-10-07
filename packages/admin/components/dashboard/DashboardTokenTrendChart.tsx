'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {useThemeSettings} from '@xsec/ui-react';
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatCompactTokens } from '@/lib/format-compact-tokens';
import type { DashboardTimeseriesRow } from '@/lib/types';
import { formatDashboardBucketLabel } from './format-dashboard-bucket';

export type DashboardTokenTrendChartProps = {
	timeseries: DashboardTimeseriesRow[];
	granularity: 'hour' | 'day';
};

export function DashboardTokenTrendChart({ timeseries, granularity }: DashboardTokenTrendChartProps) {
	const t = useTranslations('dashboard');
	const settings=useThemeSettings(),colors=settings.colorMode==='dark'?['#93c5fd','#5eead4','#fcd34d','#d8b4fe']:['#1d4ed8','#0f766e','#92400e','#7e22ce'];

	const chartData = useMemo(
		() =>
			timeseries.map((row) => ({
				bucket: formatDashboardBucketLabel(row.bucket, granularity),
				input_tokens: row.input_tokens,
				output_tokens: row.output_tokens,
				cache_read_tokens: row.cache_read_tokens,
				cache_write_tokens: row.cache_write_tokens,
				cache_hit_rate: row.cache_hit_rate,
			})),
		[timeseries, granularity]
	);

	return (
		<section className="dashboard-panel dashboard-trend p-6 h-full" aria-label={t('tokenTrend')}>
			<h2 className="text-lg font-semibold text-gray-900 mb-4">{t('tokenTrend')}</h2>
			{chartData.length === 0 ? (
				<div className="text-sm text-gray-500 py-12 text-center">{t('noChartData')}</div>
			) : (
				<div className="h-72">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={chartData} accessibilityLayer>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--xui-border)" />
							<XAxis dataKey="bucket" tick={{ fontSize: 11,fill:'var(--xui-muted)' }} stroke="var(--xui-muted)" interval="preserveStartEnd" />
							<YAxis tickFormatter={(v) => formatCompactTokens(v)} width={48} tick={{ fontSize: 11,fill:'var(--xui-muted)' }} stroke="var(--xui-muted)" />
							<Tooltip contentStyle={{background:'var(--xui-surface)',borderColor:'var(--xui-border)',borderRadius:'var(--xui-radius-control)',color:'var(--xui-text)'}} formatter={(value: number, name: string) => {
								if (name === 'cache_hit_rate') return [`${value.toFixed(1)}%`, t('cacheHitRate')];
								return [formatCompactTokens(value), name];
							}} />
							<Legend />
							<Line type="monotone" dataKey="input_tokens" name={t('inputTokens')} stroke={colors[0]} dot={false} strokeWidth={2} isAnimationActive={!settings.reducedMotion} animationDuration={200}/>
							<Line type="monotone" dataKey="output_tokens" name={t('outputTokens')} stroke={colors[1]} dot={false} strokeWidth={2} isAnimationActive={!settings.reducedMotion} animationDuration={200}/>
							<Line type="monotone" dataKey="cache_read_tokens" name={t('cacheReadTokens')} stroke={colors[2]} dot={false} strokeWidth={2} isAnimationActive={!settings.reducedMotion} animationDuration={200}/>
							<Line type="monotone" dataKey="cache_write_tokens" name={t('cacheWriteTokens')} stroke={colors[3]} dot={false} strokeWidth={2} isAnimationActive={!settings.reducedMotion} animationDuration={200}/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			)}
		</section>
	);
}

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {ControlButton,Table,TableHead,TableBody,TableRow,TableHeader,TableCell,useThemeSettings} from '@xsec/ui-react';
import { formatCompactTokens } from '@/lib/format-compact-tokens';
import { formatGatewayMoneyCode } from '@/lib/format-gateway-currency';
import type { DashboardModelDistributionRow, DashboardTopUserRow } from '@/lib/types';

const CHART_COLORS = {
 light:['#1d4ed8','#0f766e','#92400e','#7e22ce','#be123c','#166534','#075985','#86198f','#475569','#292524'],
 dark:['#93c5fd','#5eead4','#fcd34d','#d8b4fe','#fda4af','#86efac','#7dd3fc','#f0abfc','#cbd5e1','#d6d3d1'],
};

type ViewMode = 'models' | 'users';

export type DashboardModelDistributionChartProps = {
	modelDistribution: DashboardModelDistributionRow[];
	topUsers: DashboardTopUserRow[];
	billingCurrency: string|null;
};

export function DashboardModelDistributionChart({
	modelDistribution,
	topUsers,
	billingCurrency,
}: DashboardModelDistributionChartProps) {
	const t = useTranslations('dashboard');
	const common=useTranslations('common'),settings=useThemeSettings(),colors=CHART_COLORS[settings.colorMode];
	const [view, setView] = useState<ViewMode>('models');

	const pieData = useMemo(() => {
		if (view === 'models') {
			return modelDistribution.map((row) => ({
				name: row.model_id,
				value: row.total_tokens,
			}));
		}
		return topUsers.map((row) => ({
			name: row.user_email,
			value: row.total_tokens,
		}));
	}, [modelDistribution, topUsers, view]);

	const tableRows = view === 'models' ? modelDistribution : topUsers;

	return (
		<section className="dashboard-panel dashboard-distribution p-6 h-full" aria-label={view==='models'?t('modelDistribution'):t('userLeaderboard')}>
			<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
				<h2 className="text-lg font-semibold text-gray-900">
					{view === 'models' ? t('modelDistribution') : t('userLeaderboard')}
				</h2>
				<div className="dashboard-presets" role="group" aria-label={t('modelDistribution')}>
					<ControlButton
						type="button"
						onClick={() => setView('models')}
						variant={view==='models'?'secondary':'ghost'} aria-pressed={view==='models'}
					>
						{t('modelDistributionTab')}
					</ControlButton>
					<ControlButton
						type="button"
						onClick={() => setView('users')}
						variant={view==='users'?'secondary':'ghost'} aria-pressed={view==='users'}
					>
						{t('userLeaderboardTab')}
					</ControlButton>
				</div>
			</div>

			{tableRows.length === 0 ? (
				<div className="text-sm text-gray-500 py-12 text-center">{t('noChartData')}</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="h-56 dashboard-pie" role="img" aria-label={view==='models'?t('modelDistribution'):t('userLeaderboard')}>
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={pieData}
									dataKey="value"
									nameKey="name"
									innerRadius={52}
									outerRadius={88}
									paddingAngle={2}
									isAnimationActive={!settings.reducedMotion} animationDuration={200}
								>
									{pieData.map((entry, index) => (
										<Cell key={entry.name} fill={colors[index % colors.length]} />
									))}
								</Pie>
								<Tooltip formatter={(value: number) => formatCompactTokens(value)} contentStyle={{background:'var(--xui-surface)',borderColor:'var(--xui-border)',borderRadius:'var(--xui-radius-control)',color:'var(--xui-text)'}} itemStyle={{color:'var(--xui-text)'}} />
							</PieChart>
						</ResponsiveContainer>
					</div>

					<div className="dashboard-distribution-table">
						<Table aria-label={view==='models'?t('modelDistribution'):t('userLeaderboard')}>
							<TableHead>
								<TableRow>
									<TableHeader>{view === 'models' ? t('modelColumn') : t('userColumn')}</TableHeader>
									<TableHeader>{t('requestsColumn')}</TableHeader>
									<TableHeader>{t('tokensColumn')}</TableHeader>
									<TableHeader>{t('chargedColumn')}</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody>
								{tableRows.map((row) => {
									const label = view === 'models'
										? (row as DashboardModelDistributionRow).model_id
										: (row as DashboardTopUserRow).user_email;
									return (
										<TableRow key={label}>
											<TableCell className="dashboard-distribution-label" title={label}>{label}</TableCell>
											<TableCell>{row.request_count.toLocaleString()}</TableCell>
											<TableCell>{formatCompactTokens(row.total_tokens)}</TableCell>
											<TableCell>{billingCurrency===null?common('noData'):formatGatewayMoneyCode(row.charged_cost,billingCurrency,4)}</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				</div>
			)}
		</section>
	);
}

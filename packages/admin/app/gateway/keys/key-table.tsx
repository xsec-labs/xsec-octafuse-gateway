'use client';
import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
	Badge,
	ControlButton,
	Table,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
	TableHeader,
} from '@xsec/ui-react';
import { formatGatewayDateTime } from '@/lib/datetime';
import { formatGatewayMoneyCode } from '@/lib/format-gateway-currency';
import { summarizeMetadata } from '@/lib/summarize-metadata';
import { useBillingCurrency } from '@/lib/use-billing-currency';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import type { GatewayApiKey } from '@/lib/types';
import { CopyControl } from './key-copy-control';

/** Stable list props keep draft typing inside the editor. */
export const KeyTable = memo(function KeyTable({
	keys,
	order,
	disabled,
	onEdit,
	onSort,
}: {
	keys: GatewayApiKey[];
	order: 'asc' | 'desc';
	disabled: boolean;
	onEdit: (key?: GatewayApiKey) => void;
	onSort: () => void;
}) {
	const t = useTranslations('keysPage'),
		common = useTranslations('common'),
		options = useTranslations('options');
	const { currency } = useBillingCurrency(),
		{ businessTimezone } = useGatewayDateTime();
	const timestamp = (value: string | null) =>
		value ? formatGatewayDateTime(value, businessTimezone) : '—';
	const statusLabel = (status: string) =>
		status === 'active' || status === 'revoked'
			? options('keyStatus.' + status)
			: status;
	const money = (value: number) => formatGatewayMoneyCode(value, currency, 2);
	const budget = (row: { budget_spent: number; budget_max: number | null }) =>
		`${money(row.budget_spent)} / ${
			row.budget_max == null ? common('noLimit') : money(row.budget_max)
		}`;
	return (
		<Table aria-label={t('title')}>
			<TableHead>
				<TableRow>
					<TableHeader>{t('table.status')}</TableHeader>
					<TableHeader>{t('table.user')}</TableHeader>
					<TableHeader>{t('table.key')}</TableHeader>
					<TableHeader>{t('table.name')}</TableHeader>
					<TableHeader>{t('table.userBudget')}</TableHeader>
					<TableHeader>{t('table.apiKeyMetadata')}</TableHeader>
					<TableHeader aria-sort={order === 'asc' ? 'ascending' : 'descending'}>
						<ControlButton
							size="sm"
							variant="ghost"
							aria-label={t('feedback.sortCreated')}
							disabled={disabled}
							onClick={onSort}
						>
							{t('table.created')}
							{order === 'asc' ? ' ↑' : ' ↓'}
						</ControlButton>
					</TableHeader>
				</TableRow>
			</TableHead>
			<TableBody>
				{keys.map((row) => {
					const meta = summarizeMetadata(row.metadata),
						budgetLine =
							budget(row) +
							(row.budget_period !== 'none'
								? ` · ${row.budget_period} · ${timestamp(row.budget_reset_at)}`
								: '');
					return (
						<TableRow key={row.id}>
							<TableCell>
								<Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
									{statusLabel(row.status)}
								</Badge>
							</TableCell>
							<TableCell>
								<span
									className="key-truncate"
									title={row.user_email ?? undefined}
								>
									{row.user_email || '—'}
								</span>
							</TableCell>
							<TableCell>
								<div className="key-secret-row">
									<span className="key-mono">
										{row.key.length < 10
											? row.key
											: row.key.slice(0, 7) + '…' + row.key.slice(-4)}
									</span>
									<CopyControl value={row.key} label={t('copyKey')} />
								</div>
							</TableCell>
							<TableCell>
								<ControlButton
									size="sm"
									variant="ghost"
									disabled={disabled}
									aria-label={t('feedback.editKey', {
										name: row.name || row.id,
									})}
									onClick={() => onEdit(row)}
								>
									<span className="key-truncate">{row.name || '—'}</span>
								</ControlButton>
							</TableCell>
							<TableCell>
								<span className="key-truncate" title={budgetLine}>
									{budgetLine}
								</span>
							</TableCell>
							<TableCell>
								<span
									className={
										'key-truncate key-mono ' +
										(!meta.empty && !meta.ok ? 'key-invalid' : '')
									}
									title={meta.empty ? undefined : meta.summary}
								>
									{meta.empty ? '—' : meta.summary}
								</span>
							</TableCell>
							<TableCell className="key-date">
								{timestamp(row.created_at)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});

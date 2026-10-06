'use client';
import { memo } from 'react';
import Link from 'next/link';
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
import { formatGatewayMoneyCode } from '@/lib/format-gateway-currency';
import { formatGatewayDateTime } from '@/lib/datetime';
import { summarizeMetadata } from '@/lib/summarize-metadata';
import { useBillingCurrency } from '@/lib/use-billing-currency';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import type { GatewayUserListItem } from '@/lib/types';
import type { UserSortKey } from './use-users-page-state';
export const UserTable = memo(function UserTable({
	users,
	sort,
	order,
	disabled,
	onSort,
	onMetadata,
}: {
	users: GatewayUserListItem[];
	sort: UserSortKey;
	order: 'asc' | 'desc';
	disabled: boolean;
	onSort: (key: UserSortKey) => void;
	onMetadata: (user: GatewayUserListItem) => void;
}) {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		options = useTranslations('options');
	const { currency } = useBillingCurrency(),
		{ businessTimezone } = useGatewayDateTime();
	const money = (value: number) => formatGatewayMoneyCode(value, currency, 2);
	const timestamp = (value: string | null) =>
		value ? formatGatewayDateTime(value, businessTimezone) : '—';
	const heading = (key: UserSortKey, label: string, numeric = false) => (
		<TableHeader
			className={numeric ? 'user-numeric' : ''}
			aria-sort={
				sort === key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'
			}
		>
			<ControlButton
				size="sm"
				variant="ghost"
				disabled={disabled}
				aria-label={t('feedback.sortBy', { label })}
				onClick={() => onSort(key)}
			>
				{label}
				{sort === key ? (order === 'asc' ? ' ↑' : ' ↓') : ''}
			</ControlButton>
		</TableHeader>
	);
	return (
		<Table aria-label={t('title')}>
			<TableHead>
				<TableRow>
					<TableHeader>{t('table.statusEmail')}</TableHeader>
					{heading('budget_spent', t('table.spent'), true)}
					{heading('budget_max', t('table.max'), true)}
					{heading('budget_base', t('table.base'), true)}
					<TableHeader>{t('table.period')}</TableHeader>
					{heading('budget_reset_at', t('table.resetAt'))}
					<TableHeader className="user-numeric">{t('table.keys')}</TableHeader>
					<TableHeader>{t('table.metadata')}</TableHeader>
					{heading('created_at', t('table.created'))}
				</TableRow>
			</TableHead>
			<TableBody>
				{users.map((user) => {
					const meta = summarizeMetadata(user.metadata);
					return (
						<TableRow key={user.id}>
							<TableCell>
								<div className="user-identity">
									<Badge
										tone={user.status === 'active' ? 'success' : 'neutral'}
									>
										{['active', 'disabled'].includes(user.status)
											? options('userStatus.' + user.status)
											: user.status}
									</Badge>
									<Link
										className="user-email user-truncate"
										href={'/gateway/users/' + encodeURIComponent(user.id)}
										prefetch={false}
										aria-label={t('feedback.detail', {
											name: user.email || user.id,
										})}
										title={user.email || user.id}
									>
										{user.email || user.id}
									</Link>
								</div>
							</TableCell>
							<TableCell className="user-numeric">
								{money(user.budget_spent)}
							</TableCell>
							<TableCell className="user-numeric">
								{user.budget_max === null
									? common('noLimit')
									: money(user.budget_max)}
							</TableCell>
							<TableCell className="user-numeric">
								{user.budget_base === 0 ? '—' : money(user.budget_base)}
							</TableCell>
							<TableCell>
								{user.budget_period !== 'none' ? user.budget_period : '—'}
							</TableCell>
							<TableCell className="user-date">
								{timestamp(user.budget_reset_at)}
							</TableCell>
							<TableCell className="user-numeric">
								{user.active_keys_count}
							</TableCell>
							<TableCell>
								{meta.empty ? (
									'—'
								) : (
									<div className="user-metadata-line">
										<span
											className={
												'user-truncate user-mono ' +
												(meta.ok ? '' : 'user-invalid')
											}
											title={meta.summary}
										>
											{meta.summary}
										</span>
										<ControlButton
											variant="ghost"
											size="sm"
											disabled={disabled}
											onClick={() => onMetadata(user)}
											aria-label={t('feedback.metadataFor', {
												name: user.email || user.id,
											})}
										>
											{common('details')}
										</ControlButton>
									</div>
								)}
							</TableCell>
							<TableCell className="user-date">
								{timestamp(user.created_at)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});

'use client';
import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
	Badge,
	ControlButton,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@xsec/ui-react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { CopyControl } from '@/components/GatewayCopyControl';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import {
	formatGatewayMoneyCode,
	formatGatewayMoneyCodeSigned,
	getGatewayCurrencySymbol,
} from '@/lib/format-gateway-currency';
import { GATEWAY_MONEY_DECIMAL_PLACES } from '@/lib/gateway-money';
import { normalizeRouteGroup } from '@/lib/route-group-ui';
import { summarizeUserSnapshotDiffLines } from '@/lib/audit-user-snapshot-diff';
import { summarizeMetadata } from '@/lib/summarize-metadata';
import type { RecentAudit, RecentLog, UserKey } from './detail-api';

export function maskKey(key: string) {
	return key.length < 10 ? key : `${key.slice(0, 7)}…${key.slice(-4)}`;
}
const shortId = (id: string) =>
	id.length < 14 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
const OMIT_AUDIT_NEIGHBOR_FIELDS = ['budget_spent', 'budget_max'] as const;
export const UserKeysTable = memo(function UserKeysTable({
	keys,
	locked,
	onToggle,
	onDelete,
	onMetadata,
}: {
	keys: UserKey[];
	locked: boolean;
	onToggle: (key: UserKey) => Promise<void>;
	onDelete: (key: UserKey) => void;
	onMetadata: (key: UserKey) => void;
}) {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		feedback = useTranslations('users.detailFeedback');
	return (
		<Table aria-label={t('apiKeys')}>
			<TableHead>
				<TableRow>
					{['key', 'name', 'metadata', 'status', 'actions'].map((name) => (
						<TableHeader key={name}>{common(name)}</TableHeader>
					))}
				</TableRow>
			</TableHead>
			<TableBody>
				{keys.map((key) => {
					const metadata = summarizeMetadata(key.metadata);
					return (
						<TableRow key={key.id}>
							<TableCell>
								<div className="user-detail-key-value">
									<code>{maskKey(key.key)}</code>
									<CopyControl
										value={key.key}
										label={feedback('copyKey', {
											name: key.name || shortId(key.id),
										})}
									/>
								</div>
								<span
									className="user-detail-muted user-detail-mono"
									title={key.id}
								>
									{shortId(key.id)}
								</span>
							</TableCell>
							<TableCell>
								<span
									className="user-detail-truncate"
									title={key.name ?? undefined}
								>
									{key.name || '—'}
								</span>
							</TableCell>
							<TableCell>
								{metadata.empty ? (
									'—'
								) : (
									<div className="user-detail-key-value">
										<span
											className={
												'user-detail-truncate user-detail-mono' +
												(!metadata.ok ? ' user-detail-invalid' : '')
											}
											title={metadata.summary}
										>
											{metadata.summary}
										</span>
										<ControlButton
											variant="ghost"
											size="sm"
											onClick={() => onMetadata(key)}
											aria-label={feedback('metadataFor', {
												name: key.name || shortId(key.id),
											})}
										>
											{t('keysTable.details')}
										</ControlButton>
									</div>
								)}
							</TableCell>
							<TableCell>
								<Switch
									disabled={locked}
									checked={key.status === 'active'}
									onCheckedChange={() => void onToggle(key)}
									label={
										key.status === 'active'
											? t('keysTable.activeClickToRevoke')
											: t('keysTable.inactiveClickToActivate')
									}
								/>
							</TableCell>
							<TableCell>
								<ControlButton
									variant="danger"
									size="sm"
									disabled={locked}
									onClick={() => onDelete(key)}
									aria-label={feedback('deleteKey', {
										name: key.name || shortId(key.id),
									})}
								>
									<TrashIcon className="h-4 w-4" aria-hidden />
									{common('delete')}
								</ControlButton>
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});
export const RecentLogsTable = memo(function RecentLogsTable({
	logs,
	currency,
}: {
	logs: RecentLog[];
	currency: string;
}) {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		feedback = useTranslations('users.detailFeedback');
	const { formatDateTime } = useGatewayDateTime(),
		symbol = getGatewayCurrencySymbol(currency);
	return (
		<Table aria-label={t('detailSections.recentRequestLogs')}>
			<TableHead>
				<TableRow>
					<TableHeader>{common('time')}</TableHeader>
					<TableHeader>{common('model')}</TableHeader>
					<TableHeader>{t('table.group')}</TableHeader>
					<TableHeader>{common('provider')}</TableHeader>
					<TableHeader>{common('status')}</TableHeader>
					{['standard', 'charged', 'metered'].map((name) => (
						<TableHeader key={name}>
							{feedback(name)} ({symbol})
						</TableHeader>
					))}
				</TableRow>
			</TableHead>
			<TableBody>
				{logs.map((log) => {
					const group = normalizeRouteGroup(log.route_group),
						provider =
							log.provider_name?.trim() || log.provider_id?.trim() || '—',
						model = log.model_name || log.model_id || '—';
					return (
						<TableRow key={log.id}>
							<TableCell>{formatDateTime(log.created_at)}</TableCell>
							<TableCell>
								<span
									className="user-detail-truncate user-detail-mono"
									title={model}
								>
									{model}
								</span>
							</TableCell>
							<TableCell>
								<Badge
									className="user-detail-mono"
									title={`route_group: ${group}`}
								>
									@{group}
								</Badge>
							</TableCell>
							<TableCell>
								<span className="user-detail-truncate" title={provider}>
									{provider}
								</span>
							</TableCell>
							<TableCell>
								<Badge tone={log.status === 'success' ? 'success' : 'danger'}>
									{log.status}
								</Badge>
							</TableCell>
							<TableCell className="user-detail-money">
								{formatGatewayMoneyCode(log.standard_cost ?? 0, currency, 4)}
							</TableCell>
							<TableCell className="user-detail-money">
								{formatGatewayMoneyCode(log.charged_cost, currency, 4)}
							</TableCell>
							<TableCell className="user-detail-money">
								{formatGatewayMoneyCode(log.metered_cost, currency, 4)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});
export const RecentAuditsTable = memo(function RecentAuditsTable({
	audits,
	currency,
}: {
	audits: RecentAudit[];
	currency: string;
}) {
	const t = useTranslations('users'),
		common = useTranslations('common');
	const { formatDateTime } = useGatewayDateTime();
	return (
		<Table aria-label={t('detailSections.userAuditLogs')}>
			<TableHead>
				<TableRow>
					<TableHeader>{common('time')}</TableHeader>
					{[
						'event',
						'sourceTrace',
						'deltaSpend',
						'budgetMaxChange',
						'userSnapshotDelta',
					].map((name) => (
						<TableHeader key={name}>{t('table.' + name)}</TableHeader>
					))}
				</TableRow>
			</TableHead>
			<TableBody>
				{audits.map((audit) => {
					const lines = summarizeUserSnapshotDiffLines({
						before_user_snapshot: audit.before_user_snapshot ?? null,
						after_user_snapshot: audit.after_user_snapshot ?? null,
						changed_fields: audit.changed_fields ?? null,
						omitSnapshotFields: OMIT_AUDIT_NEIGHBOR_FIELDS,
					});
					return (
						<TableRow key={audit.id}>
							<TableCell>{formatDateTime(audit.created_at)}</TableCell>
							<TableCell>
								<div>{audit.event_type}</div>
								<div className="user-detail-muted">{audit.actor_type}</div>
								{audit.reason_text || audit.reason_code ? (
									<div
										className="user-detail-audit-note"
										title={audit.reason_text ?? audit.reason_code ?? undefined}
									>
										{audit.reason_text || audit.reason_code}
									</div>
								) : null}
							</TableCell>
							<TableCell className="user-detail-mono">
								{audit.source || '—'}
								{audit.correlation_id ? (
									<div
										className="user-detail-muted"
										title={audit.correlation_id}
									>
										corr {shortId(audit.correlation_id)}
									</div>
								) : audit.request_log_id ? (
									<div
										className="user-detail-muted"
										title={audit.request_log_id}
									>
										req {shortId(audit.request_log_id)}
									</div>
								) : null}
							</TableCell>
							<TableCell className="user-detail-money">
								{formatGatewayMoneyCodeSigned(
									audit.delta_spent,
									currency,
									GATEWAY_MONEY_DECIMAL_PLACES
								)}
							</TableCell>
							<TableCell className="user-detail-money">
								{audit.before_budget_max !== null
									? formatGatewayMoneyCode(audit.before_budget_max, currency, 2)
									: '—'}{' '}
								→{' '}
								{audit.after_budget_max !== null
									? formatGatewayMoneyCode(audit.after_budget_max, currency, 2)
									: '—'}
							</TableCell>
							<TableCell className="user-detail-audit-diff">
								{lines.length ? (
									<>
										{lines.slice(0, 5).map((line, index) => (
											<div
												key={index}
												className="user-detail-audit-note user-detail-mono"
												title={line}
											>
												{line}
											</div>
										))}
										{lines.length > 5 ? (
											<div className="user-detail-muted">
												{t('detailSections.moreCount', {
													count: lines.length - 5,
												})}
											</div>
										) : null}
									</>
								) : (
									'—'
								)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
});

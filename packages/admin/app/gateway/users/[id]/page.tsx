'use client';
import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
	ControlButton,
	Dialog,
	EmptyState,
	ErrorState,
	Field,
	Input,
	PageHeader,
	Spinner,
	Textarea,
} from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { CopyControl } from '@/components/GatewayCopyControl';
import { summarizeMetadata } from '@/lib/summarize-metadata';
import {
	maskKey,
	RecentAuditsTable,
	RecentLogsTable,
	UserKeysTable,
} from './detail-tables';
import { ProfileEditor } from './profile-editor';
import {
	useUserDetailState,
	type ReadState,
	type WriteKind,
} from './use-user-detail-state';
import './user-detail.css';

function ReadSection<T>({
	state,
	title,
	reload,
	disabled,
	children,
}: {
	state: ReadState<T>;
	title: string;
	reload: () => Promise<unknown>;
	disabled: boolean;
	children: (value: T) => ReactNode;
}) {
	const common = useTranslations('common'),
		shell = useTranslations('shell');
	if (state.status === 'loading') return <Spinner label={common('loading')} />;
	if (state.status === 'error')
		return (
			<ShellError
				title={title}
				failure={state.failure}
				action={
					<ControlButton
						variant="outline"
						disabled={disabled}
						onClick={() => void reload()}
					>
						{shell('retry')}
					</ControlButton>
				}
			/>
		);
	return children(state.value);
}
export default function GatewayUserDetailPage() {
	const t = useTranslations('users'),
		params = useParams();
	const raw = typeof params.id === 'string' ? params.id : '';
	let userId: string;
	try {
		userId = decodeURIComponent(raw);
	} catch {
		return (
			<div className="user-detail-page">
				<ErrorState title={t('invalidUserId')} />
			</div>
		);
	}
	if (!userId)
		return (
			<div className="user-detail-page">
				<ErrorState title={t('invalidUserId')} />
			</div>
		);
	return <UserDetailContent key={userId} userId={userId} />;
}
function UserDetailContent({ userId }: { userId: string }) {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		shell = useTranslations('shell'),
		detail = useTranslations('users.detailFeedback'),
		keyTexts = useTranslations('keys');
	const { returnFocus, metadataReturnFocus, attachHeaderFocus, ...state } =
		useUserDetailState(userId);
	const user =
		state.profile.state.status === 'ready' ? state.profile.state.value : null;
	const actionTitle = (kind: WriteKind) =>
		kind === 'createKey'
			? t('errors.createFailed')
			: kind === 'deleteKey' || kind === 'deleteUser'
			? t('errors.deleteFailed')
			: t('errors.updateFailed');
	const action =
		state.action.status === 'failure' ? (
			<ShellError
				title={actionTitle(state.action.kind)}
				failure={state.action.failure}
				uncertainWrite={state.action.uncertain}
				action={
					state.action.uncertain ? (
						<ControlButton
							variant="outline"
							onClick={() => void state.reconcile()}
						>
							{shell('retry')}
						</ControlButton>
					) : undefined
				}
			/>
		) : state.action.status === 'read-required' ? (
			<ErrorState
				title={detail('readRequired')}
				description={detail('readRequiredHint')}
				action={
					<ControlButton
						variant="outline"
						onClick={() => void state.reconcile()}
					>
						{shell('retry')}
					</ControlButton>
				}
			/>
		) : null;
	const metadata = state.metadata.key
		? summarizeMetadata(state.metadata.key.metadata)
		: null;
	return (
		<div className="user-detail-page">
			<div
				ref={attachHeaderFocus}
				tabIndex={-1}
				className="user-detail-heading"
			>
				<Link href="/gateway/users" className="user-detail-link">
					{t('backUsers')}
				</Link>
				<PageHeader
					title={t('detailTitle')}
					description={
						user ? (
							<>
								<span>{user.email}</span>
								<code className="user-detail-id">{user.id}</code>
							</>
						) : undefined
					}
				/>
			</div>
			{!state.keyDialog && !state.deleteTarget ? action : null}
			<ReadSection
				state={state.currency.state}
				title={detail('currencyFailed')}
				reload={state.currency.load}
				disabled={state.locked}
			>
				{(currency) => (
					<ReadSection
						state={state.profile.state}
						title={detail('userFailed')}
						reload={state.profile.load}
						disabled={state.locked}
					>
						{(current) => (
							<>
								<div className="user-detail-grid">
									<section
										className="user-detail-card"
										aria-labelledby="user-profile-title"
									>
										<h2 id="user-profile-title">{t('userDetail')}</h2>
										{state.planError ? (
											<ErrorState
												title={t('errors.updateFailed')}
												description={state.planError}
											/>
										) : null}
										{state.form ? (
											<ProfileEditor
												user={current}
												currency={currency}
												form={state.form}
												setForm={state.setForm}
												locked={state.locked}
												saving={
													state.action.status === 'busy' &&
													state.action.kind === 'plan'
												}
												onSave={state.savePlan}
												onDelete={() => state.askDelete()}
											/>
										) : null}
									</section>
									<section
										className="user-detail-card"
										aria-labelledby="user-keys-title"
									>
										<div className="user-detail-section-header">
											<h2 id="user-keys-title">{t('apiKeys')}</h2>
											<ControlButton
												disabled={
													state.locked || state.keys.state.status !== 'ready'
												}
												onClick={state.openNewKey}
											>
												<PlusIcon className="h-4 w-4" aria-hidden />
												{t('newKey')}
											</ControlButton>
										</div>
										{state.freshKey ? (
											<div className="user-detail-secret" role="status">
												<div className="user-detail-section-header">
													<p>{keyTexts('secretBanner')}</p>
													<ControlButton
														variant="ghost"
														size="sm"
														onClick={state.dismissFreshKey}
													>
														{common('dismiss')}
													</ControlButton>
												</div>
												<div className="user-detail-key-value">
													<code>{state.freshKey}</code>
													<CopyControl
														key={state.freshKey}
														value={state.freshKey}
														label={detail('copyNewKey')}
													/>
												</div>
											</div>
										) : null}
										<ReadSection
											state={state.keys.state}
											title={detail('keysFailed')}
											reload={state.keys.load}
											disabled={state.locked}
										>
											{(keys) =>
												keys.length ? (
													<UserKeysTable
														keys={keys}
														locked={state.locked}
														onToggle={state.toggleKey}
														onDelete={state.askDelete}
														onMetadata={state.openMetadata}
													/>
												) : (
													<EmptyState title={t('keysTable.noKeys')} />
												)
											}
										</ReadSection>
									</section>
								</div>
								<section
									className="user-detail-card"
									aria-labelledby="user-logs-title"
								>
									<div className="user-detail-section-header">
										<h2 id="user-logs-title">
											{t('detailSections.recentRequestLogs')}
										</h2>
										<Link
											className="user-detail-link"
											href={
												'/gateway/request-logs?user_email=' +
												encodeURIComponent(current.email)
											}
										>
											{common('more')}
										</Link>
									</div>
									<ReadSection
										state={state.logs.state}
										title={detail('logsFailed')}
										reload={state.logs.load}
										disabled={state.locked}
									>
										{(logs) =>
											logs.length ? (
												<RecentLogsTable logs={logs} currency={currency} />
											) : (
												<EmptyState title={t('empty.requestLogs')} />
											)
										}
									</ReadSection>
								</section>
								<section
									className="user-detail-card"
									aria-labelledby="user-audits-title"
								>
									<div className="user-detail-section-header">
										<h2 id="user-audits-title">
											{t('detailSections.userAuditLogs')}
										</h2>
										<Link
											className="user-detail-link"
											href={
												'/gateway/audit-logs?user_id=' +
												encodeURIComponent(current.id)
											}
										>
											{common('more')}
										</Link>
									</div>
									<ReadSection
										state={state.audits.state}
										title={detail('auditsFailed')}
										reload={state.audits.load}
										disabled={state.locked}
									>
										{(audits) =>
											audits.length ? (
												<RecentAuditsTable
													audits={audits}
													currency={currency}
												/>
											) : (
												<EmptyState title={t('empty.auditLogs')} />
											)
										}
									</ReadSection>
								</section>
							</>
						)}
					</ReadSection>
				)}
			</ReadSection>
			<Dialog
				open={state.keyDialog}
				onOpenChange={(open) => {
					if (!open) state.closeNewKey();
				}}
				title={t('detailSections.newApiKey')}
				className="user-detail-dialog"
				preventOutsideDismissal={state.locked}
				finalFocus={returnFocus}
				footer={
					<>
						<ControlButton
							variant="outline"
							disabled={state.locked}
							onClick={state.closeNewKey}
						>
							{common('cancel')}
						</ControlButton>
						<ControlButton
							type="submit"
							form="user-detail-new-key"
							disabled={state.locked}
						>
							{state.action.status === 'busy'
								? common('saving')
								: common('create')}
						</ControlButton>
					</>
				}
			>
				<form
					id="user-detail-new-key"
					onSubmit={(event) => {
						event.preventDefault();
						void state.createKey();
					}}
					className="user-detail-form"
				>
					{state.action.status !== 'idle' && state.action.kind === 'createKey'
						? action
						: null}
					{state.keyError ? (
						<ErrorState
							title={t('errors.createFailed')}
							description={state.keyError}
						/>
					) : null}
					<fieldset disabled={state.locked} className="user-detail-fields">
						<Field label={t('fields.name')}>
							{(props) => (
								<Input
									{...props}
									value={state.keyDraft.name}
									onChange={(event) =>
										state.setKeyDraft((prev) => ({
											...prev,
											name: event.target.value,
										}))
									}
								/>
							)}
						</Field>
						<Field label={t('fields.metadataJson')}>
							{(props) => (
								<Textarea
									{...props}
									rows={5}
									className="user-detail-mono"
									value={state.keyDraft.metadata}
									onChange={(event) =>
										state.setKeyDraft((prev) => ({
											...prev,
											metadata: event.target.value,
										}))
									}
								/>
							)}
						</Field>
					</fieldset>
				</form>
			</Dialog>
			<Dialog
				open={!!state.deleteTarget}
				onOpenChange={(open) => {
					if (!open) state.closeDelete();
				}}
				title={
					state.deleteTarget?.kind === 'deleteUser'
						? t('deleteUser')
						: common('delete')
				}
				description={
					state.deleteTarget?.kind === 'deleteUser'
						? t('confirm.deleteUser')
						: t('confirm.deleteKey')
				}
				className="user-detail-dialog"
				preventOutsideDismissal={state.locked}
				finalFocus={returnFocus}
				footer={
					<>
						<ControlButton
							variant="outline"
							disabled={state.locked}
							onClick={state.closeDelete}
						>
							{common('cancel')}
						</ControlButton>
						<ControlButton
							variant="danger"
							disabled={state.locked}
							onClick={() => void state.confirmDelete()}
						>
							{state.action.status === 'busy'
								? common('deleting')
								: common('delete')}
						</ControlButton>
					</>
				}
			>
				{state.deleteTarget?.kind === 'deleteKey' ? (
					<p className="user-detail-id">
						{state.deleteTarget.key.name || maskKey(state.deleteTarget.key.key)}{' '}
						· {state.deleteTarget.key.id}
					</p>
				) : null}
				{state.action.status !== 'idle' &&
				(state.action.kind === 'deleteKey' ||
					state.action.kind === 'deleteUser')
					? action
					: null}
			</Dialog>
			{state.metadata.mounted ? (
				<Dialog
					open={!!state.metadata.key}
					onOpenChange={(open) => {
						if (!open) state.closeMetadata();
					}}
					title={t('detailSections.keyMetadata')}
					description={
						state.metadata.key
							? `${
									state.metadata.key.name || maskKey(state.metadata.key.key)
							  } · ${state.metadata.key.id}`
							: undefined
					}
					finalFocus={metadataReturnFocus}
					className="user-detail-metadata-dialog"
					footer={
						<>
							{metadata && !metadata.empty ? (
								<CopyControl value={metadata.full} label={common('copy')} />
							) : null}
							<ControlButton variant="outline" onClick={state.closeMetadata}>
								{common('close')}
							</ControlButton>
						</>
					}
				>
					{metadata?.empty ? (
						<p>{t('metadata.none')}</p>
					) : metadata ? (
						<>
							{!metadata.ok ? (
								<ErrorState
									title={common('invalidJson')}
									description={t('metadata.invalidRaw')}
								/>
							) : null}
							<pre className="user-detail-metadata-full">{metadata.full}</pre>
						</>
					) : null}
				</Dialog>
			) : null}
		</div>
	);
}

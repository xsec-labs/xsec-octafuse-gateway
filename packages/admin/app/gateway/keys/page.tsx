'use client';
import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
	Badge,
	ControlButton,
	Dialog,
	EmptyState,
	ErrorState,
	Field,
	Input,
	PageHeader,
	RadioGroup,
	Spinner,
	Switch,
	Textarea,
} from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { formatGatewayDateTime } from '@/lib/datetime';
import { formatGatewayMoneyCode } from '@/lib/format-gateway-currency';
import { KeyTable } from './key-table';
import { CopyControl } from '@/components/GatewayCopyControl';
import { useBillingCurrency } from '@/lib/use-billing-currency';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import { useKeysPageState, type KeyCreationMode } from './use-keys-page-state';
import './keys.css';

function ReadonlyRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="key-readonly">
			<span>{label}</span>
			<div>{children}</div>
		</div>
	);
}

export default function GatewayKeysPage() {
	const t = useTranslations('keysPage'),
		common = useTranslations('common'),
		options = useTranslations('options'),
		shell = useTranslations('shell'),
		secretCopy = useTranslations('keys'),
		sidebar = useTranslations('sidebar.nav');
	const { returnFocus, deleteReturnFocus, attachHeaderFocus, ...state } =
		useKeysPageState();
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
	const editorBusy = state.busy || state.uncertain;
	const selected = state.selectedKey,
		totalPages = Math.ceil(state.total / 20);
	const feedback = state.actionFailure ? (
		<ShellError
			title={state.actionFailure.title}
			failure={state.actionFailure.failure}
			uncertainWrite={state.actionFailure.uncertain}
			action={
				state.uncertain ? (
					<ControlButton
						variant="outline"
						disabled={state.busy}
						onClick={() => void state.reloadAfterUncertainWrite()}
					>
						{shell('retry')}
					</ControlButton>
				) : undefined
			}
		/>
	) : null;
	const modeOptions = [
		{ value: 'existingUser', label: t('create.existingUser') },
		{ value: 'externalIdentity', label: t('create.externalIdentity') },
	];
	return (
		<div className="key-page">
			<div ref={attachHeaderFocus} tabIndex={-1}>
				<PageHeader
					title={t('title')}
					description={t('subtitle')}
					actions={
						<ControlButton
							disabled={state.isLoading || !!state.readFailure || editorBusy}
							onClick={() => state.open()}
						>
							<PlusIcon className="h-4 w-4" aria-hidden />
							{t('newKey')}
						</ControlButton>
					}
				/>
			</div>
			{state.freshKey ? (
				<section
					className="key-secret-banner"
					aria-label={secretCopy('secretBanner')}
				>
					<div className="key-toolbar">
						<p>{secretCopy('secretBanner')}</p>
						<ControlButton
							variant="ghost"
							size="sm"
							onClick={state.dismissFreshKey}
						>
							{common('dismiss')}
						</ControlButton>
					</div>
					<div className="key-secret-row">
						<code className="key-secret">{state.freshKey}</code>
						<CopyControl value={state.freshKey} label={common('copy')} />
					</div>
				</section>
			) : null}
			<fieldset className="key-filters" disabled={state.busy}>
				<Field label={common('email')}>
					{(props) => (
						<Input
							{...props}
							type="search"
							value={state.query.email}
							placeholder={t('filters.emailPlaceholder')}
							onChange={(event) =>
								state.setQuery((prev) => ({
									...prev,
									page: 1,
									email: event.target.value,
								}))
							}
						/>
					)}
				</Field>
				<Field label={t('fields.userId')}>
					{(props) => (
						<Input
							{...props}
							type="search"
							className="key-mono"
							value={state.query.userId}
							placeholder={t('filters.userIdPlaceholder')}
							onChange={(event) =>
								state.setQuery((prev) => ({
									...prev,
									page: 1,
									userId: event.target.value,
								}))
							}
						/>
					)}
				</Field>
				<ControlButton
					variant="outline"
					disabled={state.busy || (!state.query.email && !state.query.userId)}
					onClick={() =>
						state.setQuery((prev) => ({
							...prev,
							page: 1,
							email: '',
							userId: '',
						}))
					}
				>
					{common('clearFilters')}
				</ControlButton>
			</fieldset>
			{!state.editor ? feedback : null}
			{state.isLoading ? (
				<Spinner label={common('loading')} />
			) : state.readFailure ? (
				<ShellError
					title={common('failedToLoadApiKeys')}
					failure={state.readFailure}
					action={
						<ControlButton
							variant="outline"
							onClick={() => void state.refresh()}
						>
							{shell('retry')}
						</ControlButton>
					}
				/>
			) : (
				<>
					<div className="key-table-heading">
						<span>{t('totalKeys', { count: state.total })}</span>
						<Badge tone="success">{options('keyStatus.active')}</Badge>
						<Badge>{options('keyStatus.revoked')}</Badge>
					</div>
					{state.keys.length ? (
						<KeyTable
							keys={state.keys}
							order={state.query.order}
							disabled={editorBusy}
							onEdit={state.open}
							onSort={state.toggleSort}
						/>
					) : (
						<EmptyState title={t('empty')} />
					)}
					{totalPages > 1 ? (
						<nav
							className="key-pagination"
							aria-label={t('feedback.pagination')}
						>
							<ControlButton
								variant="outline"
								disabled={state.query.page <= 1 || editorBusy}
								onClick={() =>
									state.setQuery((prev) => ({ ...prev, page: prev.page - 1 }))
								}
							>
								{common('previous')}
							</ControlButton>
							<span>
								{common('pageOf', { page: state.query.page, totalPages })}
							</span>
							<ControlButton
								variant="outline"
								disabled={state.query.page >= totalPages || editorBusy}
								onClick={() =>
									state.setQuery((prev) => ({ ...prev, page: prev.page + 1 }))
								}
							>
								{common('next')}
							</ControlButton>
						</nav>
					) : null}
				</>
			)}
			{state.editor ? (
				<Dialog
					open
					onOpenChange={(open) => {
						if (!open) state.close();
					}}
					title={state.editor === 'create' ? t('createTitle') : t('editTitle')}
					description={selected?.id}
					finalFocus={returnFocus}
					preventOutsideDismissal={state.busy || state.showDelete}
					className="key-dialog"
					footer={
						<>
							{selected ? (
								<ControlButton
									variant="danger"
									disabled={editorBusy}
									onClick={state.openDelete}
								>
									{t('deleteKey')}
								</ControlButton>
							) : null}
							<span className="key-spacer" />
							<ControlButton
								variant="outline"
								disabled={state.busy}
								onClick={state.close}
							>
								{common('cancel')}
							</ControlButton>
							<ControlButton
								type="submit"
								form="key-editor-form"
								disabled={editorBusy}
								loading={state.operation === 'save'}
							>
								{state.editor === 'create' ? common('create') : common('save')}
							</ControlButton>
						</>
					}
				>
					{!state.showDelete ? feedback : null}
					{state.saveError ? <ErrorState title={state.saveError} /> : null}
					<form
						id="key-editor-form"
						onSubmit={(event) => {
							event.preventDefault();
							void state.save();
						}}
					>
						<fieldset className="key-editor-fields" disabled={editorBusy}>
							{state.editor === 'create' ? (
								<>
									<fieldset className="key-mode">
										<legend>{t('create.attachLegend')}</legend>
										<RadioGroup
											value={state.creationMode}
											onValueChange={(value) =>
												state.changeMode(value as KeyCreationMode)
											}
											options={modeOptions}
										/>
									</fieldset>
									<div className="key-help">
										<h3>{t('create.afterCreation')}</h3>
										<p>
											{state.creationMode === 'existingUser'
												? t('create.existingHelp1')
												: t('create.externalHelp1')}
										</p>
										<p>
											{state.creationMode === 'existingUser'
												? t('create.existingHelp2')
												: t('create.externalHelp2')}
										</p>
										<Link href="/gateway/users">{sidebar('users')}</Link>
										<p>{t('create.secretOnce')}</p>
										<p>{t('create.metadataHelp')}</p>
									</div>
									{state.creationMode === 'existingUser' ? (
										<Field label={t('fields.userId') + ' *'}>
											{(props) => (
												<Input
													{...props}
													value={state.form.user_id}
													required
													placeholder={t('placeholders.userId')}
													onChange={(event) =>
														state.setForm((prev) => ({
															...prev,
															user_id: event.target.value,
														}))
													}
												/>
											)}
										</Field>
									) : (
										<>
											<div className="key-grid">
												<Field label={t('fields.externalSystem') + ' *'}>
													{(props) => (
														<Input
															{...props}
															required
															value={state.form.external_system}
															placeholder={t('placeholders.externalSystem')}
															onChange={(event) =>
																state.setForm((prev) => ({
																	...prev,
																	external_system: event.target.value,
																}))
															}
														/>
													)}
												</Field>
												<Field label={t('fields.externalUserId') + ' *'}>
													{(props) => (
														<Input
															{...props}
															required
															value={state.form.external_user_id}
															placeholder={t('placeholders.externalUserId')}
															onChange={(event) =>
																state.setForm((prev) => ({
																	...prev,
																	external_user_id: event.target.value,
																}))
															}
														/>
													)}
												</Field>
											</div>
											<Field
												label={t('fields.userEmail') + ' *'}
												hint={t('help.userEmail')}
											>
												{(props) => (
													<Input
														{...props}
														type="email"
														required
														value={state.form.email}
														placeholder={t('placeholders.userEmail')}
														onChange={(event) =>
															state.setForm((prev) => ({
																...prev,
																email: event.target.value,
															}))
														}
													/>
												)}
											</Field>
										</>
									)}
								</>
							) : selected ? (
								<>
									<div className="key-grid">
										<ReadonlyRow label={t('fields.secretKey')}>
											<div className="key-secret-row">
												<code className="key-secret">{selected.key}</code>
												<CopyControl
													value={selected.key}
													label={t('copySecret')}
												/>
											</div>
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.status')}>
											<Switch
												checked={selected.status === 'active'}
												label={statusLabel(selected.status)}
												onCheckedChange={() => void state.toggleStatus()}
												disabled={editorBusy}
											/>
										</ReadonlyRow>
										<ReadonlyRow label={t('feedback.keyId')}>
											<span className="key-mono">{selected.id}</span>
											<CopyControl value={selected.id} label={t('copyId')} />
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.userIdAuth')}>
											<Link
												href={
													'/gateway/users/' +
													encodeURIComponent(selected.user_id)
												}
												className="key-mono"
											>
												{selected.user_id}
											</Link>
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.userEmail')}>
											{selected.user_email || '—'}
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.budgetReadonly')}>
											{budget(selected)}
											{selected.budget_base != null ? (
												<small>
													{t('feedback.budgetBase', {
														amount: money(selected.budget_base),
													})}
												</small>
											) : null}
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.budgetPeriodReset')}>
											{selected.budget_period} /{' '}
											{timestamp(selected.budget_reset_at)}
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.created')}>
											{timestamp(selected.created_at)}
										</ReadonlyRow>
										<ReadonlyRow label={t('fields.updated')}>
											{timestamp(selected.updated_at)}
										</ReadonlyRow>
									</div>
									<Link
										href={
											'/gateway/request-logs?api_key_id=' +
											encodeURIComponent(selected.id)
										}
									>
										{t('links.requestLogsForKey')}
									</Link>
								</>
							) : null}
							<Field
								label={
									state.editor === 'create'
										? t('fields.keyName')
										: t('fields.name')
								}
							>
								{(props) => (
									<Input
										{...props}
										value={state.form.name}
										placeholder={t('placeholders.optionalLabel')}
										onChange={(event) =>
											state.setForm((prev) => ({
												...prev,
												name: event.target.value,
											}))
										}
									/>
								)}
							</Field>
							<Field
								label={t('fields.metadataJson')}
								hint={
									state.editor === 'create'
										? t('help.metadata')
										: t('help.editMetadata')
								}
							>
								{(props) => (
									<Textarea
										{...props}
										className="key-mono"
										value={state.form.metadata}
										rows={6}
										placeholder={t('placeholders.metadataJson')}
										onChange={(event) =>
											state.setForm((prev) => ({
												...prev,
												metadata: event.target.value,
											}))
										}
									/>
								)}
							</Field>
						</fieldset>
					</form>
					{state.showDelete ? (
						<Dialog
							open
							title={t('confirmDelete')}
							description={selected?.name || selected?.id}
							onOpenChange={(open) => {
								if (!open) state.closeDelete();
							}}
							finalFocus={deleteReturnFocus}
							preventOutsideDismissal={state.busy}
							className="key-dialog"
							footer={
								<>
									<ControlButton
										variant="outline"
										disabled={state.busy}
										onClick={state.closeDelete}
									>
										{common('cancel')}
									</ControlButton>
									<ControlButton
										variant="danger"
										loading={state.operation === 'delete'}
										disabled={editorBusy}
										onClick={() => void state.remove()}
									>
										{common('delete')}
									</ControlButton>
								</>
							}
						>
							{feedback}
							<p>{t('feedback.deleteWarning')}</p>
						</Dialog>
					) : null}
				</Dialog>
			) : null}
		</div>
	);
}

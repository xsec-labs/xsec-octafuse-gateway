'use client';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
	ControlButton,
	Dialog,
	EmptyState,
	ErrorState,
	Field,
	Input,
	PageHeader,
	Select,
	Spinner,
	Textarea,
} from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { summarizeMetadata } from '@/lib/summarize-metadata';
import { useUsersPageState } from './use-users-page-state';
import { UserTable } from './user-table';
import './users.css';
export default function GatewayUsersPage() {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		options = useTranslations('options'),
		shell = useTranslations('shell');
	const { returnFocus, metadataReturnFocus, attachHeaderFocus, ...state } =
		useUsersPageState();
	const locked = state.busy || state.uncertain,
		totalPages = Math.ceil(state.total / 20);
	const feedback = state.actionFailure ? (
		<ShellError
			title={common('createFailed')}
			failure={state.actionFailure.failure}
			uncertainWrite={state.uncertain}
			action={
				state.uncertain ? (
					<ControlButton
						variant="outline"
						disabled={state.busy || state.isLoading}
						onClick={() => void state.reloadAfterUncertainWrite()}
					>
						{shell('retry')}
					</ControlButton>
				) : undefined
			}
		/>
	) : null;
	const meta = state.metadataUser
		? summarizeMetadata(state.metadataUser.metadata)
		: null;
	return (
		<div className="user-page">
			<div ref={attachHeaderFocus} tabIndex={-1}>
				<PageHeader
					title={t('title')}
					description={t('subtitle')}
					actions={
						<ControlButton
							disabled={locked || state.isLoading || !!state.readFailure}
							onClick={state.openCreate}
						>
							<PlusIcon className="h-4 w-4" aria-hidden />
							{t('newUser')}
						</ControlButton>
					}
				/>
			</div>
			<div className="user-filters">
				{(['email', 'externalSystem', 'externalUserId'] as const).map(
					(field) => (
						<Field key={field} label={t('filters.' + field)}>
							{(props) => (
								<Input
									{...props}
									disabled={locked}
									value={state.query[field]}
									placeholder={t('filters.contains')}
									onChange={(event) =>
										state.setQuery((prev) => ({
											...prev,
											[field]: event.target.value,
											page: 1,
										}))
									}
								/>
							)}
						</Field>
					)
				)}
				<Field label={t('filters.status')}>
					{(props) => (
						<Select
							{...props}
							disabled={locked}
							value={state.query.status}
							onValueChange={(status) =>
								state.setQuery((prev) => ({
									...prev,
									status: status ?? '',
									page: 1,
								}))
							}
							options={[
								{ value: '', label: common('all') },
								{ value: 'active', label: options('userStatus.active') },
								{ value: 'disabled', label: options('userStatus.disabled') },
							]}
						/>
					)}
				</Field>
				<ControlButton
					variant="outline"
					disabled={locked}
					onClick={() =>
						state.setQuery((prev) => ({
							...prev,
							email: '',
							externalSystem: '',
							externalUserId: '',
							status: '',
							page: 1,
						}))
					}
				>
					{common('clearFilters')}
				</ControlButton>
			</div>
			{!state.showCreate ? feedback : null}
			{state.readFailure ? (
				<ShellError
					title={common('failedToLoadUsers')}
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
			) : state.isLoading ? (
				<Spinner label={common('loading')} />
			) : (
				<>
					<div className="user-table-heading">
						{t('totalUsers', { count: state.total })}
					</div>
					{state.users.length ? (
						<UserTable
							users={state.users}
							sort={state.query.sort}
							order={state.query.order}
							disabled={locked}
							onSort={state.toggleSort}
							onMetadata={state.openMetadata}
						/>
					) : (
						<EmptyState title={t('emptyFiltered')} />
					)}
					{totalPages > 1 ? (
						<nav
							className="user-pagination"
							aria-label={t('feedback.pagination')}
						>
							<ControlButton
								variant="outline"
								disabled={locked || state.query.page === 1}
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
								disabled={locked || state.query.page >= totalPages}
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
			<Dialog
				open={state.showCreate}
				onOpenChange={(open) => {
					if (!open) state.closeCreate();
				}}
				title={t('createTitle')}
				description={t('help.createUser')}
				preventOutsideDismissal={locked}
				finalFocus={returnFocus}
				className="user-dialog"
				footer={
					<>
						<ControlButton
							variant="outline"
							disabled={locked}
							onClick={state.closeCreate}
						>
							{common('cancel')}
						</ControlButton>
						<ControlButton type="submit" form="user-create" disabled={locked}>
							{state.busy ? common('saving') : common('create')}
						</ControlButton>
					</>
				}
			>
				<form
					id="user-create"
					onSubmit={(event) => {
						event.preventDefault();
						void state.save();
					}}
				>
					{feedback}
					{state.saveError ? (
						<ErrorState
							title={common('createFailed')}
							description={state.saveError}
						/>
					) : null}
					<fieldset className="user-editor-fields" disabled={locked}>
						<Field
							label={
								<>
									{t('fields.email')} <span aria-hidden>*</span>
								</>
							}
						>
							{(props) => (
								<Input
									{...props}
									type="email"
									required
									autoComplete="email"
									value={state.form.email}
									placeholder="user@example.com"
									onChange={(event) =>
										state.setForm((prev) => ({
											...prev,
											email: event.target.value,
										}))
									}
								/>
							)}
						</Field>
						<div className="user-budget-grid">
							{(['budget_max', 'budget_base'] as const).map((field) => (
								<Field
									key={field}
									label={t(
										field === 'budget_max'
											? 'fields.budgetMax'
											: 'fields.budgetBase'
									)}
									hint={t(
										field === 'budget_max'
											? 'help.budgetMax'
											: 'help.budgetBase'
									)}
								>
									{(props) => (
										<Input
											{...props}
											type="number"
											step="any"
											value={state.form[field]}
											placeholder={
												field === 'budget_max'
													? common('noLimit')
													: common('optional')
											}
											onChange={(event) =>
												state.setForm((prev) => ({
													...prev,
													[field]: event.target.value,
												}))
											}
										/>
									)}
								</Field>
							))}
							<Field
								label={t('fields.budgetPeriod')}
								hint={t('help.budgetPeriod')}
							>
								{(props) => (
									<Select
										{...props}
										disabled={locked}
										value={state.form.budget_period}
										onValueChange={(value) => {
											if (value !== null)
												state.setForm((prev) => ({
													...prev,
													budget_period: value,
												}));
										}}
										options={['none', 'daily', 'weekly', 'monthly'].map(
											(value) => ({
												value,
												label: options('budgetPeriod.' + value),
											})
										)}
									/>
								)}
							</Field>
						</div>
						<Field label={t('fields.metadataJsonObject')}>
							{(props) => (
								<Textarea
									{...props}
									rows={4}
									className="user-mono"
									value={state.form.metadata}
									placeholder="{}"
									onChange={(event) =>
										state.setForm((prev) => ({
											...prev,
											metadata: event.target.value,
										}))
									}
								/>
							)}
						</Field>
						<section className="user-external">
							<h3>{t('externalIdentity.title')}</h3>
							<p>{t('externalIdentity.createHint')}</p>
							<div className="user-external-grid">
								{(['external_system', 'external_user_id'] as const).map(
									(field) => (
										<Field
											key={field}
											label={t(
												field === 'external_system'
													? 'fields.externalSystem'
													: 'fields.externalUserId'
											)}
										>
											{(props) => (
												<Input
													{...props}
													value={state.form[field]}
													onChange={(event) =>
														state.setForm((prev) => ({
															...prev,
															[field]: event.target.value,
														}))
													}
												/>
											)}
										</Field>
									)
								)}
							</div>
						</section>
					</fieldset>
				</form>
			</Dialog>
			{state.metadataMounted ? (
				<Dialog
					open={!!state.metadataUser}
					onOpenChange={(open) => {
						if (!open) state.closeMetadata();
					}}
					title={common('metadata')}
					description={
						state.metadataUser
							? [state.metadataUser.email, state.metadataUser.id].join(' · ')
							: undefined
					}
					finalFocus={metadataReturnFocus}
					className="user-metadata-dialog"
					footer={
						<ControlButton variant="outline" onClick={state.closeMetadata}>
							{common('close')}
						</ControlButton>
					}
				>
					{meta?.empty ? (
						<p>{t('metadata.none')}</p>
					) : meta ? (
						<>
							{!meta.ok ? (
								<ErrorState
									title={common('invalidJson')}
									description={t('metadata.invalidRaw')}
								/>
							) : null}
							<pre className="user-metadata-full">{meta.full}</pre>
						</>
					) : null}
				</Dialog>
			) : null}
		</div>
	);
}

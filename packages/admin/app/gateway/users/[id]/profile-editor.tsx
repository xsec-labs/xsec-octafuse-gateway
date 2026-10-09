'use client';
import { useTranslations } from 'next-intl';
import { ControlButton, Field, Input, Select, Textarea } from '@xsec/ui-react';
import type { Dispatch, SetStateAction } from 'react';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import type { UserDetail } from './detail-api';
import type { ProfileDraft } from './use-user-detail-state';

export function ProfileEditor({
	user,
	currency,
	form,
	setForm,
	locked,
	saving,
	onSave,
	onDelete,
}: {
	user: UserDetail;
	currency: string;
	form: ProfileDraft;
	setForm: Dispatch<SetStateAction<ProfileDraft | null>>;
	locked: boolean;
	saving: boolean;
	onSave: () => Promise<void>;
	onDelete: () => void;
}) {
	const t = useTranslations('users'),
		common = useTranslations('common'),
		options = useTranslations('options');
	const { formatDateTime } = useGatewayDateTime();
	const update = (field: keyof ProfileDraft, value: string) =>
		setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
	const statusOptions = ['active', 'disabled'].map((value) => ({
		value,
		label: options('userStatus.' + value),
	}));
	if (!statusOptions.some((option) => option.value === form.status))
		statusOptions.push({ value: form.status, label: form.status });
	const periods = ['none', 'daily', 'weekly', 'monthly'].map((value) => ({
		value,
		label: options('budgetPeriod.' + value),
	}));
	if (!periods.some((option) => option.value === form.budget_period))
		periods.push({ value: form.budget_period, label: form.budget_period });
	return (
		<form
			className="user-detail-form"
			onSubmit={(event) => {
				event.preventDefault();
				void onSave();
			}}
		>
			<fieldset disabled={locked} className="user-detail-fields">
				<div className="user-detail-pair">
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
								required
								type="email"
								autoComplete="email"
								value={form.email}
								placeholder="user@example.com"
								onChange={(event) => update('email', event.target.value)}
							/>
						)}
					</Field>
					<Field label={t('fields.status')} hint={t('help.disabledUser')}>
						{(props) => (
							<Select
								{...props}
								disabled={locked}
								value={form.status}
								options={statusOptions}
								onValueChange={(value) => {
									if (value !== null) update('status', value);
								}}
							/>
						)}
					</Field>
				</div>
				<div className="user-detail-budget">
					{(['budget_max', 'budget_base', 'budget_spent'] as const).map(
						(field) => {
							const name = {
								budget_max: 'budgetMax',
								budget_base: 'budgetBase',
								budget_spent: 'budgetSpent',
							}[field];
							return (
								<Field
									key={field}
									label={`${t('fields.' + name)} (${currency})`}
									hint={t('help.' + name)}
								>
									{(props) => (
										<Input
											{...props}
											type="number"
											step="any"
											value={form[field]}
											placeholder={
												field === 'budget_max'
													? common('noLimit')
													: field === 'budget_base'
													? common('optional')
													: undefined
											}
											onChange={(event) => update(field, event.target.value)}
										/>
									)}
								</Field>
							);
						}
					)}
				</div>
				<div className="user-detail-pair">
					<Field label={t('fields.budgetPeriod')} hint={t('help.budgetPeriod')}>
						{(props) => (
							<Select
								{...props}
								disabled={locked}
								value={form.budget_period}
								options={periods}
								onValueChange={(value) => {
									if (value !== null) update('budget_period', value);
								}}
							/>
						)}
					</Field>
					<Field
						label={t('fields.budgetResetAt')}
						hint={t('help.budgetResetAt')}
					>
						{(props) => (
							<Input
								{...props}
								type="datetime-local"
								step={1}
								value={form.budget_reset_at}
								onChange={(event) =>
									update('budget_reset_at', event.target.value)
								}
							/>
						)}
					</Field>
				</div>
				<Field
					label={t('fields.metadataJson')}
					hint={t('help.metadataReplace')}
				>
					{(props) => (
						<Textarea
							{...props}
							className="user-detail-mono"
							rows={5}
							value={form.metadata}
							placeholder="{}"
							onChange={(event) => update('metadata', event.target.value)}
						/>
					)}
				</Field>
				<section className="user-detail-external">
					<h3>{t('externalIdentity.title')}</h3>
					<p>{t('externalIdentity.hint')}</p>
					<div className="user-detail-pair">
						<Field label={t('fields.externalSystem')}>
							{(props) => (
								<Input
									{...props}
									value={form.external_system}
									onChange={(event) =>
										update('external_system', event.target.value)
									}
								/>
							)}
						</Field>
						<Field label={t('fields.externalUserId')}>
							{(props) => (
								<Input
									{...props}
									value={form.external_user_id}
									onChange={(event) =>
										update('external_user_id', event.target.value)
									}
								/>
							)}
						</Field>
					</div>
				</section>
				<dl className="user-detail-pair user-detail-dates">
					<div>
						<dt>{t('table.created')}</dt>
						<dd>{formatDateTime(user.created_at)}</dd>
					</div>
					<div>
						<dt>{t('table.updated')}</dt>
						<dd>{formatDateTime(user.updated_at)}</dd>
					</div>
				</dl>
			</fieldset>
			<div className="user-detail-actions">
				<ControlButton variant="danger" disabled={locked} onClick={onDelete}>
					{t('deleteUser')}
				</ControlButton>
				<ControlButton type="submit" disabled={locked}>
					{saving ? common('saving') : t('saveUser')}
				</ControlButton>
			</div>
		</form>
	);
}

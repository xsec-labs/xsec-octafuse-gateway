'use client';
import { ControlButton, Dialog, Field, Input, Textarea, Switch, ErrorState } from '@xsec/ui-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ShellError from '@/components/layout/ShellError';
import type { ShellFailure } from '@/lib/shell-request';
import { protocolFormHasOverrides } from '../provider-utils';
import type { GatewayProvider, ProviderFormData, ProtocolEndpointForm } from '../types';
type Failure = { title: string; failure: ShellFailure; uncertain: boolean };
type Props = {
	open: boolean;
	editingProvider: GatewayProvider | null;
	duplicateSourceId: string | null;
	formData: ProviderFormData;
	validation: string;
	actionFailure: Failure | null;
	busy: boolean;
	writeKind: string | null;
	showDelete: boolean;
	onShowDelete: (open: boolean) => void;
	onClose: () => void;
	onFormChange: (value: ProviderFormData) => void;
	onSave: () => void;
	onDelete: () => void;
	onDuplicate: (provider: GatewayProvider) => void;
	onRead: () => void;
	finalFocus: ComponentProps<typeof Dialog>['finalFocus'];
};
const capabilities: Record<
	'openai' | 'anthropic' | 'gemini',
	{ key: keyof ProtocolEndpointForm; label: string }[]
> = {
	openai: [
		{ key: 'chat', label: 'capChat' },
		{ key: 'images_generations', label: 'capImagesGenerations' },
		{ key: 'images_edits', label: 'capImagesEdits' },
		{ key: 'audio_transcriptions', label: 'capAudioTranscriptions' },
	],
	anthropic: [{ key: 'messages', label: 'capMessages' }],
	gemini: [
		{ key: 'generateContent', label: 'capGenerateContent' },
		{ key: 'streamGenerateContent', label: 'capStreamGenerateContent' },
	],
};
function ProtocolFields({
	protocol,
	form,
	disabled,
	onChange,
}: {
	protocol: 'openai' | 'anthropic' | 'gemini';
	form: ProtocolEndpointForm;
	disabled: boolean;
	onChange: (value: ProtocolEndpointForm) => void;
}) {
	const t = useTranslations('providers.modal'),
		label = t(protocol + 'Optional');
	const [overridesOpen, setOverridesOpen] = useState(() => protocolFormHasOverrides(protocol, form));
	return (
		<section className="provider-protocol-form">
			<h4>{label}</h4>
			<Field label={t('baseUrl')} hint={protocol === 'gemini' ? t('geminiHint') : undefined}>
				{(props) => (
					<Input
						{...props}
						value={form.base}
						disabled={disabled}
						onChange={(event) => onChange({ ...form, base: event.target.value })}
						placeholder={t(protocol + 'Placeholder')}
						autoComplete="off"
					/>
				)}
			</Field>
			<details
				open={overridesOpen}
				onToggle={(event) => setOverridesOpen(event.currentTarget.open)}
			>
				<summary>{t('advancedToggle')}</summary>
				<p className="provider-muted">{t('advancedHint')}</p>
				<div className="provider-fields">
					{capabilities[protocol].map((capability) => (
						<Field label={t(capability.label)} key={capability.key}>
							{(props) => (
								<Input
									{...props}
									value={form[capability.key]}
									disabled={disabled}
									onChange={(event) => onChange({ ...form, [capability.key]: event.target.value })}
									autoComplete="off"
								/>
							)}
						</Field>
					))}
				</div>
			</details>
		</section>
	);
}
export default function ProviderModal(props: Props) {
	const {
		open,
		editingProvider,
		duplicateSourceId,
		formData,
		validation,
		actionFailure,
		busy,
		writeKind,
		showDelete,
		onShowDelete,
		onClose,
		onFormChange,
		onSave,
		onDelete,
		onDuplicate,
		onRead,
		finalFocus,
	} = props;
	const t = useTranslations('providers.modal'),
		common = useTranslations('common'),
		feedback = useTranslations('providers.feedback');
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !busy && !showDelete) onClose();
			}}
			preventOutsideDismissal={busy}
			title={editingProvider ? t('editTitle') : t('newTitle')}
			description={
				duplicateSourceId ? t('prefilledFrom', { id: duplicateSourceId }) : t('generalHint')
			}
			className="provider-dialog"
			finalFocus={finalFocus}
			footer={
				<>
					{editingProvider ? (
						<ControlButton variant="danger" disabled={busy} onClick={() => onShowDelete(true)}>
							{t('deleteProvider')}
						</ControlButton>
					) : null}
					<span className="provider-footer-spacer" />
					<ControlButton variant="outline" disabled={busy} onClick={onClose}>
						{common('cancel')}
					</ControlButton>
					{editingProvider ? (
						<ControlButton
							variant="secondary"
							disabled={busy}
							onClick={() => onDuplicate(editingProvider)}
						>
							{common('duplicate')}
						</ControlButton>
					) : null}
					<ControlButton
						type="submit"
						form="provider-form"
						loading={writeKind === 'save'}
						disabled={busy}
					>
						{editingProvider ? common('save') : common('create')}
					</ControlButton>
				</>
			}
		>
			{actionFailure && !showDelete ? (
				<ShellError
					title={actionFailure.title}
					failure={actionFailure.failure}
					uncertainWrite={actionFailure.uncertain}
					action={
						<ControlButton variant="secondary" onClick={onRead}>
							{feedback('readList')}
						</ControlButton>
					}
				/>
			) : null}
			<form
				id="provider-form"
				className="provider-form"
				onSubmit={(event) => {
					event.preventDefault();
					onSave();
				}}
				aria-busy={busy}
			>
				{validation ? <ErrorState title={validation} /> : null}
				<section>
					<h3>{t('general')}</h3>
					<div className="provider-fields">
						{!editingProvider ? (
							<Field label={t('id')} hint={t('idHint')}>
								{(field) => (
									<Input
										{...field}
										value={formData.id}
										onChange={(event) => onFormChange({ ...formData, id: event.target.value })}
										disabled={busy}
										placeholder={t('idPlaceholder')}
										autoComplete="off"
									/>
								)}
							</Field>
						) : null}
						<Field label={t('nameRequired')}>
							{(field) => (
								<Input
									{...field}
									value={formData.name}
									onChange={(event) => onFormChange({ ...formData, name: event.target.value })}
									disabled={busy}
									placeholder={t('namePlaceholder')}
									autoComplete="off"
									required
								/>
							)}
						</Field>
						<Field
							label={editingProvider ? t('apiKeyOptional') : t('apiKeyRequired')}
							hint={editingProvider ? t('apiKeyEditHint') : t('apiKeyHint')}
						>
							{(field) => (
								<Input
									{...field}
									type="password"
									value={formData.api_key}
									onChange={(event) => onFormChange({ ...formData, api_key: event.target.value })}
									disabled={busy}
									required={!editingProvider}
									placeholder={
										editingProvider ? t('apiKeyEditPlaceholder') : t('apiKeyPlaceholder')
									}
									autoComplete="new-password"
								/>
							)}
						</Field>
						<Switch
							checked={formData.status === 'active'}
							disabled={busy}
							onCheckedChange={(checked) =>
								onFormChange({ ...formData, status: checked ? 'active' : 'disabled' })
							}
							label={
								<span>
									{t('statusEnabled')}
									<small className="provider-switch-hint">{t('statusHint')}</small>
								</span>
							}
						/>
					</div>
				</section>
				<section>
					<h3>{t('endpoints')}</h3>
					<p className="provider-muted">{t('endpointsHint')}</p>
					{(['openai', 'anthropic', 'gemini'] as const).map((protocol) => (
						<ProtocolFields
							key={protocol}
							protocol={protocol}
							form={formData[protocol]}
							disabled={busy}
							onChange={(value) => onFormChange({ ...formData, [protocol]: value })}
						/>
					))}
				</section>
				<Field label={t('description')} hint={t('descriptionHint')}>
					{(field) => (
						<Textarea
							{...field}
							rows={3}
							value={formData.description}
							disabled={busy}
							onChange={(event) => onFormChange({ ...formData, description: event.target.value })}
							placeholder={t('descriptionPlaceholder')}
							autoComplete="off"
						/>
					)}
				</Field>
			</form>
			<Dialog
				open={showDelete}
				onOpenChange={(next) => {
					if (!busy) onShowDelete(next);
				}}
				preventOutsideDismissal={busy}
				title={feedback('deleteTitle')}
				description={feedback('deleteDescription', { name: editingProvider?.name ?? '' })}
				className="provider-confirmation"
				footer={
					<>
						<ControlButton variant="outline" disabled={busy} onClick={() => onShowDelete(false)}>
							{common('cancel')}
						</ControlButton>
						<ControlButton
							variant="danger"
							loading={writeKind === 'delete'}
							disabled={busy}
							onClick={onDelete}
						>
							{t('deleteProvider')}
						</ControlButton>
					</>
				}
			>
				{showDelete && actionFailure ? (
					<ShellError
						title={actionFailure.title}
						failure={actionFailure.failure}
						uncertainWrite={actionFailure.uncertain}
						action={
							<ControlButton variant="secondary" onClick={onRead}>
								{feedback('readList')}
							</ControlButton>
						}
					/>
				) : (
					<p>{feedback('deleteHint')}</p>
				)}
			</Dialog>
		</Dialog>
	);
}

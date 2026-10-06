'use client';
import {
	ControlButton,
	Dialog,
	Field,
	Input,
	Textarea,
	Checkbox,
	RadioGroup,
	Select,
	Badge,
	Spinner,
	ErrorState,
} from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import {
	MODEL_INPUT_MODALITIES,
	MODEL_OUTPUT_MODALITIES,
} from '@octafuse/core/db/model-modalities';
import { PricingTiersEditor } from '@/components/pricing-tiers-editor';
import ShellError from '@/components/layout/ShellError';
import { MODEL_VENDOR_OPTIONS } from '@/lib/model-vendor';
import {
	createDefaultAudioTokenPricingDraft,
	type AudioPricingDraftState,
	type ImageBillingModeDraft,
	type ImagePerImageDraft,
	type PricingTierDraftRow,
} from '@/lib/pricing-tiers-draft';
import type { ModelFormData, ModelFormKind, ModelListItem } from '../types';
import type { useModelEditModal } from '../use-model-edit-modal';
import '../models.css';
type Props = {
	open: boolean;
	feedback: Pick<
		ReturnType<typeof useModelEditModal>,
		| 'editorStatus'
		| 'actionFailure'
		| 'currencyState'
		| 'loadCurrency'
		| 'returnFocus'
		| 'showDelete'
		| 'deleteReturnFocus'
		| 'setShowDelete'
	>;
	editingModel: ModelListItem | null;
	formData: ModelFormData;
	/** 当前 Kind（含 audio；由父级 formKind 驱动，避免仅靠 modalities 误判） */
	formKind: ModelFormKind;
	pricingTierRows: PricingTierDraftRow[];
	imageBillingMode?: ImageBillingModeDraft;
	onImageBillingModeChange?: (mode: ImageBillingModeDraft) => void;
	imagePerImageDraft?: ImagePerImageDraft;
	onImagePerImageDraftChange?: (draft: ImagePerImageDraft) => void;
	audioPricingDraft?: AudioPricingDraftState;
	onAudioPricingDraftChange?: (draft: AudioPricingDraftState) => void;
	tagInput: string;
	saveError: string;
	isSaving: boolean;
	isDeleting: boolean;
	billingCurrency: string;
	onClose: () => void;
	onFormChange: (form: ModelFormData) => void;
	onPricingTierRowsChange: (rows: PricingTierDraftRow[]) => void;
	onTagInputChange: (value: string) => void;
	onAddTag: () => void;
	onRemoveTag: (tag: string) => void;
	onToggleModality: (
		kind: 'input_modalities' | 'output_modalities',
		modality: string
	) => void;
	/** 切换 LLM / Image / Audio Kind（同步 modalities 与默认 pricing） */
	onKindChange: (kind: ModelFormKind) => void;
	onSave: () => void;
	onDelete: (id: string) => void;
};

export function ModelModal(props: Props) {
	const {
		open,
		editingModel,
		formData,
		formKind,
		pricingTierRows,
		imageBillingMode = 'token',
		onImageBillingModeChange,
		imagePerImageDraft,
		onImagePerImageDraftChange,
		audioPricingDraft,
		onAudioPricingDraftChange,
		tagInput,
		saveError,
		isSaving,
		isDeleting,
		billingCurrency,
		onClose,
		onFormChange,
		onPricingTierRowsChange,
		onTagInputChange,
		onAddTag,
		onRemoveTag,
		onToggleModality,
		onKindChange,
		onSave,
		onDelete,
		feedback,
	} = props;
	const t = useTranslations('models.modal'),
		common = useTranslations('common'),
		f = useTranslations('models.feedback');
	const busy = isSaving || isDeleting,
		ready =
			feedback.editorStatus === 'ready' &&
			feedback.currencyState.status === 'ready';
	function text(
		key:
			| 'id'
			| 'display_name'
			| 'released_at'
			| 'context_window'
			| 'max_tokens',
		label: string,
		type = 'text'
	) {
		return (
			<Field label={t(label)}>
				{(field) => (
					<Input
						{...field}
						type={type}
						value={formData[key]}
						onChange={(event) =>
							onFormChange({ ...formData, [key]: event.target.value })
						}
						disabled={busy || (key === 'id' && !!editingModel)}
						required={key === 'id'}
						min={type === 'number' ? 1 : undefined}
						step={type === 'number' ? 1 : undefined}
						autoComplete="off"
					/>
				)}
			</Field>
		);
	}
	function audioNumber(
		key: 'price_per_second' | 'minimum_seconds',
		label: string
	) {
		if (!audioPricingDraft || !onAudioPricingDraftChange) return null;
		return (
			<Field
				label={t(label)}
				hint={key === 'price_per_second' ? billingCurrency + '/s' : undefined}
			>
				{(field) => (
					<Input
						{...field}
						type="number"
						step="any"
						min="0"
						value={audioPricingDraft[key]}
						onChange={(event) =>
							onAudioPricingDraftChange({
								...audioPricingDraft,
								[key]: event.target.value,
							})
						}
						disabled={busy}
					/>
				)}
			</Field>
		);
	}
	if (!open) return null;
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !busy && !feedback.showDelete) onClose();
			}}
			preventOutsideDismissal={busy}
			title={editingModel ? t('editTitle') : t('newTitle')}
			description={editingModel?.id}
			className="model-dialog"
			finalFocus={feedback.returnFocus}
			footer={
				<>
					{editingModel && ready ? (
						<ControlButton
							variant="danger"
							disabled={busy}
							onClick={() => feedback.setShowDelete(true)}
						>
							{t('deleteModel')}
						</ControlButton>
					) : null}
					<span className="model-spacer" />
					<ControlButton variant="outline" onClick={onClose} disabled={busy}>
						{common('cancel')}
					</ControlButton>
					<ControlButton
						type="submit"
						form="model-form"
						disabled={busy || !ready}
						loading={isSaving}
					>
						{common('save')}
					</ControlButton>
				</>
			}
		>
			{feedback.editorStatus === 'loading' ||
			feedback.currencyState.status === 'loading' ? (
				<Spinner label={common('loading')} />
			) : null}
			{feedback.currencyState.status === 'error' ? (
				<ShellError
					title={f('currencyFailed')}
					failure={feedback.currencyState.failure}
					action={
						<ControlButton onClick={() => void feedback.loadCurrency()}>
							{f('readCurrency')}
						</ControlButton>
					}
				/>
			) : null}
			{feedback.actionFailure && !feedback.showDelete ? (
				<ShellError
					title={feedback.actionFailure.title}
					failure={feedback.actionFailure.failure}
					uncertainWrite={feedback.actionFailure.uncertain}
				/>
			) : null}
			{ready ? (
				<form
					id="model-form"
					className="model-form"
					onSubmit={(event) => {
						event.preventDefault();
						onSave();
					}}
					aria-busy={busy}
				>
					{saveError ? <ErrorState title={saveError} /> : null}
					<fieldset disabled={busy}>
						<div className="model-fields">
							<div className="model-full">
								<RadioGroup
									aria-label={t('kind')}
									value={formKind}
									options={(['llm', 'image', 'audio'] as const).map(
										(value) => ({
											value,
											label: t(
												value === 'llm'
													? 'kindLlm'
													: value === 'image'
													? 'kindImage'
													: 'kindAudio'
											),
											disabled: busy,
										})
									)}
									onValueChange={(value) => {
										if (
											value === 'llm' ||
											value === 'image' ||
											value === 'audio'
										)
											onKindChange(value);
									}}
								/>
								<p className="model-hint">
									{t(
										formKind === 'audio'
											? 'kindHintAudio'
											: formKind === 'image'
											? 'kindHintImage'
											: 'kindHintLlm'
									)}
								</p>
							</div>
							{text('id', 'modelIdRequired')}
							{text('display_name', 'displayName')}
							<Field label={t('vendor')}>
								{(field) => (
									<Select
										{...field}
										value={formData.vendor}
										options={MODEL_VENDOR_OPTIONS.map((o) => ({
											value: o.key,
											label: o.label,
										}))}
										disabled={busy}
										onValueChange={(value) => {
											if (value !== null)
												onFormChange({ ...formData, vendor: value });
										}}
									/>
								)}
							</Field>
							{text('released_at', 'released', 'date')}
							{formKind === 'llm' ? (
								<>
									{text('context_window', 'contextWindow', 'number')}
									{text('max_tokens', 'maxTokens', 'number')}
								</>
							) : (
								<p className="model-full model-hint">
									{t(
										formKind === 'audio'
											? 'audioNoTokenLimits'
											: 'imageNoTokenLimits'
									)}
								</p>
							)}
							<div className="model-full model-modalities">
								{(['input_modalities', 'output_modalities'] as const).map(
									(kind) => (
										<section key={kind}>
											<h3>
												{t(kind === 'input_modalities' ? 'input' : 'output')}
											</h3>
											<div className="model-choices">
												{(kind === 'input_modalities'
													? MODEL_INPUT_MODALITIES
													: MODEL_OUTPUT_MODALITIES
												).map((m) => (
													<Checkbox
														key={m}
														label={m}
														checked={formData[kind].includes(m)}
														disabled={busy}
														onCheckedChange={() => onToggleModality(kind, m)}
													/>
												))}
											</div>
										</section>
									)
								)}
							</div>
							<section className="model-full model-pricing">
								{formKind === 'audio' &&
								audioPricingDraft &&
								onAudioPricingDraftChange ? (
									<>
										<h3>{t('audioPricing')}</h3>
										<RadioGroup
											aria-label={t('audioBillingMode')}
											value={audioPricingDraft.mode}
											options={[
												{
													value: 'per_second',
													label: t('audioBillingModePerSecond'),
													disabled: busy,
												},
												{
													value: 'token',
													label: t('audioBillingModeToken'),
													disabled: busy,
												},
											]}
											onValueChange={(value) => {
												if (value === 'per_second')
													onAudioPricingDraftChange({
														...audioPricingDraft,
														mode: value,
													});
												else if (value === 'token')
													onAudioPricingDraftChange(
														audioPricingDraft.tiers.length
															? { ...audioPricingDraft, mode: value }
															: createDefaultAudioTokenPricingDraft()
													);
											}}
										/>
										<div className="model-fields">
											{audioPricingDraft.mode === 'token' ? (
												(['input_price', 'output_price'] as const).map(
													(key) => (
														<Field
															key={key}
															label={t(
																key === 'input_price'
																	? 'audioInputPricePerM'
																	: 'audioOutputPricePerM'
															)}
															hint={billingCurrency + '/1M'}
														>
															{(field) => (
																<Input
																	{...field}
																	type="number"
																	step="any"
																	min="0"
																	value={
																		audioPricingDraft.tiers[0]?.[key] ?? ''
																	}
																	disabled={busy}
																	onChange={(event) => {
																		const row = audioPricingDraft.tiers[0];
																		if (row)
																			onAudioPricingDraftChange({
																				...audioPricingDraft,
																				tiers: [
																					{ ...row, [key]: event.target.value },
																				],
																			});
																	}}
																/>
															)}
														</Field>
													)
												)
											) : (
												<>
													{audioNumber(
														'price_per_second',
														'audioPricePerSecond'
													)}
													{audioNumber(
														'minimum_seconds',
														'audioMinimumSeconds'
													)}
												</>
											)}
										</div>
									</>
								) : (
									<PricingTiersEditor
										title={t(
											formKind === 'image'
												? 'imageTokenPricing'
												: 'pricingProfile'
										)}
										rows={pricingTierRows}
										onChange={onPricingTierRowsChange}
										billingCurrencyCode={billingCurrency}
										minRows={0}
										variant={formKind === 'image' ? 'image' : 'llm'}
										imageBillingMode={imageBillingMode}
										onImageBillingModeChange={onImageBillingModeChange}
										perImageDraft={imagePerImageDraft}
										onPerImageDraftChange={onImagePerImageDraftChange}
										disabled={busy}
									/>
								)}
							</section>
							<div className="model-full">
								<div className="model-tags">
									{formData.tags.map((tag) => (
										<Badge key={tag}>
											{tag}
											<ControlButton
												variant="ghost"
												size="sm"
												onClick={() => onRemoveTag(tag)}
												aria-label={t('removeTag', { tag })}
											>
												×
											</ControlButton>
										</Badge>
									))}
								</div>
								<Field label={t('tags')} hint={t('tagsPlaceholder')}>
									{(field) => (
										<div className="model-search">
											<Input
												{...field}
												value={tagInput}
												onChange={(event) =>
													onTagInputChange(event.target.value)
												}
												onKeyDown={(event) => {
													if (
														(event.key === 'Enter' || event.key === ',') &&
														!event.nativeEvent.isComposing
													) {
														event.preventDefault();
														onAddTag();
													}
												}}
											/>
											<ControlButton variant="secondary" onClick={onAddTag}>
												{common('add')}
											</ControlButton>
										</div>
									)}
								</Field>
							</div>
							<div className="model-full">
								<Field label={t('description')}>
									{(field) => (
										<Textarea
											{...field}
											rows={3}
											value={formData.description}
											onChange={(event) =>
												onFormChange({
													...formData,
													description: event.target.value,
												})
											}
										/>
									)}
								</Field>
							</div>
							<div className="model-full">
								<Field label={t('metadataJson')}>
									{(field) => (
										<Textarea
											{...field}
											rows={6}
											value={formData.metadata}
											onChange={(event) =>
												onFormChange({
													...formData,
													metadata: event.target.value,
												})
											}
											className="model-json"
											spellCheck={false}
										/>
									)}
								</Field>
							</div>
						</div>
					</fieldset>
				</form>
			) : null}
			<Dialog
				open={feedback.showDelete}
				finalFocus={feedback.deleteReturnFocus}
				onOpenChange={(next) => {
					if (!busy) feedback.setShowDelete(next);
				}}
				title={f('deleteTitle')}
				description={f('deleteDescription', { id: editingModel?.id ?? '' })}
				preventOutsideDismissal={busy}
				footer={
					<>
						<ControlButton
							variant="outline"
							disabled={busy}
							onClick={() => feedback.setShowDelete(false)}
						>
							{common('cancel')}
						</ControlButton>
						<ControlButton
							variant="danger"
							disabled={busy}
							loading={isDeleting}
							onClick={() => {
								if (editingModel) onDelete(editingModel.id);
							}}
						>
							{t('deleteModel')}
						</ControlButton>
					</>
				}
			>
				{feedback.actionFailure ? (
					<ShellError
						title={feedback.actionFailure.title}
						failure={feedback.actionFailure.failure}
						uncertainWrite={feedback.actionFailure.uncertain}
					/>
				) : (
					<p>{f('deleteHint')}</p>
				)}
			</Dialog>
		</Dialog>
	);
}

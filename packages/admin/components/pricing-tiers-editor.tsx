'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
	Input,
	Textarea,
	ControlButton,
	RadioGroup,
	Select,
	Table,
	TableHead,
	TableBody,
	TableRow,
	TableHeader,
	TableCell,
	ErrorState,
} from '@xsec/ui-react';
import '@/app/gateway/models/models.css';

import type {
	ImageBillingModeDraft,
	ImagePerImageDraft,
	PricingTierDraftRow,
} from '@/lib/pricing-tiers-draft';
import { getGatewayCurrencySymbol } from '@/lib/format-gateway-currency';
import {
	createEmptyTierRow,
	DRAFT_UPTO_OPEN_SENTINEL,
	ensureLastRowOpenUptoDraft,
	formatPricingProfilePreview,
} from '@/lib/pricing-tiers-draft';

export type PricingTiersEditorProps = {
	rows: PricingTierDraftRow[];
	disabled?: boolean;
	onChange: (rows: PricingTierDraftRow[]) => void;
	/** 至少保留行数；低于则禁用删除（默认 0，可删光） */
	minRows?: number;
	/** Optional title on the same row as Add / Preview (e.g. Models form). */
	title?: string;
	/** Left side of the Add / Preview row, left-aligned (e.g. billing / provider factor on routes form). */
	toolbarStart?: ReactNode;
	/** ISO 4217，与网关 `BILLING_CURRENCY` 一致 */
	billingCurrencyCode?: string;
	/**
	 * `image`：展示 Image token 单价列（text / cached text / image in / cached image in / image out）。
	 * `llm`（默认）：chat 常用 input/output/cache 列。
	 */
	variant?: 'llm' | 'image';
	/** Image variant：token / per_image 模式（与 `perImageDraft` 成对传入） */
	imageBillingMode?: ImageBillingModeDraft;
	onImageBillingModeChange?: (mode: ImageBillingModeDraft) => void;
	perImageDraft?: ImagePerImageDraft;
	onPerImageDraftChange?: (draft: ImagePerImageDraft) => void;
};

function updateRow(
	rows: PricingTierDraftRow[],
	id: string,
	patch: Partial<Omit<PricingTierDraftRow, 'id'>>
): PricingTierDraftRow[] {
	return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

/** 原仅末档（开放上界）时拆档，给上一档一个可编辑的默认上界 */
const DEFAULT_PROMOTED_FINITE_UPTO = '1000000';

function PriceCell(props: {
	value: string;
	placeholder: string;
	ariaLabel: string;
	disabled?: boolean;
	onChange: (value: string) => void;
}) {
	return (
		<TableCell className="px-1 py-1.5">
			<Input
				type="text"
				inputMode="decimal"
				disabled={props.disabled}
				value={props.value}
				onChange={(e) => props.onChange(e.target.value)}
				className="font-mono"
				placeholder={props.placeholder}
				aria-label={props.ariaLabel}
			/>
		</TableCell>
	);
}

export function PricingTiersEditor({
	rows,
	onChange,
	minRows = 0,
	title,
	toolbarStart,
	billingCurrencyCode = 'USD',
	variant = 'llm',
	imageBillingMode = 'token',
	onImageBillingModeChange,
	perImageDraft,
	onPerImageDraftChange,
	disabled = false,
}: PricingTiersEditorProps) {
	const t = useTranslations('pricing.tiersEditor');
	const feedback = useTranslations('models.feedback'),
		fieldId = useId();
	const [copyStatus, setCopyStatus] = useState<
			'idle' | 'copying' | 'copied' | 'error'
		>('idle'),
		copyOwner = useRef(0),
		copyBusy = useRef(false);
	useEffect(
		() => () => {
			copyOwner.current++;
		},
		[]
	);
	const tImage = useTranslations('pricing.readOnlyImage');
	const tBilling = useTranslations('pricing.imageBilling');
	const tPricing = useTranslations('pricing');
	const tCommon = useTranslations('common');
	const billCode = billingCurrencyCode.trim().toUpperCase();
	const billSym = getGatewayCurrencySymbol(billCode);
	const perMPlaceholder = `${billSym}/M`;
	const perImagePlaceholder = `${billSym}/image`;
	const unitFooter =
		variant === 'image'
			? imageBillingMode === 'per_image'
				? tBilling('footerPerImage', { currency: billSym })
				: t('footerImage', { currency: billSym })
			: t('footer', { currency: billSym });
	const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);
	const canRemove = rows.length > minRows;
	const imageDraftForPreview =
		variant === 'image' && perImageDraft
			? { mode: imageBillingMode, perImage: perImageDraft }
			: undefined;
	const jsonPreview = formatPricingProfilePreview(rows, imageDraftForPreview);
	useEffect(() => {
		copyOwner.current++;
		copyBusy.current = false;
		setCopyStatus('idle');
	}, [jsonPreview]);
	async function copyPreview() {
		if (copyBusy.current) return;
		copyBusy.current = true;
		const owner = ++copyOwner.current;
		setCopyStatus('copying');
		try {
			await navigator.clipboard.writeText(jsonPreview);
			if (copyOwner.current === owner) setCopyStatus('copied');
		} catch {
			if (copyOwner.current === owner) setCopyStatus('error');
		} finally {
			if (copyOwner.current === owner) copyBusy.current = false;
		}
	}
	const hasToolbarLeft = Boolean(toolbarStart) || Boolean(title);
	const isImage = variant === 'image';
	const isPerImage = isImage && imageBillingMode === 'per_image';
	const colSpan = isImage && !isPerImage ? 7 : isPerImage ? 1 : 6;
	/** Image 列名与 Route 只读区共用 `pricing.readOnlyImage`，避免两套文案分叉 */
	const imageColHeaders =
		isImage && !isPerImage
			? ([
					tImage('textInput'),
					tImage('cachedText'),
					tImage('imageInput'),
					tImage('cachedImageInput'),
					tImage('imageOutput'),
			  ] as const)
			: null;

	const addTier = () => {
		if (disabled) return;
		const base =
			rows.length > 0 ? rows[rows.length - 1]! : createEmptyTierRow();
		const promoted =
			rows.length > 0
				? rows.map((r, i) =>
						i === rows.length - 1 && r.upto.trim() === ''
							? { ...r, upto: DEFAULT_PROMOTED_FINITE_UPTO }
							: r
				  )
				: [];
		const newLast = {
			...createEmptyTierRow(),
			upto: DRAFT_UPTO_OPEN_SENTINEL,
			input_price: base.input_price,
			output_price: base.output_price,
			cache_read_price: base.cache_read_price,
			cache_write_price: base.cache_write_price,
			image_input_price: base.image_input_price,
			image_input_cache_price: base.image_input_cache_price,
			image_output_price: base.image_output_price,
		};
		onChange(rows.length > 0 ? [...promoted, newLast] : [newLast]);
	};

	const removeTier = (id: string) => {
		if (disabled || !canRemove) {
			return;
		}
		const next = rows.filter((r) => r.id !== id);
		onChange(ensureLastRowOpenUptoDraft(next));
	};

	const perImage = perImageDraft ?? {
		default: '',
		inputDefault: '',
		uncertainResultPolicy: 'requested' as const,
	};

	return (
		<div className="model-pricing-editor space-y-3">
			<div
				className={`mb-1 flex min-h-[1.25rem] flex-wrap items-center gap-x-3 gap-y-2 ${
					hasToolbarLeft ? 'justify-between' : 'justify-end'
				}`}
			>
				{hasToolbarLeft ? (
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 text-left">
						{toolbarStart}
						{title ? (
							<span className="text-sm font-medium model-text">{title}</span>
						) : null}
					</div>
				) : null}
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
					{!isPerImage ? (
						<ControlButton
							disabled={disabled}
							type="button"
							onClick={addTier}
							variant="ghost"
							size="sm"
						>
							{t('add')}
						</ControlButton>
					) : null}
					<ControlButton
						type="button"
						onClick={() => setJsonPreviewOpen((v) => !v)}
						aria-expanded={jsonPreviewOpen}
						variant="ghost"
						size="sm"
					>
						{jsonPreviewOpen ? tCommon('hide') : t('preview')}
					</ControlButton>
				</div>
			</div>
			{isImage && onImageBillingModeChange ? (
				<RadioGroup
					aria-label={tBilling('modeLabel')}
					value={imageBillingMode}
					options={[
						{ value: 'token', label: tBilling('modeToken'), disabled },
						{ value: 'per_image', label: tBilling('modePerImage'), disabled },
					]}
					onValueChange={(value) => {
						if (value === 'token' || value === 'per_image')
							onImageBillingModeChange(value);
					}}
				/>
			) : null}
			{isImage && !isPerImage ? (
				<p className="text-[11px] model-muted leading-relaxed">
					{t('imageHint')}
				</p>
			) : null}
			{isPerImage && onPerImageDraftChange ? (
				<div className="overflow-hidden rounded-md border model-border model-surface">
					<div className="grid gap-3 p-3 sm:grid-cols-2">
						<div>
							<label htmlFor={fieldId + '-output'} className="xui-label">
								{tBilling('outputDefault')}
							</label>
							<Input
								type="text"
								inputMode="decimal"
								id={fieldId + '-output'}
								disabled={disabled}
								value={perImage.default}
								onChange={(e) =>
									onPerImageDraftChange({
										...perImage,
										default: e.target.value,
									})
								}
								className="font-mono"
								placeholder={perImagePlaceholder}
							/>
						</div>
						<div>
							<label htmlFor={fieldId + '-input'} className="xui-label">
								{tBilling('inputDefaultOptional')}
							</label>
							<Input
								type="text"
								inputMode="decimal"
								id={fieldId + '-input'}
								disabled={disabled}
								value={perImage.inputDefault}
								onChange={(e) =>
									onPerImageDraftChange({
										...perImage,
										inputDefault: e.target.value,
									})
								}
								className="font-mono"
								placeholder={tBilling('inputDefaultEmpty')}
							/>
						</div>
						<div className="sm:col-span-2">
							<label htmlFor={fieldId + '-policy'} className="xui-label">
								{tBilling('uncertainPolicy')}
							</label>
							<Select
								id={fieldId + '-policy'}
								value={perImage.uncertainResultPolicy}
								disabled={disabled}
								options={[
									{ value: 'requested', label: tBilling('policyRequested') },
									{ value: 'zero', label: tBilling('policyZero') },
								]}
								onValueChange={(value) => {
									if (value === 'requested' || value === 'zero')
										onPerImageDraftChange({
											...perImage,
											uncertainResultPolicy: value,
										});
								}}
							/>
						</div>
					</div>
					<p className="border-t model-border model-subtle px-2 py-1.5 text-[11px] leading-snug model-muted">
						{unitFooter}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-md border model-border model-surface">
					<div className="overflow-x-auto">
						<Table className="min-w-full divide-y model-divide text-left text-xs">
							<TableHead
								className={
									isImage
										? 'model-subtle text-[11px] font-medium model-muted'
										: 'model-subtle text-[10px] font-semibold uppercase tracking-wide model-muted'
								}
							>
								<TableRow>
									<TableHeader className="whitespace-nowrap px-2 py-2">
										{t('upto')}
									</TableHeader>
									{imageColHeaders ? (
										imageColHeaders.map((label) => (
											<TableHeader
												key={label}
												className="whitespace-nowrap px-2 py-2"
											>
												{label}
											</TableHeader>
										))
									) : (
										<>
											<TableHeader className="whitespace-nowrap px-2 py-2">
												{t('input')}
											</TableHeader>
											<TableHeader className="whitespace-nowrap px-2 py-2">
												{t('output')}
											</TableHeader>
											<TableHeader className="whitespace-nowrap px-2 py-2">
												{t('cacheRead')}
											</TableHeader>
											<TableHeader className="whitespace-nowrap px-2 py-2">
												{t('cacheWrite')}
											</TableHeader>
										</>
									)}
									<TableHeader className="w-10 px-1 py-2 text-center">
										{' '}
									</TableHeader>
								</TableRow>
							</TableHead>
							<TableBody className="divide-y model-divide">
								{rows.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={colSpan}
											className="px-3 py-4 text-center model-muted"
										>
											{t('noTiers')}
										</TableCell>
									</TableRow>
								) : (
									rows.map((r, rowIndex) => {
										const isLast = rowIndex === rows.length - 1;
										return (
											<TableRow key={r.id} className="align-top">
												<TableCell className="px-1 py-1.5">
													{isLast ? (
														<div
															className="flex min-h-[1.75rem] min-w-[4.5rem] items-center rounded border border-dashed model-border model-subtle px-1.5 font-mono text-[11px] model-muted tabular-nums"
															title={t('lastTierOpenEnded')}
															aria-label={t('lastTierOpenEnded')}
														>
															{tCommon('infinity')}
														</div>
													) : (
														<Input
															type="text"
															inputMode="numeric"
															value={r.upto}
															onChange={(e) =>
																onChange(
																	updateRow(rows, r.id, {
																		upto: e.target.value,
																	})
																)
															}
															className="font-mono"
															placeholder="0"
															disabled={disabled}
															aria-label={t('upto') + ' ' + (rowIndex + 1)}
														/>
													)}
												</TableCell>
												{isImage ? (
													<>
														<PriceCell
															disabled={disabled}
															value={r.input_price}
															placeholder={perMPlaceholder}
															ariaLabel={
																tImage('textInput') + ' ' + (rowIndex + 1)
															}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, { input_price: v })
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.cache_read_price}
															placeholder={tPricing('emptyCachePlaceholder')}
															ariaLabel={
																tImage('cachedText') + ' ' + (rowIndex + 1)
															}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, { cache_read_price: v })
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.image_input_price}
															placeholder={perMPlaceholder}
															ariaLabel={
																tImage('imageInput') + ' ' + (rowIndex + 1)
															}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, {
																		image_input_price: v,
																	})
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.image_input_cache_price}
															placeholder={tPricing('emptyCachePlaceholder')}
															ariaLabel={
																tImage('cachedImageInput') +
																' ' +
																(rowIndex + 1)
															}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, {
																		image_input_cache_price: v,
																	})
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.image_output_price}
															placeholder={perMPlaceholder}
															ariaLabel={
																tImage('imageOutput') + ' ' + (rowIndex + 1)
															}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, {
																		image_output_price: v,
																	})
																)
															}
														/>
													</>
												) : (
													<>
														<PriceCell
															disabled={disabled}
															value={r.input_price}
															placeholder={perMPlaceholder}
															ariaLabel={t('input') + ' ' + (rowIndex + 1)}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, { input_price: v })
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.output_price}
															placeholder={perMPlaceholder}
															ariaLabel={t('output') + ' ' + (rowIndex + 1)}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, { output_price: v })
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.cache_read_price}
															placeholder={tPricing('emptyCachePlaceholder')}
															ariaLabel={t('cacheRead') + ' ' + (rowIndex + 1)}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, { cache_read_price: v })
																)
															}
														/>
														<PriceCell
															disabled={disabled}
															value={r.cache_write_price}
															placeholder={tPricing('emptyCachePlaceholder')}
															ariaLabel={t('cacheWrite') + ' ' + (rowIndex + 1)}
															onChange={(v) =>
																onChange(
																	updateRow(rows, r.id, {
																		cache_write_price: v,
																	})
																)
															}
														/>
													</>
												)}
												<TableCell className="px-0 py-1.5 text-center">
													<ControlButton
														type="button"
														disabled={disabled || !canRemove}
														onClick={() => removeTier(r.id)}
														variant="danger"
														size="sm"
														aria-label={t('removeTier')}
														title={t('removeTier')}
													>
														×
													</ControlButton>
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>
					<p className="border-t model-border model-subtle px-2 py-1.5 text-[11px] leading-snug model-muted">
						{unitFooter}
					</p>
				</div>
			)}
			{copyStatus === 'error' ? (
				<ErrorState title={feedback('clipboardFailed')} />
			) : null}
			{copyStatus === 'copied' ? (
				<span role="status">{tCommon('copied')}</span>
			) : null}
			{jsonPreviewOpen ? (
				<div className="space-y-1.5">
					<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
						<label className="text-xs font-medium model-muted">
							<code className="rounded model-subtle px-1">
								{tPricing('jsonPreviewLabel')}
							</code>
						</label>
						<ControlButton
							type="button"
							onClick={() => void copyPreview()}
							disabled={copyStatus === 'copying'}
							variant="ghost"
							size="sm"
						>
							{copyStatus === 'copied' ? tCommon('copied') : tCommon('copy')}
						</ControlButton>
					</div>
					<Textarea
						readOnly
						rows={Math.min(14, 4 + rows.length * 3)}
						value={jsonPreview}
						className="model-json"
						spellCheck={false}
						aria-label="pricing_profile JSON preview"
					/>
				</div>
			) : null}
		</div>
	);
}

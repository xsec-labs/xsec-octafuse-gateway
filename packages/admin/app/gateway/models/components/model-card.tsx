'use client';

import { ControlButton, Badge } from '@xsec/ui-react';
import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ModelModalitiesBadgeFromRaw } from '@/components/model-modalities-badge';
import { ModelVendorIcon } from '@/components/model-vendor-icon';
import { ReadOnlyImagePricing } from '@/components/read-only-image-pricing';
import { formatCompactTokens } from '@/lib/format-compact-tokens';
import {
	formatGatewayMoneyCompact,
	formatPerImageUnit,
	formatPerMillionTokenUnit,
	formatPerSecondUnit,
} from '@/lib/format-gateway-currency';
import { getCatalogImagePricingDisplay } from '@/lib/pricing-ui';
import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
} from '@octafuse/core/db/model-modalities';
import {
	buildMetadataSummary,
	buildPricingMetricColumns,
	getMetadataButtonLabel,
	type PricingMetricColumn,
} from '../model-utils';
import type { ModelListItem } from '../types';

function ModelIdentityHeader(props: {
	model: ModelListItem;
	onEdit: (model: ModelListItem) => void;
}) {
	const { model } = props;
	const t = useTranslations('models.card');
	const tagShown = model.tags?.length ? model.tags.slice(0, 6) : [];
	const tagExtra = (model.tags?.length ?? 0) - tagShown.length;
	const displayName = model.display_name || model.id;
	const routesLabel =
		model.routes_count === 1
			? t('routes', { count: model.routes_count })
			: t('routesPlural', { count: model.routes_count });

	return (
		<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex min-w-0 flex-1 items-start gap-2">
				<ModelVendorIcon vendor={model.vendor} size="identity" />
				<div className="min-w-0 flex-1">
					<h3
						className="truncate text-sm font-semibold model-text"
						title={displayName}
					>
						<ControlButton
							variant="ghost"
							className="model-name"
							onClick={() => props.onEdit(model)}
						>
							{displayName}
						</ControlButton>
					</h3>
					<p
						className="mt-0.5 truncate font-mono text-xs model-muted"
						title={model.id}
					>
						{model.id}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
				<div className="flex flex-wrap items-center justify-start gap-1 sm:justify-end">
					{tagShown.length ? (
						<>
							{tagShown.map((tag) => (
								<Badge key={tag}>{tag}</Badge>
							))}
							{tagExtra > 0 ? (
								<span className="self-center text-xs model-muted">
									+{tagExtra}
								</span>
							) : null}
						</>
					) : (
						<span className="text-xs model-muted">{t('noTags')}</span>
					)}
				</div>
				<span
					className="rounded-md model-subtle px-1.5 py-0.5 text-xs font-medium model-muted"
					title={t('routesTitle', {
						routes: routesLabel,
						active: t('activeRoutes', { count: model.active_routes_count }),
					})}
				>
					{routesLabel}
					<span className="mx-1 model-muted" aria-hidden>
						·
					</span>
					{t('activeRoutes', { count: model.active_routes_count })}
				</span>
			</div>
		</div>
	);
}

function ModelCapabilityPanel({ model }: { model: ModelListItem }) {
	const t = useTranslations('models.card');
	const tCommon = useTranslations('common');
	const hideTokenLimits =
		isImageGenerationModel(model) || isAudioTranscriptionModel(model);
	const cellClass = 'rounded-md border model-border model-subtle px-2 py-1.5';
	return (
		<div>
			<h4 className="text-xs font-semibold uppercase tracking-wider model-muted">
				{t('capabilities')}
			</h4>
			<div className="mt-1.5 grid grid-cols-2 gap-1.5">
				{!hideTokenLimits ? (
					<>
						<div className={cellClass}>
							<p className="text-xs model-muted">{t('totalContext')}</p>
							<p className="mt-0.5 text-xs font-semibold model-text tabular-nums tracking-tight">
								{formatCompactTokens(model.context_window)}
							</p>
						</div>
						<div className={cellClass}>
							<p className="text-xs model-muted">{t('maxOutput')}</p>
							<p className="mt-0.5 text-xs font-semibold model-text tabular-nums tracking-tight">
								{formatCompactTokens(model.max_tokens)}
							</p>
						</div>
					</>
				) : null}
				<div className={`min-w-0 ${cellClass}`}>
					<p className="text-xs model-muted">{t('modalities')}</p>
					<div className="mt-1">
						<ModelModalitiesBadgeFromRaw
							inputRaw={model.input_modalities}
							outputRaw={model.output_modalities}
							size="sm"
						/>
					</div>
				</div>
				<div className={cellClass}>
					<p className="text-xs model-muted">{t('released')}</p>
					<p className="mt-0.5 text-xs model-text tabular-nums">
						{model.released_at || tCommon('noData')}
					</p>
				</div>
			</div>
		</div>
	);
}

function ModelPricingPanel(props: {
	model: ModelListItem;
	pricingColumns: PricingMetricColumn[];
	billingCurrency: string;
}) {
	const { model, pricingColumns, billingCurrency } = props;
	const t = useTranslations('models.card');
	const tCommon = useTranslations('common');
	const imageDisplay = useMemo(
		() => getCatalogImagePricingDisplay(model, billingCurrency),
		[model, billingCurrency]
	);
	const tokenColumns = useMemo(
		() => pricingColumns.filter((c) => (c.unitKind ?? 'per_m') === 'per_m'),
		[pricingColumns]
	);
	const perImageColumns = useMemo(
		() => pricingColumns.filter((c) => c.unitKind === 'per_image'),
		[pricingColumns]
	);
	const perSecondColumns = useMemo(
		() => pricingColumns.filter((c) => c.unitKind === 'per_second'),
		[pricingColumns]
	);
	const hasTokenCols = tokenColumns.length > 0;
	const hasPerImageCols = perImageColumns.length > 0;
	const hasPerSecondCols = perSecondColumns.length > 0;
	const hasAnyCols = hasTokenCols || hasPerImageCols || hasPerSecondCols;
	const showPerImageSummary = imageDisplay?.billingKind === 'image_per_image';

	return (
		<div>
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				<h4 className="text-xs font-semibold uppercase tracking-wider model-muted">
					{t('pricing')}
				</h4>
				{hasTokenCols ? (
					<span className="text-xs font-normal normal-case tracking-normal model-muted tabular-nums">
						{formatPerMillionTokenUnit(billingCurrency)}
					</span>
				) : null}
				{hasPerImageCols ? (
					<span className="text-xs font-normal normal-case tracking-normal model-muted tabular-nums">
						{formatPerImageUnit(billingCurrency)}
					</span>
				) : null}
				{hasPerSecondCols ? (
					<span className="text-xs font-normal normal-case tracking-normal model-muted tabular-nums">
						{formatPerSecondUnit(billingCurrency)}
					</span>
				) : null}
			</div>
			{!hasAnyCols ? (
				<p className="mt-1.5 text-xs model-muted">{tCommon('noData')}</p>
			) : (
				<div className="mt-1.5 space-y-1.5">
					<div
						className={
							isImageGenerationModel(model) || isAudioTranscriptionModel(model)
								? 'grid grid-cols-2 gap-1.5'
								: 'grid grid-cols-4 gap-1'
						}
					>
						{[...tokenColumns, ...perImageColumns, ...perSecondColumns].map(
							(col) => (
								<div
									key={col.title}
									className="min-w-0 rounded-md border model-border model-subtle px-1.5 py-1.5 sm:px-2"
								>
									<p
										className="truncate text-xs font-medium model-muted"
										title={col.headerTitle ?? col.title}
									>
										{col.title}
									</p>
									<div className="mt-1 space-y-1 tabular-nums leading-snug">
										{col.lines.map((line, lineIdx) => (
											<div
												key={`${col.title}-${lineIdx}`}
												className="flex min-w-0 flex-col gap-0.5 sm:flex-wrap sm:flex-row sm:items-baseline sm:gap-x-1"
												title={
													line.price == null
														? line.condition
														: `${line.condition} ${formatGatewayMoneyCompact(
																line.price,
																billingCurrency
														  )}`
												}
											>
												<span className="shrink-0 truncate text-xs model-muted sm:text-xs">
													{line.condition}
												</span>
												<span className="truncate text-xs font-semibold model-text">
													{line.price == null
														? tCommon('noData')
														: formatGatewayMoneyCompact(
																line.price,
																billingCurrency
														  )}
												</span>
											</div>
										))}
									</div>
								</div>
							)
						)}
					</div>
					{showPerImageSummary ? (
						<ReadOnlyImagePricing
							compact
							display={imageDisplay}
							emptyLabel={tCommon('noData')}
							showTokenRates={false}
						/>
					) : null}
				</div>
			)}
		</div>
	);
}

function ModelMetadataCell(props: {
	model: ModelListItem;
	onView: (model: ModelListItem) => void;
}) {
	const t = useTranslations('models.card');
	const tCommon = useTranslations('common');
	const summary = useMemo(
		() => buildMetadataSummary(props.model.metadata),
		[props.model.metadata]
	);
	if (summary.kind === 'empty') {
		return <span className="text-xs model-muted">{tCommon('noData')}</span>;
	}
	const label = getMetadataButtonLabel(summary);
	return (
		<ControlButton
			variant="outline"
			size="sm"
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				props.onView(props.model);
			}}
			className="inline-flex max-w-full items-center truncate rounded-md border model-border model-subtle px-2 py-1 text-xs font-medium model-text hover:border-gray-300 hover:model-subtle focus:outline-none focus:ring-2 focus:ring-blue-500"
			title={t('viewMetadataJson')}
		>
			{label}
		</ControlButton>
	);
}

function ModelDetailsPanel(props: {
	model: ModelListItem;
	onViewMetadata: (model: ModelListItem) => void;
}) {
	const { model, onViewMetadata } = props;
	const t = useTranslations('models.card');
	const tCommon = useTranslations('common');
	const description = model.description?.trim();
	const metadataSummary = buildMetadataSummary(model.metadata);
	const hasMetadata = metadataSummary.kind !== 'empty';

	if (!description && !hasMetadata) {
		return null;
	}

	return (
		<div className="grid gap-2 border-t model-border pt-2.5 sm:grid-cols-2">
			<div className="min-w-0">
				<h4 className="text-xs font-semibold uppercase tracking-wider model-muted">
					{t('description')}
				</h4>
				{description ? (
					<p
						className="mt-1 line-clamp-2 text-xs leading-relaxed model-muted"
						title={description}
					>
						{description}
					</p>
				) : (
					<p className="mt-1 text-xs model-muted">{tCommon('noData')}</p>
				)}
			</div>
			<div className="min-w-0">
				<h4 className="text-xs font-semibold uppercase tracking-wider model-muted">
					{t('metadata')}
				</h4>
				<div className="mt-1">
					<ModelMetadataCell model={model} onView={onViewMetadata} />
				</div>
			</div>
		</div>
	);
}

export const ModelCard = memo(function ModelCard(props: {
	model: ModelListItem;
	billingCurrency: string;
	onEdit: (model: ModelListItem) => void;
	onViewMetadata: (model: ModelListItem) => void;
}) {
	const { model, billingCurrency, onEdit, onViewMetadata } = props;
	const pricingColumns = buildPricingMetricColumns(model.pricing_profile);

	return (
		<article className="model-card">
			<ModelIdentityHeader model={model} onEdit={onEdit} />
			<div className="mt-2.5 space-y-2.5">
				<ModelCapabilityPanel model={model} />
				<ModelPricingPanel
					model={model}
					pricingColumns={pricingColumns}
					billingCurrency={billingCurrency}
				/>
				<ModelDetailsPanel model={model} onViewMetadata={onViewMetadata} />
			</div>
		</article>
	);
});

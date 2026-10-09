'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
	ControlButton,
	Dialog,
	Input,
	Checkbox,
	RadioGroup,
	Badge,
	Spinner,
	EmptyState,
	Tooltip,
} from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { getModelVendorLabel } from '@/lib/model-vendor';
import { formatCompactTokens } from '@/lib/format-compact-tokens';
import { formatPerMillionTokenUnit } from '@/lib/format-gateway-currency';
import { sortImportCatalogRows } from '../model-utils';
import type { useModelsPageState } from '../use-models-page-state';
export function ModelImportModal({
	state: s,
}: {
	state: Omit<ReturnType<typeof useModelsPageState>, 'attachSuccessFocus'>;
}) {
	const t = useTranslations('models.import'),
		kind = useTranslations('models.filter'),
		f = useTranslations('models.feedback'),
		common = useTranslations('common'),
		locale = useLocale();
	const [confirming, setConfirming] = useState(false);
	const rows = useMemo(
		() => sortImportCatalogRows(s.filteredImportCatalogRows),
		[s.filteredImportCatalogRows]
	);
	const currency =
			s.catalog.status === 'ready'
				? s.catalog.value.currency
				: s.billingCurrency,
		busy = s.importSubmitting;
	return (
		<Dialog
			open={s.showImportCatalogModal}
			onOpenChange={(next) => {
				if (!next && !busy && !confirming) s.closeImportCatalogModal();
			}}
			preventOutsideDismissal={busy}
			title={t('title')}
			description={f('importSummary', { currency })}
			className="model-dialog model-import-dialog"
			footer={
				<>
					<ControlButton
						variant="outline"
						onClick={s.closeImportCatalogModal}
						disabled={busy}
					>
						{common('close')}
					</ControlButton>
					<ControlButton
						onClick={() => setConfirming(true)}
						loading={busy}
						disabled={
							busy ||
							s.catalog.status !== 'ready' ||
							s.list.status !== 'ready' ||
							!s.importSelectedCount
						}
					>
						{t('importSelected', { count: s.importSelectedCount })}
					</ControlButton>
				</>
			}
		>
			<details className="model-import-help">
				<summary>{f('importHelp')}</summary>
				<p>{t('subtitle', {currency, unit: formatPerMillionTokenUnit(currency)})}</p>
			</details>
			<div className="model-import-toolbar">
				<Input
					type="search"
					value={s.importCatalogSearch}
					onChange={(event) => s.setImportCatalogSearch(event.target.value)}
					placeholder={t('searchPlaceholder')}
					aria-label={t('searchPlaceholder')}
					disabled={busy}
				/>
				<ControlButton
					variant="outline"
					onClick={() => void s.loadImportCatalog()}
					disabled={busy || s.catalog.status === 'loading'}
				>
					{t('reloadCatalog')}
				</ControlButton>
			</div>
			<RadioGroup
				aria-label={t('kindFilterAria')}
				value={s.importCatalogKind}
				options={(['llm', 'image', 'audio'] as const).map((value) => ({
					value,
					label: (
						<>
							{kind(
								value === 'llm'
									? 'kindLlm'
									: value === 'image'
									? 'kindImage'
									: 'kindAudio'
							)}{' '}
							<Badge>{s.importCatalogKindCounts[value]}</Badge>
						</>
					),
					disabled: busy,
				}))}
				onValueChange={(value) => {
					if (value === 'llm' || value === 'image' || value === 'audio')
						s.setImportCatalogKind(value);
				}}
			/>
			<div className="model-import-toolbar model-hint">
				<span>
					{t('selectedAvailable', {
						selected: s.importSelectedCount,
						importable: s.importableCatalogCount,
					})}
				</span>
				<ControlButton
					variant="ghost"
					onClick={s.selectAllImportPresets}
					disabled={busy || s.catalog.status !== 'ready'}
				>
					{common('selectAll')}
				</ControlButton>
				<ControlButton
					variant="ghost"
					onClick={s.clearImportPresetSelection}
					disabled={busy || !s.importSelectedCount}
				>
					{t('clearSelection')}
				</ControlButton>
			</div>
			{s.importFailure ? (
				<ShellError
					title={s.importFailure.title}
					failure={s.importFailure.failure}
					uncertainWrite={s.importFailure.uncertain}
					action={
						<ControlButton onClick={() => void s.refreshModels()}>
							{f('readList')}
						</ControlButton>
					}
				/>
			) : null}
			{s.importResult ? (
				<section className="model-import-result" role="status">
					<strong>
						{f('importResult', {
							created: s.importResult.created,
							skipped: s.importResult.skipped_existing.length,
							failed: s.importResult.failed.length,
							currency: s.importResult.billing_currency_used,
						})}
					</strong>
					{s.importResult.failed.length ? (
						<>
							<p>{f('failedTemplates')}</p>
							<ul>
								{s.importResult.failed.map((row) => (
									<li key={row.id}>
										<code>{row.id}</code>
									</li>
								))}
							</ul>
						</>
					) : null}
				</section>
			) : null}
			{s.catalog.status === 'loading' ? (
				<Spinner label={t('loadingCatalog')} />
			) : s.catalog.status === 'error' ? (
				<ShellError title={f('catalogFailed')} failure={s.catalog.failure} />
			) : rows.length ? (
				<ul className="model-template-list">
					{rows.map((row) => {
						const existing = s.existingModelIds.has(row.id),
							description = locale.startsWith('zh')
								? row.i18n?.zh ?? row.description
								: row.i18n?.en ?? row.description;
						const pricingLabel =
							row.pricing_label ?? t('catalogTiers', { count: row.tier_count });
						return (
							<li key={row.id}>
								<Checkbox
									checked={!existing && !!s.importSelected[row.id]}
									disabled={existing || busy}
									onCheckedChange={() => s.toggleImportPreset(row.id)}
									label={
										<span className="model-template">
											<strong>{row.display_name || row.id}</strong>
											<code>{row.id}</code>
											<span className="model-hint">
												{getModelVendorLabel(row.vendor)}
												{row.kind === 'llm'
													? ' · ' +
													  formatCompactTokens(row.context_window) +
													  ' / ' +
													  formatCompactTokens(row.max_tokens)
													: ''}
											</span>
											{description ? (
												<span className="model-hint">{description}</span>
											) : null}
											{existing ? (
												<Badge>
													{t('alreadyInGatewayRow', { id: row.id })}
												</Badge>
											) : null}
										</span>
									}
								/>
								<Tooltip
									content={
										<span className="model-pricing-tip">
											{row.pricing_preview ?? pricingLabel}
										</span>
									}
								>
									<ControlButton
										variant="ghost"
										size="sm"
										aria-label={f('pricingPreview', { id: row.id })}
									>
										{pricingLabel}
									</ControlButton>
								</Tooltip>
							</li>
						);
					})}
				</ul>
			) : (
				<EmptyState
					title={s.importCatalogRows.length ? t('noMatch') : t('catalogEmpty')}
				/>
			)}
			<Dialog
				open={confirming}
				onOpenChange={(next) => {
					if (!busy) setConfirming(next);
				}}
				title={f('importTitle')}
				description={f('importDescription', {
					count: s.importSelectedCount,
					currency,
				})}
				footer={
					<>
						<ControlButton
							variant="outline"
							onClick={() => setConfirming(false)}
						>
							{common('cancel')}
						</ControlButton>
						<ControlButton
							onClick={() => {
								setConfirming(false);
								void s.runImportSelectedPresets();
							}}
						>
							{common('import')}
						</ControlButton>
					</>
				}
			>
				<p>{f('importHint')}</p>
			</Dialog>
		</Dialog>
	);
}

'use client';
import { ControlButton, Dialog, Field, Input, Select, Textarea, ErrorState } from '@xsec/ui-react';

import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { ReadOnlyImagePricing } from '@/components/read-only-image-pricing';
import { ReadOnlyPricingTiersTable } from '@/components/read-only-pricing-tiers-table';
import { type CatalogAudioPricingDisplay } from '@/lib/audio-transcriptions';
import type { CatalogImagePricingDisplay, CatalogPricingTierDisplayRow } from '@/lib/pricing-ui';
import type { GatewayModel, GatewayProvider } from '@/lib/types';
import { UPSTREAM_PROTOCOLS, type UpstreamProtocol } from '@/lib/upstream-protocol';
import { requestOperationsForModel, upstreamOperationsForProviderModel } from '../route-utils';
import type { RouteFormData, RouteListRow } from '../types';
import ShellError from '@/components/layout/ShellError';
import type { useRoutesPageState } from '../use-routes-page-state';
import '../routes.css';
import { DailyScheduleEditor } from './daily-schedule-editor';
import { RoutePricePanel } from './route-price-panel';

type Props = {
	open: boolean;
	feedback: Pick<
		ReturnType<typeof useRoutesPageState>,
		'actionFailure' | 'showDelete' | 'returnFocus' | 'deleteReturnFocus' | 'closeDelete'
	>;
	editingRoute: RouteListRow | null;
	duplicateSourceRouteId: string | null;
	formData: RouteFormData;
	saveError: string;
	isSaving: boolean;
	isDeleting: boolean;
	billingCurrency: string;
	models: GatewayModel[];
	providers: GatewayProvider[];
	selectedModel: GatewayModel | undefined;
	selectedProvider: GatewayProvider | undefined;
	catalogStandardTierRows: CatalogPricingTierDisplayRow[];
	catalogImagePricingDisplay: CatalogImagePricingDisplay | null;
	catalogAudioPricingDisplay: CatalogAudioPricingDisplay | null;
	selectedModelIsImage: boolean;
	selectedModelIsAudio: boolean;
	allowedProtocolsForProvider: UpstreamProtocol[];
	businessTimezone: string;
	onClose: () => void;
	onFormChange: (form: RouteFormData) => void;
	onSave: () => void;
	onDelete: () => void;
	onConfirmDelete: () => void;
	onDuplicate: () => void;
};

export function RouteModal(props: Props) {
	const {
		open,
		feedback,
		editingRoute,
		duplicateSourceRouteId,
		formData,
		saveError,
		isSaving,
		isDeleting,
		billingCurrency,
		models,
		providers,
		selectedModel,
		selectedProvider,
		catalogStandardTierRows,
		catalogImagePricingDisplay,
		catalogAudioPricingDisplay,
		selectedModelIsImage,
		selectedModelIsAudio,
		allowedProtocolsForProvider,
		businessTimezone,
		onClose,
		onFormChange,
		onSave,
		onDelete,
		onDuplicate,
	} = props;

	const t = useTranslations('routes.modal');
	const f = useTranslations('routes.feedback');
	const busy = isSaving || isDeleting;
	const tModels = useTranslations('models.modal');
	const tCommon = useTranslations('common');
	const lockOpenaiProtocol = selectedModelIsImage || selectedModelIsAudio;
	const requestProtocols = UPSTREAM_PROTOCOLS.filter(
		(protocol) => requestOperationsForModel(selectedModel, protocol).length > 0
	);
	const requestOperations = requestOperationsForModel(selectedModel, formData.request_protocol);
	const upstreamOperations = upstreamOperationsForProviderModel(
		selectedProvider,
		selectedModel,
		formData.upstream_protocol
	);
	const selectableProviders = providers.filter(
		(provider) =>
			(Boolean(editingRoute || duplicateSourceRouteId) && provider.id === formData.provider_id) ||
			UPSTREAM_PROTOCOLS.some(
				(protocol) =>
					upstreamOperationsForProviderModel(provider, selectedModel, protocol).length > 0
			)
	);
	const showCurrentUpstreamOperation =
		Boolean(editingRoute) &&
		!upstreamOperations.includes(formData.upstream_operation) &&
		Boolean(formData.upstream_operation);

	if (!open) return null;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !busy && !feedback.showDelete) onClose();
			}}
			preventOutsideDismissal={busy}
			title={editingRoute ? t('editTitle') : t('newTitle')}
			description={
				!editingRoute && duplicateSourceRouteId
					? t('prefilledFrom', { id: duplicateSourceRouteId })
					: editingRoute?.id
			}
			finalFocus={feedback.returnFocus}
			className="route-dialog route-editor"
			footer={
				<>
					{editingRoute ? (
						<ControlButton variant="danger" disabled={busy} onClick={onDelete}>
							{t('deleteRoute')}
						</ControlButton>
					) : null}
					<span className="route-spacer" />
					<ControlButton variant="outline" onClick={onClose} disabled={busy}>
						{tCommon('cancel')}
					</ControlButton>
					{editingRoute ? (
						<ControlButton variant="outline" onClick={onDuplicate} disabled={busy}>
							<DocumentDuplicateIcon className="h-4 w-4" aria-hidden />
							{tCommon('duplicate')}
						</ControlButton>
					) : null}
					<ControlButton type="submit" form="route-editor-form" disabled={busy} loading={isSaving}>
						{tCommon('save')}
					</ControlButton>
				</>
			}
		>
			{feedback.actionFailure && !feedback.showDelete ? (
				<ShellError
					title={feedback.actionFailure.title}
					failure={feedback.actionFailure.failure}
					uncertainWrite={feedback.actionFailure.uncertain}
				/>
			) : null}
			{saveError ? <ErrorState title={f('validationFailed')} description={saveError} /> : null}
			<form
				id="route-editor-form"
				onSubmit={(event) => {
					event.preventDefault();
					if (!busy) onSave();
				}}
			>
				<fieldset disabled={busy}>
					<div className="space-y-4">
						<section className="rounded-lg border route-border route-subtle p-3.5">
							<h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide route-muted">
								{t('basicMapping')}
							</h3>
							<div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
								<div>
									<Field label={<> {t('modelRequired')} </>}>
										{(field) => (
											<Select
												{...field}
												disabled={busy}
												value={formData.model_id}
												required
												options={[
													{ value: '', label: t('selectModel') },
													...models.map((m) => ({ value: m.id, label: m.display_name || m.id })),
												]}
												onValueChange={(value) => {
													const nextModelId = value ?? '';
													const nextModel = models.find((m) => m.id === nextModelId);
													const nextRequestProtocols = UPSTREAM_PROTOCOLS.filter(
														(protocol) => requestOperationsForModel(nextModel, protocol).length > 0
													);
													const requestProtocol = nextRequestProtocols.includes(
														formData.request_protocol
													)
														? formData.request_protocol
														: nextRequestProtocols[0] ?? formData.request_protocol;
													const nextRequestOperations = requestOperationsForModel(
														nextModel,
														requestProtocol
													);
													const requestOperation = nextRequestOperations.includes(
														formData.request_operation
													)
														? formData.request_operation
														: nextRequestOperations[0] ?? formData.request_operation;
													const nextUpstreamProtocols = selectedProvider
														? UPSTREAM_PROTOCOLS.filter(
																(protocol) =>
																	upstreamOperationsForProviderModel(
																		selectedProvider,
																		nextModel,
																		protocol
																	).length > 0
														  )
														: [];
													const upstreamProtocol = nextUpstreamProtocols.includes(
														formData.upstream_protocol
													)
														? formData.upstream_protocol
														: nextUpstreamProtocols[0] ?? requestProtocol;
													const nextUpstreamOperations = upstreamOperationsForProviderModel(
														selectedProvider,
														nextModel,
														upstreamProtocol
													);
													const upstreamOperation = nextUpstreamOperations.includes(
														formData.upstream_operation
													)
														? formData.upstream_operation
														: nextUpstreamOperations[0] ?? requestOperation;
													onFormChange({
														...formData,
														model_id: nextModelId,
														request_protocol: requestProtocol,
														request_operation: requestOperation,
														upstream_protocol: upstreamProtocol,
														upstream_operation: upstreamOperation,
													});
												}}
											/>
										)}
									</Field>
								</div>
								<div>
									<Field label={<> {t('requestProtocol')} </>}>
										{(field) => (
											<Select
												{...field}
												value={formData.request_protocol}
												disabled={busy || lockOpenaiProtocol}
												options={requestProtocols.map((p) => ({ value: p, label: p }))}
												onValueChange={(value) => {
													const requestProtocol = (value ?? '') as UpstreamProtocol;
													const requestOperation =
														requestOperationsForModel(selectedModel, requestProtocol)[0] ??
														formData.request_operation;
													onFormChange({
														...formData,
														request_protocol: requestProtocol,
														request_operation: requestOperation,
													});
												}}
											/>
										)}
									</Field>
								</div>
								<div>
									<Field label={<> {t('requestOperation')} </>}>
										{(field) => (
											<Select
												{...field}
												disabled={busy}
												value={formData.request_operation}
												options={[
													...requestOperations,
													...(formData.request_operation === '*' ? ['*'] : []),
												].map((operation) => ({ value: operation, label: operation }))}
												onValueChange={(value) =>
													onFormChange({ ...formData, request_operation: value ?? '' })
												}
											/>
										)}
									</Field>
								</div>
								<div>
									<Field label={<> {t('providerRequired')} </>}>
										{(field) => (
											<Select
												{...field}
												disabled={busy}
												value={formData.provider_id}
												required
												options={[
													{ value: '', label: t('selectProvider') },
													...selectableProviders.map((p) => ({
														value: p.id,
														label: p.name || p.id,
													})),
												]}
												onValueChange={(value) => {
													const nextId = value ?? '';
													const nextProvider = providers.find((p) => p.id === nextId);
													const allowed =
														nextProvider != null
															? UPSTREAM_PROTOCOLS.filter(
																	(proto) =>
																		upstreamOperationsForProviderModel(
																			nextProvider,
																			selectedModel,
																			proto
																		).length > 0
															  )
															: [];
													let nextProto = formData.upstream_protocol;
													if (allowed.length > 0 && !allowed.includes(nextProto)) {
														nextProto = allowed[0]!;
													}
													const supportedOperations = upstreamOperationsForProviderModel(
														nextProvider,
														selectedModel,
														nextProto
													);
													const nextOperation = supportedOperations.includes(
														formData.upstream_operation
													)
														? formData.upstream_operation
														: supportedOperations[0] ?? formData.upstream_operation;
													onFormChange({
														...formData,
														provider_id: nextId,
														upstream_protocol: nextProto,
														upstream_operation: nextOperation,
													});
												}}
											/>
										)}
									</Field>
								</div>
								<div>
									<Field label={<> {t('upstreamProtocol')} </>}>
										{(field) => (
											<Select
												{...field}
												value={formData.upstream_protocol}
												disabled={busy || lockOpenaiProtocol || !selectedProvider}
												options={allowedProtocolsForProvider.map((p) => ({ value: p, label: p }))}
												onValueChange={(value) => {
													const upstreamProtocol = (value ?? '') as UpstreamProtocol;
													onFormChange({
														...formData,
														upstream_protocol: upstreamProtocol,
														upstream_operation:
															upstreamOperationsForProviderModel(
																selectedProvider,
																selectedModel,
																upstreamProtocol
															)[0] ?? formData.upstream_operation,
													});
												}}
											/>
										)}
									</Field>
									{selectedModelIsAudio ? (
										<p className="mt-1 text-[11px] text-amber-700">
											{t('protocolHintAudioOpenaiOnly')}
										</p>
									) : selectedModelIsImage ? (
										<p className="mt-1 text-[11px] text-amber-700">
											{t('protocolHintImageOpenaiOnly')}
										</p>
									) : null}
								</div>
								<div>
									<Field label={<> {t('upstreamOperation')} </>}>
										{(field) => (
											<Select
												{...field}
												value={formData.upstream_operation}
												disabled={busy || !selectedProvider || upstreamOperations.length === 0}
												options={[
													...upstreamOperations.map((operation) => ({
														value: operation,
														label: operation,
													})),
													...(showCurrentUpstreamOperation
														? [
																{
																	value: formData.upstream_operation,
																	label:
																		formData.upstream_operation + ' · ' + t('currentLegacyValue'),
																},
														  ]
														: []),
												]}
												onValueChange={(value) =>
													onFormChange({ ...formData, upstream_operation: value ?? '' })
												}
											/>
										)}
									</Field>
									<p className="mt-1 text-[11px] route-muted">
										{selectedProvider
											? t('upstreamOperationHintConfigured')
											: t('protocolHintSelectProvider')}
									</p>
								</div>
								<div>
									<Field label={<> {t('providerModelName')} </>}>
										{(field) => (
											<Input
												{...field}
												type="text"
												value={formData.provider_model_name}
												onChange={(e) =>
													onFormChange({ ...formData, provider_model_name: e.target.value })
												}
												placeholder={t('providerModelPlaceholder')}
												required
											/>
										)}
									</Field>
								</div>
								<div>
									<Field label={<> {t('routeGroup')} </>} hint={t('routeGroupHint')}>
										{(field) => (
											<Input
												{...field}
												type="text"
												value={formData.route_group}
												onChange={(e) => onFormChange({ ...formData, route_group: e.target.value })}
												placeholder={t('routeGroupPlaceholder')}
												title={t('routeGroupHint')}
											/>
										)}
									</Field>
								</div>
								<div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-3 xl:max-w-[66%]">
									<div>
										<Field label={<> {t('priority')} </>} hint={t('priorityHint')}>
											{(field) => (
												<Input
													{...field}
													type="number"
													required
													value={formData.priority}
													onChange={(e) =>
														onFormChange({
															...formData,
															priority: e.target.value,
														})
													}
													title={t('priorityHint')}
												/>
											)}
										</Field>
									</div>
									<div>
										<Field label={<> {t('weight')} </>} hint={t('weightHint')}>
											{(field) => (
												<Input
													{...field}
													type="number"
													required
													min={1}
													value={formData.weight}
													onChange={(e) =>
														onFormChange({
															...formData,
															weight: e.target.value,
														})
													}
													title={t('weightHint')}
												/>
											)}
										</Field>
									</div>
								</div>
							</div>
						</section>

						<div className="space-y-3">
							<RoutePricePanel
								variant="neutral"
								title={t('standardCatalog')}
								subtitle={
									selectedModelIsAudio
										? t('standardCatalogHintAudio')
										: selectedModelIsImage
										? t('standardCatalogHintImage')
										: t('standardCatalogHint')
								}
							>
								{selectedModelIsAudio ? (
									catalogAudioPricingDisplay ? (
										catalogAudioPricingDisplay.mode === 'token' ? (
											<ul className="divide-y divide-gray-100 rounded-md border route-border text-sm tabular-nums">
												<li className="flex items-baseline justify-between gap-3 px-3 py-2">
													<span className="text-xs route-muted">
														{tModels('audioInputPricePerM')}
													</span>
													<span className="font-medium route-text">
														{catalogAudioPricingDisplay.inputPrice}
														<span className="ml-1 text-[10px] font-normal route-muted">
															{catalogAudioPricingDisplay.unit}
														</span>
													</span>
												</li>
												<li className="flex items-baseline justify-between gap-3 px-3 py-2">
													<span className="text-xs route-muted">
														{tModels('audioOutputPricePerM')}
													</span>
													<span className="font-medium route-text">
														{catalogAudioPricingDisplay.outputPrice}
														<span className="ml-1 text-[10px] font-normal route-muted">
															{catalogAudioPricingDisplay.unit}
														</span>
													</span>
												</li>
											</ul>
										) : (
											<ul className="divide-y divide-gray-100 rounded-md border route-border text-sm tabular-nums">
												<li className="flex items-baseline justify-between gap-3 px-3 py-2">
													<span className="text-xs route-muted">{t('audioPricePerSecond')}</span>
													<span className="font-medium route-text">
														{catalogAudioPricingDisplay.pricePerSecond}
														<span className="ml-1 text-[10px] font-normal route-muted">
															{catalogAudioPricingDisplay.unit}
														</span>
													</span>
												</li>
												<li className="flex items-baseline justify-between gap-3 px-3 py-2">
													<span className="text-xs route-muted">{t('audioMinimumSeconds')}</span>
													<span className="font-medium route-text">
														{catalogAudioPricingDisplay.minimumSeconds}
													</span>
												</li>
											</ul>
										)
									) : (
										<p className="text-sm route-muted">
											{formData.model_id ? t('noCatalogAudioPricing') : t('selectModelForTiers')}
										</p>
									)
								) : selectedModelIsImage ? (
									<ReadOnlyImagePricing
										compact
										tokenRatesLayout="grid"
										display={catalogImagePricingDisplay}
										emptyLabel={
											formData.model_id ? t('noCatalogImagePricing') : t('selectModelForTiers')
										}
										tokenRatesTitle={t('imageTokenRates')}
									/>
								) : (
									<ReadOnlyPricingTiersTable
										rows={catalogStandardTierRows}
										emptyLabel={
											formData.model_id ? t('noCatalogPricing') : t('selectModelForTiers')
										}
										tableTitle={t('readOnlyCatalogRates')}
										billingCurrencyCode={billingCurrency}
									/>
								)}
							</RoutePricePanel>

							<p className="text-[11px] route-muted">
								{t('billingTimezoneHint', { timezone: businessTimezone })}
							</p>

							<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
								<div className="flex h-full min-h-0 min-w-0 flex-col">
									<RoutePricePanel
										fillHeight
										variant="charged"
										title={t('chargedCost')}
										subtitle={t('chargedCostHint')}
										headerEnd={
											<div className="flex flex-col items-end gap-1">
												<Field label={<> {t('chargedFactor')} </>}>
													{(field) => (
														<Input
															{...field}
															type="text"
															inputMode="decimal"
															value={formData.charged_factor}
															title={t('chargedFactorTitle')}
															onChange={(e) =>
																onFormChange({ ...formData, charged_factor: e.target.value })
															}
															placeholder="1"
														/>
													)}
												</Field>
											</div>
										}
									>
										<div>
											<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide route-muted">
												{t('dailySchedule')}
											</p>
											<DailyScheduleEditor
												windows={formData.schedule_charged}
												onChange={(schedule_charged) =>
													onFormChange({ ...formData, schedule_charged })
												}
												addLabel={t('addScheduleWindow')}
												emptyLabel={t('scheduleEmpty')}
												startLabel={t('scheduleStart')}
												endLabel={t('scheduleEnd')}
												factorLabel={t('scheduleFactor')}
												removeLabel={tCommon('delete')}
											/>
										</div>
									</RoutePricePanel>
								</div>

								<div className="flex h-full min-h-0 min-w-0 flex-col">
									<RoutePricePanel
										fillHeight
										variant="metered"
										title={t('meteredCost')}
										subtitle={t('meteredCostHint')}
										headerEnd={
											<div className="flex flex-col items-end gap-1">
												<Field label={<> {t('meteredFactor')} </>}>
													{(field) => (
														<Input
															{...field}
															type="text"
															inputMode="decimal"
															value={formData.metered_factor}
															title={t('meteredFactorTitle')}
															onChange={(e) =>
																onFormChange({ ...formData, metered_factor: e.target.value })
															}
															placeholder="1"
														/>
													)}
												</Field>
											</div>
										}
									>
										<div>
											<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide route-muted">
												{t('dailySchedule')}
											</p>
											<DailyScheduleEditor
												windows={formData.schedule_metered}
												onChange={(schedule_metered) =>
													onFormChange({ ...formData, schedule_metered })
												}
												addLabel={t('addScheduleWindow')}
												emptyLabel={t('scheduleEmpty')}
												startLabel={t('scheduleStart')}
												endLabel={t('scheduleEnd')}
												factorLabel={t('scheduleFactor')}
												removeLabel={tCommon('delete')}
											/>
										</div>
									</RoutePricePanel>
								</div>
							</div>
						</div>

						<section className="rounded-lg border route-border route-surface p-3.5">
							<div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h3 className="text-xs font-semibold uppercase tracking-wide route-muted">
									{t('requestDefaults')}
								</h3>
								<p className="text-[11px] route-muted">{t('requestDefaultsHint')}</p>
							</div>
							<Field label={<> {t('customParams')} </>}>
								{(field) => (
									<Textarea
										{...field}
										rows={4}
										value={formData.custom_params_json}
										onChange={(e) =>
											onFormChange({ ...formData, custom_params_json: e.target.value })
										}
										placeholder={t('customParamsPlaceholder')}
										spellCheck={false}
									/>
								)}
							</Field>
						</section>

						<section className="rounded-lg border route-border route-surface p-4">
							<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide route-muted">
								{t('summary')}
							</h3>
							<div className="grid grid-cols-1 gap-2 text-xs route-muted md:grid-cols-2">
								<p>
									<span className="font-medium route-text">{t('summaryRoute')}</span>{' '}
									<span className="font-mono">{formData.model_id || '—'}</span> →{' '}
									<span className="font-mono">{formData.provider_id || '—'}</span> /{' '}
									<span className="font-mono">{formData.provider_model_name || '—'}</span>
								</p>
								<p>
									<span className="font-medium route-text">{t('summaryRouting')}</span>{' '}
									<span className="font-mono">{formData.upstream_protocol}</span> ·{' '}
									{t('summaryGroup')}{' '}
									<span className="font-mono">{formData.route_group.trim() || 'default'}</span> ·{' '}
									{t('summaryPriority')} <span className="font-mono">{formData.priority}</span> ·{' '}
									{t('summaryStatus')}{' '}
									<span className="font-mono">
										{editingRoute ? editingRoute.status : 'inactive'}
									</span>
									{!editingRoute && (
										<span className="route-muted"> {t('summaryEnableFromList')}</span>
									)}
								</p>
								<p>
									<span className="font-medium route-text">{t('summaryUserBilling')}</span>{' '}
									<span className="font-mono">{t('summaryUserBillingDetail')}</span>
								</p>
								<p>
									<span className="font-medium route-text">{t('summaryMeteredCost')}</span>{' '}
									<span className="font-mono">{t('summaryMeteredCostDetail')}</span>
								</p>
							</div>
						</section>
					</div>
				</fieldset>
			</form>
			<Dialog
				open={feedback.showDelete}
				onOpenChange={(next) => {
					if (!next && !busy) feedback.closeDelete();
				}}
				preventOutsideDismissal={busy}
				title={f('deleteTitle')}
				description={f('deleteDescription', { id: editingRoute?.id ?? '' })}
				finalFocus={feedback.deleteReturnFocus}
				footer={
					<>
						<ControlButton variant="outline" disabled={busy} onClick={feedback.closeDelete}>
							{tCommon('cancel')}
						</ControlButton>
						<ControlButton
							variant="danger"
							disabled={busy}
							loading={isDeleting}
							onClick={props.onConfirmDelete}
						>
							{t('deleteRoute')}
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

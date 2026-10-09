'use client';

/**
 * 模型路由：`model_routes` CRUD、协议与 route_group、URL 查询参数驱动列表筛选（`useSearchParams` + Suspense）。
 * 模型卡片标题 / 铅笔图标可就地打开 ModelModal（改 Tag 等），无需跳转 Models 页。
 */
import { ControlButton, EmptyState, PageHeader, Spinner } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import './routes.css';
import { Suspense, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ModelModal } from '../models/components/model-modal';
import { useRoutesPageState } from './use-routes-page-state';
import { RouteFilterSidebar } from './components/route-filter-sidebar';
import { RouteFlowOverview } from './components/route-flow-overview';
import { RouteModal } from './components/route-modal';
import { RoutePolicyDialog } from './components/route-policy-dialog';
import { RouteVendorGroup } from './components/route-vendor-group';

function RoutesContent() {
	const t = useTranslations('routes'),
		tCommon = useTranslations('common'),
		shell = useTranslations('shell');
	const { attachModelSuccessFocus: modelSuccessFocusRef, ...state } = useRoutesPageState();
	const { openEditById } = state.modelEdit;
	const editModel = useCallback((modelId: string) => void openEditById(modelId), [openEditById]);
	return (
		<div className="route-page">
			<div ref={modelSuccessFocusRef} tabIndex={-1}>
				<PageHeader
					title={t('title')}
					description={t('subtitle')}
					actions={
						<ControlButton
							disabled={state.isLoading || !!state.readFailure || state.busy}
							onClick={() => state.handleCreate()}
						>
							{t('workspace.newRoute')}
						</ControlButton>
					}
				/>
			</div>
			<RouteFlowOverview />
			{state.isLoading ? (
				<Spinner label={tCommon('loading')} />
			) : state.readFailure ? (
				<ShellError
					title={tCommon('failedToLoadRoutes')}
					failure={state.readFailure}
					action={
						<ControlButton variant="outline" onClick={() => void state.refreshRoutesPage()}>
							{shell('retry')}
						</ControlButton>
					}
				/>
			) : (
				<>
					{state.actionFailure && !state.showModal && !state.strategyDialog ? (
						<ShellError
							title={state.actionFailure.title}
							failure={state.actionFailure.failure}
							uncertainWrite={state.actionFailure.uncertain}
							action={
								<ControlButton variant="outline" onClick={() => void state.refreshRoutesPage()}>
									{shell('retry')}
								</ControlButton>
							}
						/>
					) : null}
					<fieldset disabled={state.busy} className="route-workspace">
						<RouteFilterSidebar
							visibleModelCount={state.visibleModelCount}
							visibleRouteCount={state.visibleRouteCount}
							hasActiveFilters={state.hasActiveFilters}
							filterStatus={state.filterStatus}
							filterKind={state.filterKind}
							filterRouteGroup={state.filterRouteGroup}
							filterVendor={state.filterVendor}
							filterProviderId={state.filterProviderId}
							statusCounts={state.statusCounts}
							kindCounts={state.kindCounts}
							routesCount={state.routes.length}
							routeGroupFilterOptions={state.routeGroupFilterOptions}
							routeGroupCounts={state.routeGroupCounts}
							vendorFilterOptions={state.vendorFilterOptions}
							providers={state.providers}
							providerRouteCounts={state.providerRouteCounts}
							onFilterStatusChange={state.setFilterStatus}
							onFilterKindChange={state.setFilterKind}
							onFilterRouteGroupChange={state.setFilterRouteGroup}
							onFilterVendorChange={state.setFilterVendor}
							onFilterProviderIdChange={state.setFilterProviderId}
							onClearAllFilters={state.clearAllFilters}
						/>
						<section className="route-list" aria-label={t('workspace.title')}>
							{state.routesByModel.length === 0 ? (
								<EmptyState
									title={t('empty')}
									action={
										state.hasActiveFilters ? (
											<ControlButton variant="outline" onClick={state.clearAllFilters}>
												{tCommon('clearAllFilters')}
											</ControlButton>
										) : undefined
									}
								/>
							) : (
								state.routeCardVendorGroups.map(({ vendor, cards, showHeader }, vendorGroupIdx) => (
									<RouteVendorGroup
										key={vendor}
										vendor={vendor}
										cards={cards}
										showHeader={showHeader}
										vendorGroupIdx={vendorGroupIdx}
										modelMeta={state.modelMeta}
										providerMeta={state.providerMeta}
										globalRouteStrategy={state.globalRouteStrategy}
										copiedModelId={state.copiedModelId}
										togglingId={state.togglingId}
										onCopyModelId={state.copyModelId}
										onCreate={state.handleCreate}
										onEdit={state.handleEdit}
										onEditModel={editModel}
										onToggleStatus={state.handleToggleStatus}
										onOpenStrategyDialog={state.handleOpenStrategyDialog}
									/>
								))
							)}
						</section>
					</fieldset>
				</>
			)}
			<RouteModal
				open={state.showModal}
				feedback={state}
				editingRoute={state.editingRoute}
				duplicateSourceRouteId={state.duplicateSourceRouteId}
				formData={state.formData}
				saveError={state.saveError}
				isSaving={state.isSaving}
				isDeleting={state.isDeleting}
				billingCurrency={state.billingCurrency}
				models={state.models}
				providers={state.providers}
				selectedModel={state.selectedModel}
				selectedProvider={state.selectedProvider}
				catalogStandardTierRows={state.catalogStandardTierRows}
				catalogImagePricingDisplay={state.catalogImagePricingDisplay}
				catalogAudioPricingDisplay={state.catalogAudioPricingDisplay}
				selectedModelIsImage={state.selectedModelIsImage}
				selectedModelIsAudio={state.selectedModelIsAudio}
				allowedProtocolsForProvider={state.allowedProtocolsForProvider}
				businessTimezone={state.businessTimezone}
				onClose={state.closeRouteModal}
				onFormChange={state.setFormData}
				onSave={() => void state.handleSave()}
				onDelete={state.openDelete}
				onConfirmDelete={() => {
					if (state.editingRoute) void state.handleDelete(state.editingRoute.id);
				}}
				onDuplicate={() => {
					if (state.editingRoute) state.handleDuplicate(state.editingRoute);
				}}
			/>

			<ModelModal
				open={state.modelEdit.showModal}
				feedback={state.modelEdit}
				editingModel={state.modelEdit.editingModel}
				formData={state.modelEdit.formData}
				formKind={state.modelEdit.formKind}
				pricingTierRows={state.modelEdit.pricingTierRows}
				imageBillingMode={state.modelEdit.imageBillingMode}
				onImageBillingModeChange={state.modelEdit.setImageBillingMode}
				imagePerImageDraft={state.modelEdit.imagePerImageDraft}
				onImagePerImageDraftChange={state.modelEdit.setImagePerImageDraft}
				audioPricingDraft={state.modelEdit.audioPricingDraft}
				onAudioPricingDraftChange={state.modelEdit.setAudioPricingDraft}
				tagInput={state.modelEdit.tagInput}
				saveError={state.modelEdit.saveError}
				isSaving={state.modelEdit.isSaving}
				isDeleting={state.modelEdit.isDeleting}
				billingCurrency={state.modelEdit.billingCurrency}
				onClose={state.modelEdit.closeModal}
				onFormChange={state.modelEdit.setFormData}
				onPricingTierRowsChange={state.modelEdit.setPricingTierRows}
				onTagInputChange={state.modelEdit.setTagInput}
				onAddTag={state.modelEdit.handleAddTag}
				onRemoveTag={state.modelEdit.handleRemoveTag}
				onToggleModality={state.modelEdit.toggleFormModality}
				onKindChange={state.modelEdit.applyFormKind}
				onSave={() => void state.modelEdit.handleSave()}
				onDelete={(id) => void state.modelEdit.handleDelete(id)}
			/>

			{state.strategyDialog ? (
				<RoutePolicyDialog
					dialog={state.strategyDialog}
					feedback={state}
					form={state.strategyForm}
					error={state.strategyError}
					saving={state.strategySaving}
					onClose={state.closeStrategyDialog}
					onFormChange={state.setStrategyForm}
					onSave={() => void state.handleSaveStrategy()}
				/>
			) : null}
		</div>
	);
}
export default function GatewayRoutesPage() {
	const common = useTranslations('common');
	return (
		<Suspense fallback={<Spinner label={common('loading')} />}>
			<RoutesContent />
		</Suspense>
	);
}

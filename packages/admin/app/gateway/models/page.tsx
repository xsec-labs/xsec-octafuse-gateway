'use client';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
	PageHeader,
	ControlButton,
	Input,
	EmptyState,
	Spinner,
	Toolbar,
	Badge,
} from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import ShellError from '@/components/layout/ShellError';
import { useModelsPageState } from './use-models-page-state';
import { ModelCard } from './components/model-card';
import { ModelFilterSidebar } from './components/model-filter-sidebar';
import { ModelModal } from './components/model-modal';
import { ModelMetadataPreviewModal } from './components/model-metadata-preview-modal';
import './models.css';
const ModelImportModal = dynamic(() =>
	import('./components/model-import-modal').then((m) => m.ModelImportModal)
);
function ModelsContent() {
	const t = useTranslations('models'),
		brand = useTranslations('brand'),
		common = useTranslations('common'),
		feedback = useTranslations('models.feedback'),
		{ attachSuccessFocus: successFocusRef, ...state } = useModelsPageState();
	const ready =
		state.list.status === 'ready' && state.currencyState.status === 'ready';
	return (
		<div
			className="model-page"
			ref={successFocusRef}
			tabIndex={-1}
			aria-label={t('title')}
		>
			<PageHeader
				title={t('title')}
				description={t('subtitle', { product: brand('product') })}
				actions={
					<>
						<ControlButton
							variant="outline"
							onClick={state.openImportCatalogModal}
							disabled={!ready || state.importSubmitting}
						>
							{common('import')}
						</ControlButton>
						<ControlButton
							onClick={() =>
								state.handleCreate(
									state.isAllVendors ? undefined : state.activeVendorKey,
									state.selectedKind
								)
							}
							disabled={!ready || state.importSubmitting}
						>
							{common('new')}
						</ControlButton>
					</>
				}
			/>
			{state.list.status === 'loading' ||
			state.currencyState.status === 'loading' ? (
				<Spinner label={common('loading')} />
			) : null}
			{state.list.status === 'error' ? (
				<ShellError
					title={feedback('listFailed')}
					failure={state.list.failure}
					action={
						<ControlButton onClick={() => void state.refreshModels()}>
							{feedback('readList')}
						</ControlButton>
					}
				/>
			) : null}
			{state.currencyState.status === 'error' ? (
				<ShellError
					title={feedback('currencyFailed')}
					failure={state.currencyState.failure}
					action={
						<ControlButton onClick={() => void state.loadCurrency()}>
							{feedback('readCurrency')}
						</ControlButton>
					}
				/>
			) : null}
			{ready ? (
				<>
					<ModelFilterSidebar
						modelCount={state.models.length}
						hasActiveFilter={state.hasActiveFilter}
						selectedVendorItemsCount={state.selectedVendorItems.length}
						isAllVendors={state.isAllVendors}
						selectedVendor={state.selectedVendor}
						modelsByVendor={state.modelsByVendor}
						selectedKind={state.selectedKind}
						kindCounts={state.kindCounts}
						onSelectVendor={state.setSelectedVendor}
						onSelectKind={state.setSelectedKind}
						onClearFilter={state.clearFilters}
					/>
					<Toolbar className="model-toolbar">
						<Input
							type="search"
							aria-label={feedback('search')}
							placeholder={feedback('search')}
							value={state.modelSearch}
							onChange={(event) => state.setModelSearch(event.target.value)}
						/>
						<Badge>
							{state.filteredModels.length} / {state.selectedVendorItems.length}
						</Badge>
					</Toolbar>
					{state.filteredModels.length ? (
						<section className="model-list" aria-label={t('title')}>
							{state.filteredModels.map((model) => (
								<ModelCard
									key={model.id}
									model={model}
									billingCurrency={state.billingCurrency}
									onEdit={state.handleEdit}
									onViewMetadata={state.openMetadataPreview}
								/>
							))}
						</section>
					) : (
						<EmptyState
							title={state.models.length ? t('import.noMatch') : t('empty')}
							description={state.models.length ? undefined : t('emptyHint')}
						/>
					)}
				</>
			) : null}
			<ModelModal
				open={state.showModal}
				feedback={state}
				editingModel={state.editingModel}
				formData={state.formData}
				formKind={state.formKind}
				pricingTierRows={state.pricingTierRows}
				imageBillingMode={state.imageBillingMode}
				onImageBillingModeChange={state.setImageBillingMode}
				imagePerImageDraft={state.imagePerImageDraft}
				onImagePerImageDraftChange={state.setImagePerImageDraft}
				audioPricingDraft={state.audioPricingDraft}
				onAudioPricingDraftChange={state.setAudioPricingDraft}
				tagInput={state.tagInput}
				saveError={state.saveError}
				isSaving={state.isSaving}
				isDeleting={state.isDeleting}
				billingCurrency={state.billingCurrency}
				onClose={state.closeModal}
				onFormChange={state.setFormData}
				onPricingTierRowsChange={state.setPricingTierRows}
				onTagInputChange={state.setTagInput}
				onAddTag={state.handleAddTag}
				onRemoveTag={state.handleRemoveTag}
				onToggleModality={state.toggleFormModality}
				onKindChange={state.applyFormKind}
				onSave={state.handleSave}
				onDelete={state.handleDelete}
			/>

			{state.metadataPreview ? (
				<ModelMetadataPreviewModal
					preview={state.metadataPreview}
					onClose={() => state.setMetadataPreview(null)}
				/>
			) : null}
			{state.showImportCatalogModal ? <ModelImportModal state={state} /> : null}
		</div>
	);
}
export default function GatewayModelsPage() {
	const t = useTranslations('common');
	return (
		<Suspense fallback={<Spinner label={t('loading')} />}>
			<ModelsContent />
		</Suspense>
	);
}

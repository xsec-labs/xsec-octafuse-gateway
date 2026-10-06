'use client';
import dynamic from 'next/dynamic';
import { Badge, ControlButton, EmptyState, ErrorState, PageHeader, Spinner } from '@xsec/ui-react';
import { ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import ShellError from '@/components/layout/ShellError';
import { ProviderCard } from './components/provider-card';
import { ProviderToolbar } from './components/provider-toolbar';
import { useProvidersPageState } from './use-providers-page-state';
import './providers.css';
import ProviderModal from './components/provider-modal';
const ProviderImportModal = dynamic(() => import('./components/provider-import-modal'));
export default function GatewayProvidersPage() {
	const t = useTranslations('providers'),
		brand = useTranslations('brand'),
		common = useTranslations('common'),
		feedback = useTranslations('providers.feedback');
	const { attachNewProviderAction: newProviderActionRef, ...state } = useProvidersPageState();
	return (
		<div className="provider-page">
			<PageHeader
				title={t('title')}
				description={
					<>
						{t('subtitle', { product: brand('product') })}
						<span className="provider-intro-hint">{t('importHint')}</span>
					</>
				}
				actions={
					<>
						<ControlButton
							variant="outline"
							onClick={state.openImportModal}
							disabled={state.writeBusy}
						>
							<ArrowDownTrayIcon aria-hidden />
							{common('import')}
						</ControlButton>
						<ControlButton
							ref={newProviderActionRef}
							onClick={state.handleCreate}
							disabled={state.writeBusy}
						>
							<PlusIcon aria-hidden />
							{common('new')}
						</ControlButton>
					</>
				}
			/>
			{state.actionFailure && !state.showModal && !state.showImportModal ? (
				<ShellError
					title={state.actionFailure.title}
					failure={state.actionFailure.failure}
					uncertainWrite={state.actionFailure.uncertain}
					action={
						<ControlButton variant="secondary" onClick={() => void state.refreshProviders()}>
							{feedback('readList')}
						</ControlButton>
					}
				/>
			) : null}
			{state.clipboardFailure ? <ErrorState title={feedback('clipboardFailed')} /> : null}
			{state.copiedId ? (
				<span role="status" className="provider-copy-feedback">
					<Badge tone="success">{common('copied')}</Badge>
				</span>
			) : null}
			{state.list.status === 'loading' ? (
				<div className="provider-loading">
					<Spinner label={common('loading')} />
				</div>
			) : state.list.status === 'error' ? (
				<div className="provider-loading">
					<ShellError
						title={feedback('listFailed')}
						failure={state.list.failure}
						action={
							<ControlButton onClick={() => void state.refreshProviders()}>
								{feedback('readList')}
							</ControlButton>
						}
					/>
				</div>
			) : (
				<>
					<ProviderToolbar
						providerSearch={state.providerSearch}
						filteredCount={state.filteredProviders.length}
						totalCount={state.providers.length}
						onSearchChange={state.setProviderSearch}
					/>
					{state.filteredProviders.length ? (
						<section className="provider-list" aria-label={t('title')}>
							{state.filteredProviders.map((provider) => (
								<ProviderCard
									key={provider.id}
									provider={provider}
									copiedId={state.copiedId}
									copyingId={state.copyingId}
									writeBusy={state.writeBusy}
									writeKind={state.writeKind}
									onMount={state.restoreStatusFocus}
									onEdit={state.handleEdit}
									onToggleStatus={state.handleToggleStatus}
									onCopyApiKey={state.handleCopyApiKey}
								/>
							))}
						</section>
					) : (
						<EmptyState title={state.providerSearch.trim() ? t('emptySearch') : t('empty')} />
					)}
				</>
			)}
			{state.showModal ? (
				<ProviderModal
					open={state.showModal}
					editingProvider={state.editingProvider}
					duplicateSourceId={state.duplicateSourceId}
					formData={state.formData}
					validation={state.validation}
					actionFailure={state.actionFailure}
					busy={state.writeBusy}
					writeKind={state.writeKind}
					showDelete={state.showDelete}
					onShowDelete={state.setShowDelete}
					onClose={state.closeProviderModal}
					onFormChange={state.setFormData}
					onSave={state.handleSave}
					onDelete={state.handleDelete}
					onDuplicate={state.handleDuplicate}
					onRead={() => void state.refreshProviders()}
					finalFocus={state.returnFocus}
				/>
			) : null}
			{state.showImportModal ? (
				<ProviderImportModal
					open={state.showImportModal}
					catalog={state.catalog}
					filteredCatalogRows={state.filteredImportCatalogRows}
					catalogSearch={state.importCatalogSearch}
					selected={state.importSelected}
					selectedCount={state.importSelectedCount}
					busy={state.writeBusy}
					result={state.importResult}
					actionFailure={state.actionFailure}
					onClose={state.closeImportModal}
					onRead={() => void state.loadImportCatalog()}
					onReadList={() => void state.refreshProviders()}
					onCatalogSearchChange={state.setImportCatalogSearch}
					onSelectAll={state.selectAllImportPresets}
					onClearSelection={state.clearImportPresetSelection}
					onTogglePreset={state.toggleImportPreset}
					onImport={state.runImportSelectedPresets}
					finalFocus={state.returnFocus}
				/>
			) : null}
		</div>
	);
}

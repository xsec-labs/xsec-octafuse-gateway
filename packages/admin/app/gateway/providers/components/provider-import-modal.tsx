'use client';
import {
	Checkbox,
	ControlButton,
	ControlIconButton,
	Dialog,
	EmptyState,
	Input,
	Spinner,
	Toolbar,
} from '@xsec/ui-react';
import type { ComponentProps } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { parseProviderEndpoints } from '@octafuse/core/provider-endpoints';
import { VendorIcon } from '@/components/model-vendor-icon';
import { summarizeOpenAiImportEndpoints } from '@/lib/provider-import-preset';
import ShellError from '@/components/layout/ShellError';
import type { ShellFailure } from '@/lib/shell-request';
import { useTranslations } from 'next-intl';
import type { ProviderImportCatalogRow, ProviderImportResult } from '../types';
type Catalog =
	| { status: 'loading' }
	| { status: 'error'; failure: ShellFailure }
	| { status: 'ready'; rows: ProviderImportCatalogRow[] };
type Props = {
	open: boolean;
	catalog: Catalog;
	filteredCatalogRows: ProviderImportCatalogRow[];
	catalogSearch: string;
	selected: Record<string, boolean>;
	selectedCount: number;
	busy: boolean;
	result: ProviderImportResult | null;
	actionFailure: { title: string; failure: ShellFailure; uncertain: boolean } | null;
	onClose: () => void;
	onRead: () => void;
	onReadList: () => void;
	onCatalogSearchChange: (value: string) => void;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onTogglePreset: (id: string) => void;
	onImport: () => void;
	finalFocus: ComponentProps<typeof Dialog>['finalFocus'];
};
export default function ProviderImportModal(props: Props) {
	const {
		open,
		catalog,
		filteredCatalogRows,
		catalogSearch,
		selected,
		selectedCount,
		busy,
		result,
		actionFailure,
		onClose,
		onRead,
		onReadList,
		onCatalogSearchChange,
		onSelectAll,
		onClearSelection,
		onTogglePreset,
		onImport,
		finalFocus,
	} = props;
	const t = useTranslations('providers.import'),
		common = useTranslations('common'),
		feedback = useTranslations('providers.feedback');
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && !busy) onClose();
			}}
			preventOutsideDismissal={busy}
			title={t('title')}
			description={t('subtitle')}
			className="provider-dialog provider-import-dialog"
			finalFocus={finalFocus}
			footer={
				<>
					<ControlButton variant="outline" disabled={busy} onClick={onClose}>
						{common('cancel')}
					</ControlButton>
					<ControlButton
						loading={busy}
						disabled={busy || catalog.status !== 'ready' || selectedCount === 0}
						onClick={onImport}
					>
						{t('importSelected', { count: selectedCount })}
					</ControlButton>
				</>
			}
		>
			{actionFailure ? (
				<ShellError
					title={actionFailure.title}
					failure={actionFailure.failure}
					uncertainWrite={actionFailure.uncertain}
					action={
						<ControlButton variant="secondary" onClick={onReadList}>
							{feedback('readList')}
						</ControlButton>
					}
				/>
			) : null}
			{result ? (
				<section className="provider-import-result" role="status">
					<strong>{feedback('importResult', { count: result.created })}</strong>
					{result.failed.length ? (
						<ul>
							{result.failed.map((row, index) => (
								<li key={row.id + index}>
									<code>{row.id}</code>: {feedback('importRowFailed')}
								</li>
							))}
						</ul>
					) : (
						<p>{feedback('importComplete')}</p>
					)}
				</section>
			) : null}
			<Toolbar className="provider-import-toolbar">
				<div className="provider-search">
					<Input
						type="search"
						value={catalogSearch}
						onChange={(event) => onCatalogSearchChange(event.target.value)}
						aria-label={t('searchPlaceholder')}
						placeholder={t('searchPlaceholder')}
						autoComplete="off"
						disabled={busy}
					/>
					{catalogSearch ? (
						<ControlIconButton
							label={t('clearSearch')}
							disabled={busy}
							onClick={() => onCatalogSearchChange('')}
						>
							<XMarkIcon aria-hidden />
						</ControlIconButton>
					) : null}
				</div>
				<ControlButton
					variant="outline"
					onClick={onSelectAll}
					disabled={busy || catalog.status !== 'ready' || !filteredCatalogRows.length}
				>
					{common('selectAll')}
				</ControlButton>
				<ControlButton variant="ghost" onClick={onClearSelection} disabled={busy || !selectedCount}>
					{t('clear')}
				</ControlButton>
				<span role="status">
					{common('selected', { count: selectedCount })}
					{catalog.status === 'ready'
						? ' ' +
						  t('selectedShowing', {
								filtered: filteredCatalogRows.length,
								total: catalog.rows.length,
						  })
						: null}
				</span>
			</Toolbar>
			{catalog.status === 'loading' ? (
				<Spinner label={t('loadingCatalog')} />
			) : catalog.status === 'error' ? (
				<ShellError
					title={feedback('catalogFailed')}
					failure={catalog.failure}
					action={<ControlButton onClick={onRead}>{feedback('readCatalog')}</ControlButton>}
				/>
			) : !catalog.rows.length ? (
				<EmptyState title={t('catalogEmpty')} />
			) : !filteredCatalogRows.length ? (
				<EmptyState title={t('noMatch')} />
			) : (
				<ul className="provider-template-list">
					{filteredCatalogRows.map((row) => {
						const openai = summarizeOpenAiImportEndpoints(
							parseProviderEndpoints({ endpoints: row.endpoints }),
						);
						return (
							<li key={row.id}>
								<Checkbox
									checked={Boolean(selected[row.id])}
									disabled={busy}
									onCheckedChange={() => onTogglePreset(row.id)}
									label={
										<div className="provider-template">
											<VendorIcon vendor={row.vendor_key} iconKey={row.icon_key} size="compact" />
											<div>
												<strong>{row.name}</strong>
												<p>
													{row.vendor_label} · {t('protocols')}: {row.protocols.join(', ') || '—'}
												</p>
												{openai ? (
													<p className="provider-endpoint">
														{t(openai.hasBase ? 'openaiBase' : 'openaiChat', { url: openai.url })}
														{openai.capabilities.length
															? ' ' + t('openaiCaps', { caps: openai.capabilities.join(', ') })
															: null}
													</p>
												) : null}
												{row.description ? <p>{row.description}</p> : null}
											</div>
										</div>
									}
								/>
							</li>
						);
					})}
				</ul>
			)}
		</Dialog>
	);
}

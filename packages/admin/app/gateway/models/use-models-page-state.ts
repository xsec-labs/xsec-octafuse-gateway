'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
	isTextLlmModel,
} from '@octafuse/core/db/model-modalities';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import {
	getModelVendorLabel,
	normalizeModelVendorInput,
} from '@/lib/model-vendor';
import { parseModels, parseModelCatalog, parseModelImport } from './model-api';
import {
	buildMetadataSummary,
	groupModelsByVendor,
	parseVendorFilterParam,
} from './model-utils';
import {
	ALL_VENDORS_KEY,
	DEFAULT_KIND_FILTER,
	parseKindFilterParam,
	type ModelKindFilter,
	type ModelListItem,
	type PresetCatalogRow,
	type MetadataPreviewState,
	type ModelImportResult,
} from './types';
import {
	useModelEditModal,
	type ModelReadState,
	type ModelActionFailure,
} from './use-model-edit-modal';
export function useModelsPageState() {
	const t = useTranslations('models.feedback'),
		tCatalog = useTranslations('models.catalog');
	const searchParams = useSearchParams(),
		router = useRouter(),
		pathname = usePathname(),
		editHandled = useRef<string | null>(null);
	const [list, setList] = useState<ModelReadState<ModelListItem[]>>({
		status: 'loading',
	});
	const { run: readList } = useShellRequest(),
		{ run: readCatalog, cancel: cancelCatalog } = useShellRequest(),
		{ run: write } = useShellRequest();
	const [catalog, setCatalog] = useState<
		ModelReadState<{ currency: string; rows: PresetCatalogRow[] }>
	>({ status: 'loading' });
	const [showImportCatalogModal, setShowImportCatalogModal] = useState(false),
		[importSelected, setImportSelected] = useState<Record<string, boolean>>({}),
		[importCatalogSearch, setImportCatalogSearch] = useState(''),
		[importCatalogKind, setImportCatalogKind] =
			useState<ModelKindFilter>(DEFAULT_KIND_FILTER),
		[importSubmitting, setImportSubmitting] = useState(false),
		[importResult, setImportResult] = useState<ModelImportResult | null>(null),
		[importFailure, setImportFailure] = useState<ModelActionFailure | null>(
			null
		),
		importBusy = useRef(false);
	const [metadataPreview, setMetadataPreview] =
		useState<MetadataPreviewState | null>(null);
	const [modelSearch, setModelSearch] = useState('');
	const authorizedFailure = useCallback(
		(failure: ShellFailure, record: () => void) => {
			if (failure.status === 401) notifyAdminSessionExpired();
			else record();
		},
		[]
	);
	const loadModels = useCallback(async () => {
		await readList(
			'/api/admin/models',
			{},
			parseModels,
			(value) => setList({ status: 'ready', value }),
			(failure) =>
				authorizedFailure(failure, () => setList({ status: 'error', failure }))
		);
	}, [readList, authorizedFailure]);
	useEffect(() => {
		void loadModels();
	}, [loadModels]);
	const refreshModels = useCallback(async () => {
		setList({ status: 'loading' });
		await loadModels();
	}, [loadModels]);
	const successFocus = useRef<HTMLDivElement | null>(null);
	const attachSuccessFocus = useCallback((element: HTMLDivElement | null) => { successFocus.current = element; }, []);
	const editor = useModelEditModal({ onChanged: refreshModels, successFocus });
	const models = useMemo(
		() => (list.status === 'ready' ? list.value : []),
		[list]
	);
	const selectedVendor = parseVendorFilterParam(searchParams.get('vendor')),
		selectedKind = parseKindFilterParam(searchParams.get('kind'));
	const replaceFilter = useCallback(
		(key: string, value: string) => {
			const params = new URLSearchParams(searchParams.toString());
			params.set(key, value);
			router.replace(pathname + '?' + params.toString(), { scroll: false });
		},
		[searchParams, router, pathname]
	);
	const setSelectedVendor = useCallback(
		(value: string) => replaceFilter('vendor', value),
		[replaceFilter]
	);
	const setSelectedKind = useCallback(
		(value: ModelKindFilter) => replaceFilter('kind', value),
		[replaceFilter]
	);
	const importCatalogRows = useMemo(
		() => (catalog.status === 'ready' ? catalog.value.rows : []),
		[catalog]
	);
	const openMetadataPreview = useCallback((model: ModelListItem) => {
		const summary = buildMetadataSummary(model.metadata);
		if (summary.kind !== 'empty') setMetadataPreview({ model, summary });
	}, []);
	const importSelectedCount = useMemo(
		() => Object.values(importSelected).filter(Boolean).length,
		[importSelected]
	);

	const existingModelIds = useMemo(
		() => new Set(models.map((m) => m.id)),
		[models]
	);

	const importableCatalogCount = useMemo(
		() => importCatalogRows.filter((r) => !existingModelIds.has(r.id)).length,
		[importCatalogRows, existingModelIds]
	);

	const importCatalogKindCounts = useMemo(() => {
		let llm = 0;
		let image = 0;
		let audio = 0;
		for (const row of importCatalogRows) {
			if (row.kind === 'image') image += 1;
			else if (row.kind === 'audio') audio += 1;
			else llm += 1;
		}
		return { llm, image, audio };
	}, [importCatalogRows]);

	const filteredImportCatalogRows = useMemo(() => {
		const query = importCatalogSearch.trim().toLowerCase();
		return importCatalogRows.filter((row) => {
			if (row.kind !== importCatalogKind) return false;
			if (!query) return true;
			const id = row.id.toLowerCase();
			const name = (row.display_name ?? '').toLowerCase();
			const vendor = row.vendor.toLowerCase();
			const description = [
				row.description ?? '',
				row.i18n?.en ?? '',
				row.i18n?.zh ?? '',
			]
				.join(' ')
				.toLowerCase();
			return (
				id.includes(query) ||
				name.includes(query) ||
				vendor.includes(query) ||
				description.includes(query)
			);
		});
	}, [importCatalogSearch, importCatalogKind, importCatalogRows]);

	const kindFilteredModels = useMemo(() => {
		if (selectedKind === 'image') {
			return models.filter((m) => isImageGenerationModel(m));
		}
		if (selectedKind === 'audio') {
			return models.filter((m) => isAudioTranscriptionModel(m));
		}
		return models.filter((m) => isTextLlmModel(m));
	}, [models, selectedKind]);

	const modelsByVendor = useMemo(
		() => groupModelsByVendor(kindFilteredModels),
		[kindFilteredModels]
	);

	const kindCounts = useMemo(() => {
		let llm = 0;
		let image = 0;
		let audio = 0;
		for (const m of models) {
			if (isImageGenerationModel(m)) image += 1;
			else if (isAudioTranscriptionModel(m)) audio += 1;
			else llm += 1;
		}
		return { llm, image, audio };
	}, [models]);

	const selectedVendorItems = useMemo(() => {
		if (selectedVendor === ALL_VENDORS_KEY) {
			return modelsByVendor.flatMap(([, items]) => items);
		}
		const entry = modelsByVendor.find(([key]) => key === selectedVendor);
		return entry?.[1] ?? [];
	}, [modelsByVendor, selectedVendor]);

	const filteredModels = useMemo(() => {
		const q = modelSearch.trim().toLowerCase();
		return selectedVendorItems.filter(
			(m) =>
				!q ||
				[m.id, m.display_name ?? '', m.description ?? '', ...m.tags]
					.join(' ')
					.toLowerCase()
					.includes(q)
		);
	}, [selectedVendorItems, modelSearch]);
	const loadImportCatalog = useCallback(async () => {
		if (importBusy.current) return;
		setCatalog({ status: 'loading' });
		setImportSelected({});
		await readCatalog(
			'/api/admin/models/import/catalog',
			{},
			parseModelCatalog,
			(value) => setCatalog({ status: 'ready', value }),
			(failure) =>
				authorizedFailure(failure, () =>
					setCatalog({ status: 'error', failure })
				)
		);
	}, [readCatalog, authorizedFailure]);
	const openImportCatalogModal = useCallback(() => {
		setShowImportCatalogModal(true);
		setImportCatalogSearch('');
		setImportCatalogKind(selectedKind);
		setImportSelected({});
		setImportResult(null);
		setImportFailure(null);
		void loadImportCatalog();
	}, [selectedKind, loadImportCatalog]);
	const closeImportCatalogModal = useCallback(() => {
		if (importBusy.current) return;
		cancelCatalog();
		setShowImportCatalogModal(false);
	}, [cancelCatalog]);
	const toggleImportPreset = useCallback(
		(id: string) => {
			if (importBusy.current || existingModelIds.has(id)) return;
			setImportSelected((prev) => ({ ...prev, [id]: !prev[id] }));
		},
		[existingModelIds]
	);
	const selectAllImportPresets = useCallback(() => {
		if (importBusy.current) return;
		setImportSelected((prev) => ({
			...prev,
			...Object.fromEntries(
				filteredImportCatalogRows
					.filter((r) => !existingModelIds.has(r.id))
					.map((r) => [r.id, true])
			),
		}));
	}, [filteredImportCatalogRows, existingModelIds]);
	const clearImportPresetSelection = useCallback(() => {
		if (!importBusy.current) setImportSelected({});
	}, []);
	const runImportSelectedPresets = useCallback(async () => {
		if (
			importBusy.current ||
			catalog.status !== 'ready' ||
			list.status !== 'ready'
		)
			return;
		const ids = importCatalogRows
			.filter((r) => importSelected[r.id] && !existingModelIds.has(r.id))
			.map((r) => r.id);
		if (!ids.length) return;
		importBusy.current = true;
		setImportSubmitting(true);
		setImportResult(null);
		setImportFailure(null);
		await write(
			'/api/admin/models/import',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			},
			parseModelImport,
			(result) => {
				importBusy.current = false;
				setImportSubmitting(false);
				setImportResult(result);
				setImportSelected({});
				void refreshModels();
			},
			(failure) => {
				importBusy.current = false;
				setImportSubmitting(false);
				authorizedFailure(failure, () =>
					setImportFailure({
						title: t('importFailed'),
						failure,
						uncertain: failure.code !== 'HTTP_ERROR',
					})
				);
			}
		);
	}, [
		catalog.status,
		list.status,
		importCatalogRows,
		importSelected,
		existingModelIds,
		write,
		refreshModels,
		authorizedFailure,
		t,
	]);
	const { openEditById } = editor;
	useEffect(() => {
		if (list.status !== 'ready') return;
		const id = searchParams.get('edit')?.trim();
		if (!id) {
			editHandled.current = null;
			return;
		}
		if (editHandled.current === id) return;
		editHandled.current = id;
		const params = new URLSearchParams(searchParams.toString());
		params.delete('edit');
		const model = models.find((m) => m.id === id);
		if (model) {
			params.set(
				'kind',
				isImageGenerationModel(model)
					? 'image'
					: isAudioTranscriptionModel(model)
					? 'audio'
					: 'llm'
			);
			params.set('vendor', normalizeModelVendorInput(model.vendor));
		}
		void openEditById(id);
		router.replace(pathname + (params.size ? '?' + params.toString() : ''), {
			scroll: false,
		});
	}, [list.status, searchParams, models, openEditById, router, pathname]);
	const isAllVendors = selectedVendor === ALL_VENDORS_KEY,
		activeVendorKey = isAllVendors ? 'other' : selectedVendor,
		activeVendorTitle = isAllVendors
			? tCatalog('allVendors')
			: getModelVendorLabel(activeVendorKey),
		hasActiveFilter = !isAllVendors;
	const clearFilters = useCallback(
		() => setSelectedVendor(ALL_VENDORS_KEY),
		[setSelectedVendor]
	);
	return {
		...editor,
		attachSuccessFocus,
		list,
		refreshModels,
		models,
		modelSearch,
		setModelSearch,
		filteredModels,
		selectedVendor,
		setSelectedVendor,
		selectedKind,
		setSelectedKind,
		kindCounts,
		selectedVendorItems,
		modelsByVendor,
		isAllVendors,
		activeVendorKey,
		activeVendorTitle,
		hasActiveFilter,
		clearFilters,
		catalog,
		showImportCatalogModal,
		closeImportCatalogModal,
		importCatalogRows,
		importCatalogSearch,
		setImportCatalogSearch,
		importCatalogKind,
		setImportCatalogKind,
		importCatalogKindCounts,
		filteredImportCatalogRows,
		importSelected,
		importSelectedCount,
		importableCatalogCount,
		importSubmitting,
		importResult,
		importFailure,
		existingModelIds,
		metadataPreview,
		setMetadataPreview,
		openMetadataPreview,
		openImportCatalogModal,
		loadImportCatalog,
		toggleImportPreset,
		selectAllImportPresets,
		clearImportPresetSelection,
		runImportSelectedPresets,
	};
}

'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseShellSuccess, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import {
	parseProviders,
	parseImportCatalog,
	parseImportResult,
	parseProviderKey,
	providerWrite,
} from './provider-api';
import {
	getProviderProtocolSummaries,
	providerToFormData,
	suggestDuplicateProviderId,
} from './provider-utils';
import {
	EMPTY_PROTOCOL_FORM,
	EMPTY_PROVIDER_FORM,
	type GatewayProvider,
	type ProviderImportCatalogRow,
	type ProviderImportResult,
	type ProviderFormData,
} from './types';

type ListState<T> =
	| { status: 'loading' }
	| { status: 'error'; failure: ShellFailure }
	| { status: 'ready'; rows: T[] };
type ActionFailure = { title: string; failure: ShellFailure; uncertain: boolean };
export function useProvidersPageState() {
	const t = useTranslations('providers.feedback');
	const [list, setList] = useState<ListState<GatewayProvider>>({ status: 'loading' }),
		[providerSearch, setProviderSearch] = useState('');
	const [showModal, setShowModal] = useState(false),
		[editingProvider, setEditingProvider] = useState<GatewayProvider | null>(null),
		[duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
	const [formData, setFormData] = useState<ProviderFormData>(EMPTY_PROVIDER_FORM),
		[validation, setValidation] = useState(''),
		[actionFailure, setActionFailure] = useState<ActionFailure | null>(null);
	const [showDelete, setShowDelete] = useState(false),
		[writeKind, setWriteKind] = useState<string | null>(null),
		writeBusy = useRef(false);
	const [showImportModal, setShowImportModal] = useState(false),
		[catalog, setCatalog] = useState<ListState<ProviderImportCatalogRow>>({ status: 'loading' }),
		[importCatalogSearch, setImportCatalogSearch] = useState(''),
		[importSelected, setImportSelected] = useState<Record<string, boolean>>({}),
		[importResult, setImportResult] = useState<ProviderImportResult | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null),
		[copyingId, setCopyingId] = useState<string | null>(null),
		[clipboardFailure, setClipboardFailure] = useState(false),
		copyOwner = useRef(0),
		copyBusy = useRef(false),
		copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const returnFocus = useRef<HTMLElement | null>(null),
		newProviderAction = useRef<HTMLButtonElement | null>(null),
		statusFocusId = useRef<string | null>(null);
	const attachNewProviderAction = useCallback((element: HTMLButtonElement | null) => {
		newProviderAction.current = element;
	}, []);
	const { run: readList } = useShellRequest(),
		{ run: write } = useShellRequest(),
		{ run: readCatalog, cancel: cancelCatalog } = useShellRequest(),
		{ run: readKey } = useShellRequest();
	const authorizedFailure = useCallback((failure: ShellFailure, record: () => void) => {
		if (failure.status === 401) notifyAdminSessionExpired();
		else record();
	}, []);
	const loadProviders = useCallback(async () => {
		await readList(
			'/api/admin/providers',
			{},
			parseProviders,
			(rows) => setList({ status: 'ready', rows }),
			(failure) => authorizedFailure(failure, () => setList({ status: 'error', failure })),
		);
	}, [readList, authorizedFailure]);
	useEffect(() => {
		void loadProviders();
	}, [loadProviders]);
	const refreshProviders = useCallback(async () => {
		setList({ status: 'loading' });
		await loadProviders();
	}, [loadProviders]);
	useEffect(
		() => () => {
			copyOwner.current++;
			if (copyTimer.current) clearTimeout(copyTimer.current);
		},
		[],
	);
	const providers = useMemo(() => (list.status === 'ready' ? list.rows : []), [list]);
	const filteredProviders = useMemo(() => {
		const query = providerSearch.trim().toLowerCase();
		if (!query) return providers;
		return providers.filter((provider) =>
			[
				provider.name,
				provider.id,
				provider.description ?? '',
				provider.status,
				...getProviderProtocolSummaries(provider).flatMap((protocol) => [
					protocol.label,
					protocol.baseUrl,
					...protocol.capabilities,
					...protocol.endpoints.map((endpoint) => endpoint.url),
				]),
			]
				.join(' ')
				.toLowerCase()
				.includes(query),
		);
	}, [providers, providerSearch]);
	const catalogRows = useMemo(() => (catalog.status === 'ready' ? catalog.rows : []), [catalog]);
	const filteredImportCatalogRows = useMemo(() => {
		const query = importCatalogSearch.trim().toLowerCase();
		return catalogRows.filter((row) => !query || row.name.toLowerCase().includes(query));
	}, [catalogRows, importCatalogSearch]);
	const importSelectedCount = Object.values(importSelected).filter(Boolean).length;
	const captureFocus = useCallback(() => {
		returnFocus.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
	}, []);
	function freshForm() {
		return {
			...EMPTY_PROVIDER_FORM,
			openai: { ...EMPTY_PROTOCOL_FORM },
			anthropic: { ...EMPTY_PROTOCOL_FORM },
			gemini: { ...EMPTY_PROTOCOL_FORM },
		};
	}
	function handleCreate() {
		captureFocus();
		setEditingProvider(null);
		setDuplicateSourceId(null);
		setFormData(freshForm());
		setValidation('');
		setActionFailure(null);
		setShowModal(true);
	}
	const handleEdit = useCallback(
		(provider: GatewayProvider) => {
			captureFocus();
			setEditingProvider(provider);
			setDuplicateSourceId(null);
			setFormData({
				id: provider.id,
				name: provider.name,
				...providerToFormData(provider),
				description: provider.description ?? '',
			});
			setValidation('');
			setActionFailure(null);
			setShowModal(true);
		},
		[captureFocus],
	);
	function handleDuplicate(provider: GatewayProvider) {
		setEditingProvider(null);
		setDuplicateSourceId(provider.id);
		setFormData({
			id: suggestDuplicateProviderId(provider.id, new Set(providers.map((p) => p.id))),
			name: t('copyName', { name: provider.name }),
			...providerToFormData(provider),
			description: provider.description ?? '',
		});
		setValidation('');
		setActionFailure(null);
	}
	function closeProviderModal() {
		if (writeBusy.current) return;
		setShowModal(false);
		setShowDelete(false);
		setFormData(freshForm());
		setValidation('');
		setActionFailure(null);
	}
	const perform = useCallback(
		<T>(
			kind: string,
			path: string,
			init: RequestInit,
			parse: (body: unknown) => T,
			success: (value: T) => void,
			title: string,
		) => {
			if (writeBusy.current) return;
			writeBusy.current = true;
			setWriteKind(kind);
			setActionFailure(null);
			void write(
				path,
				init,
				parse,
				(value) => {
					writeBusy.current = false;
					setWriteKind(null);
					success(value);
				},
				(failure) => {
					writeBusy.current = false;
					setWriteKind(null);
					authorizedFailure(failure, () =>
						setActionFailure({ title, failure, uncertain: failure.code !== 'HTTP_ERROR' }),
					);
				},
			);
		},
		[write, authorizedFailure],
	);
	function handleSave() {
		if (writeBusy.current) return;
		if (!formData.name.trim()) {
			setValidation(t('nameRequired'));
			return;
		}
		if (!editingProvider && !formData.api_key.trim()) {
			setValidation(t('keyRequired'));
			return;
		}
		setValidation('');
		const request = providerWrite(formData, editingProvider?.id ?? null);
		perform(
			'save',
			request.path,
			request.init,
			parseShellSuccess,
			() => {
				returnFocus.current = newProviderAction.current;
				setShowModal(false);
				setFormData(freshForm());
				void refreshProviders();
			},
			t('saveFailed'),
		);
	}
	function handleDelete() {
		if (!editingProvider || writeBusy.current) return;
		perform(
			'delete',
			'/api/admin/providers/' + encodeURIComponent(editingProvider.id),
			{ method: 'DELETE' },
			parseShellSuccess,
			() => {
				returnFocus.current = newProviderAction.current;
				setShowDelete(false);
				setShowModal(false);
				setEditingProvider(null);
				setFormData(freshForm());
				void refreshProviders();
			},
			t('deleteFailed'),
		);
	}
	const handleToggleStatus = useCallback(
		(provider: GatewayProvider) => {
			perform(
				provider.id,
				'/api/admin/providers/' + encodeURIComponent(provider.id),
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: provider.status === 'disabled' ? 'active' : 'disabled' }),
				},
				parseShellSuccess,
				() => {
					statusFocusId.current = provider.id;
					void refreshProviders();
				},
				t('statusFailed'),
			);
		},
		[perform, refreshProviders, t],
	);
	const restoreStatusFocus = useCallback((id: string, element: HTMLElement | null) => {
		if (statusFocusId.current !== id || !element) return;
		const control = element.querySelector<HTMLElement>('[role="switch"]');
		if (control) {
			statusFocusId.current = null;
			control.focus();
		}
	}, []);
	const loadImportCatalog = useCallback(async () => {
		setCatalog({ status: 'loading' });
		await readCatalog(
			'/api/admin/providers/import/catalog',
			{},
			parseImportCatalog,
			(rows) => setCatalog({ status: 'ready', rows }),
			(failure) => authorizedFailure(failure, () => setCatalog({ status: 'error', failure })),
		);
	}, [readCatalog, authorizedFailure]);
	function openImportModal() {
		captureFocus();
		setShowImportModal(true);
		setImportCatalogSearch('');
		setImportSelected({});
		setImportResult(null);
		setActionFailure(null);
		void loadImportCatalog();
	}
	function closeImportModal() {
		if (writeBusy.current) return;
		cancelCatalog();
		setShowImportModal(false);
		setActionFailure(null);
	}
	function toggleImportPreset(id: string) {
		if (writeBusy.current) return;
		setImportSelected((previous) => ({ ...previous, [id]: !previous[id] }));
	}
	function selectAllImportPresets() {
		if (writeBusy.current) return;
		setImportSelected((previous) => ({
			...previous,
			...Object.fromEntries(filteredImportCatalogRows.map((row) => [row.id, true])),
		}));
	}
	function clearImportPresetSelection() {
		if (!writeBusy.current) setImportSelected({});
	}
	function runImportSelectedPresets() {
		const ids = Object.entries(importSelected)
			.filter(([, selected]) => selected)
			.map(([id]) => id);
		if (!ids.length || catalog.status !== 'ready' || writeBusy.current) return;
		perform(
			'import',
			'/api/admin/providers/import',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			},
			parseImportResult,
			(result) => {
				setImportResult(result);
				setImportSelected({});
				void refreshProviders();
			},
			t('importFailed'),
		);
	}
	const handleCopyApiKey = useCallback(
		(provider: GatewayProvider) => {
			if (copyBusy.current) return;
			copyBusy.current = true;
			const owner = ++copyOwner.current;
			setCopyingId(provider.id);
			setClipboardFailure(false);
			setActionFailure(null);
			setCopiedId(null);
			if (copyTimer.current) clearTimeout(copyTimer.current);
			void readKey(
				'/api/admin/providers/' + encodeURIComponent(provider.id) + '/api-key',
				{},
				parseProviderKey,
				(key) => {
					if (!navigator.clipboard) {
						copyBusy.current = false;
						setCopyingId(null);
						setClipboardFailure(true);
						return;
					}
					void navigator.clipboard.writeText(key).then(
						() => {
							if (copyOwner.current !== owner) return;
							copyBusy.current = false;
							setCopyingId(null);
							setCopiedId('provider-api-key:' + provider.id);
							copyTimer.current = setTimeout(() => {
								setCopiedId(null);
								copyTimer.current = null;
							}, 2000);
						},
						() => {
							if (copyOwner.current !== owner) return;
							copyBusy.current = false;
							setCopyingId(null);
							setClipboardFailure(true);
						},
					);
				},
				(failure) => {
					if (copyOwner.current !== owner) return;
					copyBusy.current = false;
					setCopyingId(null);
					authorizedFailure(failure, () =>
						setActionFailure({ title: t('copyFailed'), failure, uncertain: false }),
					);
				},
			);
		},
		[readKey, authorizedFailure, t],
	);
	return {
		list,
		providers,
		filteredProviders,
		providerSearch,
		setProviderSearch,
		refreshProviders,
		showModal,
		editingProvider,
		duplicateSourceId,
		formData,
		setFormData,
		validation,
		actionFailure,
		showDelete,
		setShowDelete,
		writeKind,
		writeBusy: writeKind !== null,
		handleCreate,
		handleEdit,
		handleDuplicate,
		handleSave,
		handleDelete,
		handleToggleStatus,
		closeProviderModal,
		copiedId,
		copyingId,
		clipboardFailure,
		handleCopyApiKey,
		showImportModal,
		closeImportModal,
		catalog,
		catalogRows,
		filteredImportCatalogRows,
		importCatalogSearch,
		setImportCatalogSearch,
		importSelected,
		importSelectedCount,
		importResult,
		openImportModal,
		loadImportCatalog,
		toggleImportPreset,
		selectAllImportPresets,
		clearImportPresetSelection,
		runImportSelectedPresets,
		returnFocus,
		attachNewProviderAction,
		restoreStatusFocus,
	};
}

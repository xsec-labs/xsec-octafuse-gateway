'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { normalizeMetadataClient } from '@/lib/normalize-metadata-client';
import {
	useShellRequest,
	parseShellSuccess,
	type ShellFailure,
} from '@/lib/shell-request';
import type { GatewayApiKey } from '@/lib/types';
import { parseCreatedKey, parseKeyList } from './key-api';

export type KeyCreationMode = 'existingUser' | 'externalIdentity';
const emptyForm = () => ({
	user_id: '',
	email: '',
	external_system: '',
	external_user_id: '',
	name: '',
	metadata: '',
});
type ReadState =
	| { status: 'loading' }
	| { status: 'error'; query: string; failure: ShellFailure }
	| { status: 'ready'; query: string; keys: GatewayApiKey[]; total: number };
type ActionFailure = {
	title: string;
	failure: ShellFailure;
	uncertain: boolean;
};

function editorMetadata(raw: string | null): string {
	if (!raw) return '';
	try {
		return JSON.stringify(JSON.parse(raw), null, 2);
	} catch {
		return raw;
	}
}

export function useKeysPageState() {
	const t = useTranslations('keysPage.feedback'),
		common = useTranslations('common');
	const [query, setQuery] = useState({
		page: 1,
		email: '',
		userId: '',
		order: 'desc' as 'asc' | 'desc',
	});
	const params = new URLSearchParams({
		page: String(query.page),
		page_size: '20',
		sort: 'created_at',
		order: query.order,
	});
	if (query.email) params.set('email', query.email);
	if (query.userId.trim()) params.set('user_id', query.userId.trim());
	const queryKey = params.toString();
	const [list, setList] = useState<ReadState>({ status: 'loading' });
	const { run: read, cancel: cancelRead } = useShellRequest(),
		{ run: write } = useShellRequest();
	const [editor, setEditor] = useState<'create' | 'edit' | null>(null),
		[selectedKey, setSelectedKey] = useState<GatewayApiKey | null>(null);
	const [form, setForm] = useState(emptyForm),
		[creationMode, setCreationMode] = useState<KeyCreationMode>('existingUser');
	const [freshKey, setFreshKey] = useState<string | null>(null),
		[saveError, setSaveError] = useState(''),
		[actionFailure, setActionFailure] = useState<ActionFailure | null>(null);
	const [operation, setOperation] = useState<
			'save' | 'delete' | 'status' | null
		>(null),
		writing = useRef(false);
	const [showDelete, setShowDelete] = useState(false);
	const returnFocus = useRef<HTMLElement | null>(null),
		deleteReturnFocus = useRef<HTMLElement | null>(null),
		headerFocus = useRef<HTMLDivElement | null>(null);
	const attachHeaderFocus = useCallback((element: HTMLDivElement | null) => {
		headerFocus.current = element;
	}, []);
	const onFailure = useCallback((failure: ShellFailure, record: () => void) => {
		if (failure.status === 401) notifyAdminSessionExpired();
		else record();
	}, []);
	const load = useCallback(async () => {
		await read(
			'/api/admin/keys?' + queryKey,
			{},
			parseKeyList,
			(value) => {
				setList({ status: 'ready', query: queryKey, ...value });
				setSelectedKey((prev) =>
					prev ? value.keys.find((row) => row.id === prev.id) ?? prev : null
				);
			},
			(failure) =>
				onFailure(failure, () =>
					setList({ status: 'error', query: queryKey, failure })
				)
		);
	}, [read, queryKey, onFailure]);
	useEffect(() => {
		void load();
		return cancelRead;
	}, [load, cancelRead]);
	const refresh = useCallback(async () => {
		setList({ status: 'loading' });
		await load();
	}, [load]);
	const reloadAfterUncertainWrite = async () => {
		setEditor(null);
		setShowDelete(false);
		setSelectedKey(null);
		setActionFailure(null);
		await refresh();
	};
	const ready = list.status === 'ready' && list.query === queryKey;
	const isLoading = list.status === 'loading' || list.query !== queryKey;
	const readFailure =
		list.status === 'error' && list.query === queryKey ? list.failure : null;
	const keys = ready ? list.keys : [],
		total = ready ? list.total : 0;
	const busy = operation !== null,
		uncertain = !!actionFailure?.uncertain;
	const close = () => {
		if (writing.current || showDelete) return;
		setEditor(null);
		setSelectedKey(null);
		setSaveError('');
	};
	const open = useCallback(
		(key?: GatewayApiKey) => {
			if (writing.current || uncertain || !ready) return;
			returnFocus.current =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
			setSelectedKey(key ?? null);
			setForm(
				key
					? {
							...emptyForm(),
							name: key.name ?? '',
							metadata: editorMetadata(key.metadata),
					  }
					: emptyForm()
			);
			setCreationMode('existingUser');
			setFreshKey(null);
			setSaveError('');
			setActionFailure(null);
			setEditor(key ? 'edit' : 'create');
		},
		[ready, uncertain]
	);
	const changeMode = (mode: KeyCreationMode) => {
		setCreationMode(mode);
		setForm((prev) =>
			mode === 'existingUser'
				? { ...prev, external_system: '', external_user_id: '', email: '' }
				: { ...prev, user_id: '' }
		);
	};
	const perform = async <T>(
		kind: 'save' | 'delete' | 'status',
		title: string,
		path: string,
		init: RequestInit,
		parse: (body: unknown) => T,
		success: (value: T) => void
	) => {
		if (writing.current || uncertain) return;
		writing.current = true;
		setOperation(kind);
		setSaveError('');
		setActionFailure(null);
		await write(
			path,
			init,
			parse,
			(value) => {
				writing.current = false;
				setOperation(null);
				success(value);
				void refresh();
			},
			(failure) => {
				writing.current = false;
				setOperation(null);
				onFailure(failure, () =>
					setActionFailure({
						title,
						failure,
						uncertain:
							failure.code !== 'HTTP_ERROR' || Number(failure.status) >= 500,
					})
				);
			}
		);
	};
	const save = async () => {
		if (writing.current || uncertain || !editor) return;
		setSaveError('');
		const meta = normalizeMetadataClient(form.metadata);
		if (!meta.ok) {
			setSaveError(t('metadataInvalid'));
			return;
		}
		const payload: Record<string, unknown> = {
			name: form.name.trim() || null,
			[editor === 'create' ? 'metadata' : 'metadata_replace']: meta.value,
			reason: editor === 'create' ? 'gwui:new' : 'gwui:edit',
		};
		if (editor === 'create') {
			if (creationMode === 'existingUser') {
				if (!form.user_id.trim()) {
					setSaveError(t('userRequired'));
					return;
				}
				payload.user_id = form.user_id.trim();
			} else {
				if (!form.external_system.trim() || !form.external_user_id.trim()) {
					setSaveError(t('externalRequired'));
					return;
				}
				if (!form.email.trim()) {
					setSaveError(t('emailRequired'));
					return;
				}
				Object.assign(payload, {
					external_system: form.external_system.trim(),
					external_user_id: form.external_user_id.trim(),
					email: form.email.trim(),
				});
			}
			await perform(
				'save',
				common('createFailed'),
				'/api/admin/keys',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				},
				parseCreatedKey,
				(secret) => {
					returnFocus.current = headerFocus.current;
					setFreshKey(secret);
					setEditor(null);
				}
			);
		} else if (selectedKey) {
			await perform(
				'save',
				common('updateFailed'),
				'/api/admin/keys/' + encodeURIComponent(selectedKey.id),
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				},
				parseShellSuccess,
				() => {
					returnFocus.current = headerFocus.current;
					setEditor(null);
					setSelectedKey(null);
				}
			);
		}
	};
	const toggleStatus = async () => {
		if (!selectedKey) return;
		const nextStatus = selectedKey.status === 'active' ? 'revoked' : 'active';
		await perform(
			'status',
			common('updateFailed'),
			'/api/admin/keys/' + encodeURIComponent(selectedKey.id),
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: nextStatus,
					reason: `gwui:st:${nextStatus}`,
				}),
			},
			parseShellSuccess,
			() =>
				setSelectedKey((prev) =>
					prev ? { ...prev, status: nextStatus } : prev
				)
		);
	};
	const remove = async () => {
		if (!selectedKey) return;
		await perform(
			'delete',
			t('deleteFailed'),
			'/api/admin/keys/' + encodeURIComponent(selectedKey.id),
			{ method: 'DELETE' },
			parseShellSuccess,
			() => {
				returnFocus.current = headerFocus.current;
				deleteReturnFocus.current = headerFocus.current;
				setShowDelete(false);
				setEditor(null);
				setSelectedKey(null);
				if (keys.length === 1 && query.page > 1)
					setQuery((prev) => ({ ...prev, page: prev.page - 1 }));
			}
		);
	};
	const openDelete = () => {
		if (writing.current || uncertain) return;
		deleteReturnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setShowDelete(true);
	};
	const toggleSort = useCallback(
		() =>
			setQuery((prev) => ({
				...prev,
				page: 1,
				order: prev.order === 'desc' ? 'asc' : 'desc',
			})),
		[]
	);
	return {
		toggleSort,
		query,
		setQuery,
		keys,
		total,
		isLoading,
		readFailure,
		refresh,
		editor,
		selectedKey,
		form,
		setForm,
		creationMode,
		changeMode,
		freshKey,
		dismissFreshKey: () => setFreshKey(null),
		saveError,
		actionFailure,
		busy,
		uncertain,
		operation,
		open,
		close,
		save,
		toggleStatus,
		remove,
		showDelete,
		openDelete,
		closeDelete: () => {
			if (!writing.current) setShowDelete(false);
		},
		returnFocus,
		deleteReturnFocus,
		attachHeaderFocus,
		reloadAfterUncertainWrite,
	};
}

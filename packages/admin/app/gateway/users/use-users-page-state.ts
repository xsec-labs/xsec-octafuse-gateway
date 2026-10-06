'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { nextListSortStateWithAscToggle } from '@/lib/toggle-list-sort';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';
import type { GatewayUserListItem } from '@/lib/types';
import { parseCreatedUser, parseUserList } from './user-api';
export type UserSortKey =
	| 'budget_spent'
	| 'budget_max'
	| 'budget_base'
	| 'budget_reset_at'
	| 'created_at';
const emptyForm = () => ({
	email: '',
	external_system: '',
	external_user_id: '',
	budget_max: '',
	budget_base: '',
	budget_period: 'none',
	metadata: '',
});
type ReadState =
	| { status: 'loading' }
	| { status: 'error'; query: string; failure: ShellFailure }
	| {
			status: 'ready';
			query: string;
			users: GatewayUserListItem[];
			total: number;
	  };
type ActionFailure = { failure: ShellFailure; uncertain: boolean };
type MetadataState =
	| { status: 'unused' | 'closed' }
	| { status: 'open'; user: GatewayUserListItem };
export function useUsersPageState() {
	const feedback = useTranslations('users.feedback');
	const [query, setQuery] = useState({
		page: 1,
		email: '',
		externalSystem: '',
		externalUserId: '',
		status: '',
		sort: 'created_at' as UserSortKey,
		order: 'desc' as 'asc' | 'desc',
	});
	const params = new URLSearchParams({
		page: String(query.page),
		page_size: '20',
		sort: query.sort,
		order: query.order,
	});
	for (const [field, value] of [
		['email', query.email],
		['external_system', query.externalSystem],
		['external_user_id', query.externalUserId],
		['status', query.status],
	])
		if (value.trim()) params.set(field, value.trim());
	const queryKey = params.toString();
	const [list, setList] = useState<ReadState>({ status: 'loading' });
	const { run: read, cancel: cancelRead } = useShellRequest(),
		{ run: write } = useShellRequest();
	const [showCreate, setShowCreate] = useState(false),
		[form, setForm] = useState(emptyForm),
		[saveError, setSaveError] = useState('');
	const [busy, setBusy] = useState(false),
		writing = useRef(false),
		[actionFailure, setActionFailure] = useState<ActionFailure | null>(null);
	const [metadata, setMetadata] = useState<MetadataState>({ status: 'unused' });
	const returnFocus = useRef<HTMLElement | null>(null),
		metadataReturnFocus = useRef<HTMLElement | null>(null),
		headerFocus = useRef<HTMLDivElement | null>(null);
	const attachHeaderFocus = useCallback((element: HTMLDivElement | null) => {
		headerFocus.current = element;
	}, []);
	const onFailure = useCallback((failure: ShellFailure, record: () => void) => {
		if (failure.status === 401) notifyAdminSessionExpired();
		else record();
	}, []);
	const load = useCallback(
		async (confirmWrite = false) => {
			await read(
				'/api/admin/users?' + queryKey,
				{},
				parseUserList,
				(value) => {
					setList({ status: 'ready', query: queryKey, ...value });
					if (confirmWrite) setActionFailure(null);
				},
				(failure) =>
					onFailure(failure, () =>
						setList({ status: 'error', query: queryKey, failure })
					)
			);
		},
		[read, queryKey, onFailure]
	);
	useEffect(() => {
		void load();
		return cancelRead;
	}, [load, cancelRead]);
	const refresh = useCallback(async () => {
		setList({ status: 'loading' });
		await load();
	}, [load]);
	const ready = list.status === 'ready' && list.query === queryKey,
		uncertain = !!actionFailure?.uncertain;
	const openCreate = () => {
		if (writing.current || uncertain || !ready) return;
		returnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setForm(emptyForm());
		setSaveError('');
		setActionFailure(null);
		setShowCreate(true);
	};
	const closeCreate = () => {
		if (!writing.current && !uncertain) {
			setShowCreate(false);
			setSaveError('');
		}
	};
	const openMetadata = useCallback((user: GatewayUserListItem) => {
		metadataReturnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setMetadata({ status: 'open', user });
	}, []);
	const toggleSort = useCallback(
		(key: UserSortKey) =>
			setQuery((prev) => {
				const next = nextListSortStateWithAscToggle(prev.sort, prev.order, key);
				return {
					...prev,
					page: 1,
					sort: next.sortKey as UserSortKey,
					order: next.sortDir,
				};
			}),
		[]
	);
	const save = async () => {
		if (writing.current || uncertain || !showCreate) return;
		setSaveError('');
		const email = form.email.trim(),
			externalSystem = form.external_system.trim(),
			externalUserId = form.external_user_id.trim();
		if (!email) {
			setSaveError(feedback('emailRequired'));
			return;
		}
		if (!!externalSystem !== !!externalUserId) {
			setSaveError(feedback('externalPair'));
			return;
		}
		const body: Record<string, unknown> = {
			email,
			external_system: externalSystem || null,
			external_user_id: externalUserId || null,
			budget_period: form.budget_period,
			budget_max: null,
		};
		for (const field of ['budget_max', 'budget_base'] as const) {
			if (!form[field].trim()) continue;
			const value = Number(form[field]);
			if (!Number.isFinite(value)) {
				setSaveError(feedback('budgetInvalid'));
				return;
			}
			body[field] = value;
		}
		if (form.metadata.trim()) {
			try {
				body.metadata = JSON.parse(form.metadata);
			} catch {
				setSaveError(feedback('metadataInvalid'));
				return;
			}
		}
		writing.current = true;
		setBusy(true);
		setActionFailure(null);
		await write(
			'/api/admin/users',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			},
			parseCreatedUser,
			() => {
				writing.current = false;
				setBusy(false);
				returnFocus.current = headerFocus.current;
				setShowCreate(false);
				void refresh();
			},
			(failure) => {
				writing.current = false;
				setBusy(false);
				onFailure(failure, () =>
					setActionFailure({
						failure,
						uncertain:
							failure.code !== 'HTTP_ERROR' || Number(failure.status) >= 500,
					})
				);
			}
		);
	};
	const reloadAfterUncertainWrite = async () => {
		if (writing.current) return;
		returnFocus.current = headerFocus.current;
		setShowCreate(false);
		setList({ status: 'loading' });
		await load(true);
	};
	return {
		query,
		setQuery,
		toggleSort,
		users: ready ? list.users : [],
		total: ready ? list.total : 0,
		isLoading: list.status === 'loading' || list.query !== queryKey,
		readFailure:
			list.status === 'error' && list.query === queryKey ? list.failure : null,
		refresh,
		showCreate,
		openCreate,
		closeCreate,
		form,
		setForm,
		save,
		saveError,
		busy,
		uncertain,
		actionFailure,
		reloadAfterUncertainWrite,
		metadataUser: metadata.status === 'open' ? metadata.user : null,
		metadataMounted: metadata.status !== 'unused',
		openMetadata,
		closeMetadata: () => setMetadata({ status: 'closed' }),
		returnFocus,
		metadataReturnFocus,
		attachHeaderFocus,
	};
}

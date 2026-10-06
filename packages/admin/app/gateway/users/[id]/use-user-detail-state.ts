'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { parseGatewayDateTime } from '@/lib/datetime';
import {
	parseShellSuccess,
	useShellRequest,
	type ShellFailure,
} from '@/lib/shell-request';
import {
	parseDetailCurrency,
	parseRecentAudits,
	parseRecentLogs,
	parseUserCreatedKey,
	parseUserDetail,
	parseUserKeys,
	type UserDetail,
	type UserKey,
} from './detail-api';

const currencyPath = () => '/api/admin/config';

export type ProfileDraft = {
	email: string;
	status: string;
	budget_max: string;
	budget_base: string;
	budget_spent: string;
	budget_period: string;
	budget_reset_at: string;
	metadata: string;
	external_system: string;
	external_user_id: string;
};
export type ReadState<T> =
	| { status: 'loading' }
	| { status: 'error'; failure: ShellFailure }
	| { status: 'ready'; value: T };
type ReadOutcome = { ok: true } | { ok: false; failure?: ShellFailure };
export type WriteKind =
	| 'plan'
	| 'createKey'
	| 'toggleKey'
	| 'deleteKey'
	| 'deleteUser';
type ActionState =
	| { status: 'idle' }
	| { status: 'busy'; kind: WriteKind }
	| {
			status: 'failure';
			kind: WriteKind;
			failure: ShellFailure;
			uncertain: boolean;
	  }
	| { status: 'read-required'; kind: WriteKind };
function localDateTime(raw: string | null): string {
	const date = parseGatewayDateTime(raw);
	if (!date) return '';
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
		date.getDate()
	)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
		date.getSeconds()
	)}`;
}
function draft(user: UserDetail): ProfileDraft {
	return {
		email: user.email,
		status: user.status,
		budget_max: user.budget_max === null ? '' : String(user.budget_max),
		budget_base: String(user.budget_base),
		budget_spent: String(user.budget_spent),
		budget_period: user.budget_period,
		budget_reset_at: localDateTime(user.budget_reset_at),
		metadata:
			user.metadata === null ? '' : JSON.stringify(user.metadata, null, 2),
		external_system: user.external_system ?? '',
		external_user_id: user.external_user_id ?? '',
	};
}
function useDetailRead<T>(
	path: () => string,
	parse: (body: unknown) => T,
	accept?: (value: T) => void
) {
	const [state, setState] = useState<ReadState<T>>({ status: 'loading' });
	const { run, cancel } = useShellRequest();
	const read = useCallback(async (): Promise<ReadOutcome> => {
		let result: ReadOutcome = { ok: false };
		await run(
			path(),
			{},
			parse,
			(value) => {
				accept?.(value);
				setState({ status: 'ready', value });
				result = { ok: true };
			},
			(failure) => {
				result = { ok: false, failure };
				setState({ status: 'error', failure });
				if (failure.status === 401) notifyAdminSessionExpired();
			}
		);
		return result;
	}, [run, path, parse, accept]);
	const load = useCallback(() => {
		setState({ status: 'loading' });
		return read();
	}, [read]);
	useEffect(() => {
		void read();
		return cancel;
	}, [read, cancel]);
	return { state, load };
}

/** The route owns reads, writes and immutable resolved identity for its lifetime. */
export function useUserDetailState(routeId: string) {
	const feedback = useTranslations('users.feedback'),
		detail = useTranslations('users.detailFeedback'),
		router = useRouter();
	const resolvedId = useRef<string | null>(null);
	const base = useCallback(
		() =>
			'/api/admin/users/' + encodeURIComponent(resolvedId.current ?? routeId),
		[routeId]
	);
	const keysPath = useCallback(() => base() + '/keys', [base]);
	const logsPath = useCallback(
		() => base() + '/logs?page=1&page_size=5',
		[base]
	);
	const auditsPath = useCallback(
		() => base() + '/audit-logs?page=1&page_size=5',
		[base]
	);
	const [form, setForm] = useState<ProfileDraft | null>(null),
		[planError, setPlanError] = useState('');
	const acceptUser = useCallback((user: UserDetail) => {
		resolvedId.current = user.id;
		setForm(draft(user));
	}, []);
	const profile = useDetailRead(base, parseUserDetail, acceptUser),
		keys = useDetailRead(keysPath, parseUserKeys);
	const logs = useDetailRead(logsPath, parseRecentLogs),
		audits = useDetailRead(auditsPath, parseRecentAudits);
	const currency = useDetailRead(currencyPath, parseDetailCurrency);
	const { run: write } = useShellRequest();
	const [action, setAction] = useState<ActionState>({ status: 'idle' });
	const writing = useRef(false),
		blocked = useRef(false),
		alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const [keyDialog, setKeyDialog] = useState(false),
		[keyDraft, setKeyDraft] = useState({ name: '', metadata: '' }),
		[keyError, setKeyError] = useState('');
	const [freshKey, setFreshKey] = useState<string | null>(null),
		[deleteTarget, setDeleteTarget] = useState<
			{ kind: 'deleteKey'; key: UserKey } | { kind: 'deleteUser' } | null
		>(null);
	const [metadata, setMetadata] = useState<{
		mounted: boolean;
		key: UserKey | null;
	}>({ mounted: false, key: null });
	const returnFocus = useRef<HTMLElement | null>(null),
		metadataReturnFocus = useRef<HTMLElement | null>(null),
		headerFocus = useRef<HTMLDivElement | null>(null);
	const attachHeaderFocus = useCallback((element: HTMLDivElement | null) => {
		headerFocus.current = element;
	}, []);
	const rememberFocus = () => {
		returnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
	};
	const locked =
		action.status === 'busy' ||
		action.status === 'read-required' ||
		(action.status === 'failure' && action.uncertain);
	const reloadProfile = profile.load,
		reloadAudits = audits.load,
		reloadKeys = keys.load;
	const refreshFor = useCallback(
		async (kind: WriteKind) => {
			const outcomes =
				kind === 'plan' || kind === 'deleteUser'
					? await Promise.all([reloadProfile(), reloadAudits()])
					: await Promise.all([reloadKeys(), reloadAudits()]);
			if (
				kind === 'deleteUser' &&
				!outcomes[0].ok &&
				outcomes[0].failure?.status === 404
			) {
				router.push('/gateway/users');
				return true;
			}
			return outcomes.every((outcome) => outcome.ok);
		},
		[reloadProfile, reloadAudits, reloadKeys, router]
	);
	const clearAction = useCallback(() => {
		blocked.current = false;
		writing.current = false;
		setAction({ status: 'idle' });
	}, []);
	const perform = useCallback(
		async <T>(
			kind: WriteKind,
			path: string,
			init: RequestInit,
			parse: (body: unknown) => T,
			accept: (value: T) => void
		) => {
			if (
				writing.current ||
				blocked.current ||
				profile.state.status !== 'ready' ||
				currency.state.status !== 'ready'
			)
				return;
			writing.current = true;
			setAction({ status: 'busy', kind });
			let confirmed = false;
			await write(
				path,
				init,
				parse,
				(value) => {
					confirmed = true;
					accept(value);
				},
				(failure) => {
					writing.current = false;
					// User PATCH can persist profile fields before a later validation or budget failure.
					const uncertain = !(
						kind === 'createKey' &&
						failure.code === 'HTTP_ERROR' &&
						failure.status === 400
					);
					blocked.current = uncertain;
					setAction({ status: 'failure', kind, failure, uncertain });
					if (failure.status === 401) notifyAdminSessionExpired();
				}
			);
			if (!confirmed || !alive.current) return;
			if (kind === 'deleteUser') {
				router.push('/gateway/users');
				return;
			}
			const readBack = await refreshFor(kind);
			if (!alive.current) return;
			if (readBack) clearAction();
			else {
				writing.current = false;
				blocked.current = true;
				setAction({ status: 'read-required', kind });
			}
		},
		[
			write,
			profile.state.status,
			currency.state.status,
			refreshFor,
			clearAction,
			router,
		]
	);
	const json = (method: string, body: unknown): RequestInit => ({
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const savePlan = async () => {
		if (!form || writing.current || blocked.current) return;
		setPlanError('');
		const email = form.email.trim(),
			externalSystem = form.external_system.trim(),
			externalUserId = form.external_user_id.trim();
		if (!email) {
			setPlanError(feedback('emailRequired'));
			return;
		}
		if (!!externalSystem !== !!externalUserId) {
			setPlanError(feedback('externalPair'));
			return;
		}
		const payload: Record<string, unknown> = {
			email,
			status: form.status,
			budget_period: form.budget_period,
			external_system: externalSystem || null,
			external_user_id: externalUserId || null,
			reason: 'gwui:user-plan',
		};
		for (const field of [
			'budget_max',
			'budget_base',
			'budget_spent',
		] as const) {
			const value =
				form[field].trim() === ''
					? field === 'budget_spent'
						? 0
						: null
					: Number(form[field]);
			if (value !== null && !Number.isFinite(value)) {
				setPlanError(feedback('budgetInvalid'));
				return;
			}
			payload[field] = value;
		}
		const reset = form.budget_reset_at.trim()
			? new Date(form.budget_reset_at)
			: null;
		if (reset && !Number.isFinite(reset.getTime())) {
			setPlanError(detail('dateInvalid'));
			return;
		}
		payload.budget_reset_at = reset?.toISOString() ?? null;
		if (form.metadata.trim()) {
			try {
				payload.metadata_replace = JSON.stringify(JSON.parse(form.metadata));
			} catch {
				setPlanError(feedback('metadataInvalid'));
				return;
			}
		}
		await perform(
			'plan',
			base(),
			json('PATCH', payload),
			parseUserDetail,
			() => {
				returnFocus.current = headerFocus.current;
			}
		);
	};
	const openNewKey = () => {
		if (
			writing.current ||
			blocked.current ||
			keys.state.status !== 'ready' ||
			profile.state.status !== 'ready'
		)
			return;
		rememberFocus();
		setKeyDraft({ name: '', metadata: '' });
		setKeyError('');
		setFreshKey(null);
		setAction({ status: 'idle' });
		setKeyDialog(true);
	};
	const closeNewKey = () => {
		if (!writing.current && !blocked.current) {
			setKeyDialog(false);
			setKeyError('');
		}
	};
	const createKey = async () => {
		if (!keyDialog || writing.current || blocked.current) return;
		setKeyError('');
		let metadata: string | null = null;
		if (keyDraft.metadata.trim()) {
			try {
				metadata = JSON.stringify(JSON.parse(keyDraft.metadata));
			} catch {
				setKeyError(feedback('metadataInvalid'));
				return;
			}
		}
		await perform(
			'createKey',
			keysPath(),
			json('POST', {
				name: keyDraft.name.trim() || null,
				metadata,
				reason: 'gwui:user-detail',
			}),
			parseUserCreatedKey,
			(secret) => {
				setFreshKey(secret);
				setKeyDialog(false);
				returnFocus.current = headerFocus.current;
			}
		);
	};
	const toggleKey = useCallback(
		async (key: UserKey) => {
			const status = key.status === 'active' ? 'revoked' : 'active';
			await perform(
				'toggleKey',
				keysPath() + '/' + encodeURIComponent(key.id),
				json('PATCH', { status, reason: `gwui:st:${status}` }),
				parseShellSuccess,
				() => {}
			);
		},
		[perform, keysPath]
	);
	const askDelete = useCallback((key?: UserKey) => {
		if (!writing.current && !blocked.current) {
			returnFocus.current =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
			setAction({ status: 'idle' });
			setDeleteTarget(
				key ? { kind: 'deleteKey', key } : { kind: 'deleteUser' }
			);
		}
	}, []);
	const closeDelete = () => {
		if (!writing.current && !blocked.current) setDeleteTarget(null);
	};
	const confirmDelete = async () => {
		if (!deleteTarget) return;
		const target = deleteTarget;
		await perform(
			target.kind,
			target.kind === 'deleteKey'
				? keysPath() + '/' + encodeURIComponent(target.key.id)
				: base(),
			{ method: 'DELETE' },
			parseShellSuccess,
			() => {
				setDeleteTarget(null);
				returnFocus.current = headerFocus.current;
			}
		);
	};
	const reconcile = async () => {
		if (writing.current || action.status === 'idle' || action.status === 'busy')
			return;
		const kind = action.kind;
		writing.current = true;
		setAction({ status: 'busy', kind });
		const readBack = await refreshFor(kind);
		if (!alive.current) return;
		writing.current = false;
		if (readBack) {
			setKeyDialog(false);
			setDeleteTarget(null);
			returnFocus.current = headerFocus.current;
			clearAction();
		} else {
			blocked.current = true;
			setAction({ status: 'read-required', kind });
		}
	};
	const openMetadata = useCallback((key: UserKey) => {
		metadataReturnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setMetadata({ mounted: true, key });
	}, []);
	return {
		currency,
		profile,
		keys,
		logs,
		audits,
		form,
		setForm,
		planError,
		savePlan,
		action,
		locked,
		keyDialog,
		openNewKey,
		closeNewKey,
		keyDraft,
		setKeyDraft,
		keyError,
		createKey,
		freshKey,
		dismissFreshKey: () => setFreshKey(null),
		toggleKey,
		deleteTarget,
		askDelete,
		closeDelete,
		confirmDelete,
		reconcile,
		metadata,
		openMetadata,
		closeMetadata: () => setMetadata({ mounted: true, key: null }),
		returnFocus,
		metadataReturnFocus,
		attachHeaderFocus,
	};
}

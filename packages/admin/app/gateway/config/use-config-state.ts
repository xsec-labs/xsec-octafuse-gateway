'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { parseShellSuccess, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { CONFIG_KEYS, parseConfig, type ConfigDraft, type ConfigGroup } from './config-api';
import { DEFAULT_ROUTE_STRATEGY } from '@octafuse/core/db/model-route-policy';
import type { SystemConfigRow } from '@/lib/types';
export type ConfigFeedback = {
    group: ConfigGroup;
    validation?: string;
    failure?: ShellFailure;
    savedKeys: string[];
    success?: boolean;
    uncertain?: boolean;
};
const emptyDraft: ConfigDraft = { master: '', timezone: 'UTC', currency: 'USD', strategy: DEFAULT_ROUTE_STRATEGY, wecom: '', feishu: '' };
/** Reads own the confirmed snapshot; writes update only acknowledged keys in order. */
export function useConfigState() {
    const [rows, setRows] = useState<SystemConfigRow[] | null>(null), [draft, setDraft] = useState<ConfigDraft>(emptyDraft), [loading, setLoading] = useState(true), [readFailure, setReadFailure] = useState<ShellFailure | null>(null), [feedback, setFeedback] = useState<ConfigFeedback | null>(null), [saving, setSaving] = useState<ConfigGroup | null>(null);
    const { run: runRead, cancel: cancelRead } = useShellRequest(), { run: runWrite } = useShellRequest(), locked = useRef(false), alive = useRef(false);
    const load = useCallback(async () => {
        await runRead('/api/admin/config', {}, parseConfig, result => { setRows(result.rows); setDraft(result.draft); setLoading(false); }, failure => { setReadFailure(failure); setLoading(false); if (failure.status === 401)
            notifyAdminSessionExpired(); });
    }, [runRead]);
    const refresh = useCallback(async () => {
        if (locked.current)
            return;
        setLoading(true);
        setRows(null);
        setReadFailure(null);
        setFeedback(null);
        await load();
    }, [load]);
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; cancelRead(); }; }, [load, cancelRead]);
    const edit = (key: keyof ConfigDraft, value: string) => { setDraft(previous => ({ ...previous, [key]: value })); setFeedback(previous => previous?.failure ? previous : null); };
    const validate = (group: ConfigGroup, validation: string) => setFeedback({ group, validation, savedKeys: [] });
    const clearValidation = () => setFeedback(previous => previous?.failure ? previous : null);
    const save = async (group: ConfigGroup, entries: readonly {
        key: string;
        value: string;
    }[], onSuccess?: () => void) => {
        if (locked.current || loading || !rows || feedback?.failure)
            return;
        locked.current = true;
        setSaving(group);
        setFeedback(null);
        const savedKeys: string[] = [];
        for (const entry of entries) {
            if (!alive.current)
                return;
            let confirmed = false;
            await runWrite('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }, parseShellSuccess, () => {
                confirmed = true;
                savedKeys.push(entry.key);
                setRows(previous => { if (previous === null)
                    throw new Error('Configuration writes require a confirmed snapshot'); return previous.some(row => row.key === entry.key) ? previous.map(row => row.key === entry.key ? { ...row, value: entry.value } : row) : [...previous, { ...entry, description: null }]; });
                const field = (Object.keys(CONFIG_KEYS) as (keyof ConfigDraft)[]).find(key => CONFIG_KEYS[key] === entry.key);
                if (field)
                    setDraft(previous => ({ ...previous, [field]: entry.value }));
            }, failure => {
                setFeedback({ group, failure, savedKeys: [...savedKeys], uncertain: failure.code !== 'HTTP_ERROR' || (failure.status !== undefined && failure.status >= 500) });
                setSaving(null);
                locked.current = false;
                if (failure.status === 401)
                    notifyAdminSessionExpired();
            });
            if (!confirmed || !alive.current)
                return;
        }
        locked.current = false;
        setSaving(null);
        setFeedback({ group, savedKeys, success: true });
        onSuccess?.();
    };
    return { rows, draft, loading, readFailure, feedback, saving, busy: saving !== null, writeBlocked: !!feedback?.failure, refresh, edit, validate, clearValidation, save };
}

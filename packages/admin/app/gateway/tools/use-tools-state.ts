'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { parseShellSuccess, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { parseTools, buildToolSave, type ToolKind, type ToolDraft, type ToolsSnapshot } from './tools-config';

export type ToolFeedback = { kind: ToolKind; validation?: string; validationField?: string; failure?: ShellFailure; savedKeys: string[]; success?: boolean; uncertain?: boolean };
export function useToolsState() {
    const [snapshot, setSnapshot] = useState<ToolsSnapshot | null>(null), [loading, setLoading] = useState(true), [readFailure, setReadFailure] = useState<ShellFailure | null>(null);
    const [feedback, setFeedback] = useState<ToolFeedback | null>(null), [saving, setSaving] = useState<ToolKind | null>(null);
    const { run: read, cancel: cancelRead } = useShellRequest(), { run: write, cancel: cancelWrite } = useShellRequest();
    const locked = useRef(false), alive = useRef(false);
    const load = useCallback(async () => {
        await read('/api/admin/config', {}, parseTools, result => { setSnapshot(result); setLoading(false); }, failure => { setReadFailure(failure); setLoading(false); if (failure.status === 401) notifyAdminSessionExpired(); });
    }, [read]);
    const refresh = async () => {
        if (locked.current) return;
        setSnapshot(null); setLoading(true); setReadFailure(null); setFeedback(null);
        await load();
    };
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; cancelRead(); cancelWrite(); }; }, [load, cancelRead, cancelWrite]);
    const clearValidation = () => setFeedback(previous => previous?.failure ? previous : null);
    const edit = (kind: ToolKind, provider: string, field: keyof ToolDraft, value: string) => {
        if (locked.current) return;
        setSnapshot(previous => previous && ({ ...previous, sections: { ...previous.sections, [kind]: { ...previous.sections[kind], drafts: { ...previous.sections[kind].drafts, [provider]: { ...previous.sections[kind].drafts[provider], [field]: value } } } } }));
        clearValidation();
    };
    const activate = (kind: ToolKind, active: string) => {
        if (locked.current) return;
        setSnapshot(previous => previous && ({ ...previous, sections: { ...previous.sections, [kind]: { ...previous.sections[kind], active } } }));
        clearValidation();
    };
    const save = async (kind: ToolKind, validationText: (key: string) => string) => {
        if (locked.current || loading || !snapshot || feedback?.failure) return;
        const section = snapshot.sections[kind], result = buildToolSave(kind, section);
        if ('errorKey' in result) { setFeedback({ kind, validation: validationText(result.errorKey), validationField: result.focusId, savedKeys: [] }); document.getElementById(result.focusId)?.focus(); return; }
        locked.current = true; setSaving(kind); setFeedback(null);
        const savedKeys: string[] = [];
        for (const entry of result.entries) {
            if (!alive.current) return;
            let acknowledged = false;
            await write('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }, parseShellSuccess, () => { acknowledged = true; savedKeys.push(entry.key); }, failure => {
                setFeedback({ kind, failure, savedKeys: [...savedKeys], uncertain: failure.code !== 'HTTP_ERROR' || (failure.status !== undefined && failure.status >= 500) });
                locked.current = false; setSaving(null); if (failure.status === 401) notifyAdminSessionExpired();
            });
            if (!acknowledged || !alive.current) return;
        }
        setSnapshot(previous => previous && ({ ...previous, sections: { ...previous.sections, [kind]: { ...previous.sections[kind], savedActive: section.active } } }));
        locked.current = false; setSaving(null); setFeedback({ kind, savedKeys, success: true });
    };
    return { snapshot, loading, readFailure, feedback, saving, busy: saving !== null, writeBlocked: !!feedback?.failure, refresh, edit, activate, save };
}

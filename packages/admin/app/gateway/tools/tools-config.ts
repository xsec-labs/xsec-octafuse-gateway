import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import { parseWebSearchCatalogInput, WEB_SEARCH_PROVIDERS, DEFAULT_WEB_SEARCH_COST, DEFAULT_WEB_SEARCH_PROVIDER } from '@octafuse/core/lib/web-search-system-config';
import { parseWebFetchCatalogInput, WEB_FETCH_PROVIDERS, DEFAULT_WEB_FETCH_COST, DEFAULT_WEB_FETCH_PROVIDER } from '@octafuse/core/lib/web-fetch-system-config';
import { parseWebDeepSearchCatalogInput, WEB_DEEP_SEARCH_PROVIDERS, DEFAULT_WEB_DEEP_SEARCH_COST, DEFAULT_WEB_DEEP_SEARCH_PROVIDER } from '@octafuse/core/lib/web-deep-search-system-config';
import { parseAiDetectionCatalogInput, AI_DETECTION_PROVIDERS, DEFAULT_AI_DETECTION_COST, DEFAULT_AI_DETECTION_PROVIDER, DEFAULT_AI_DETECTION_BILLING_UNIT_CHARS, AI_DETECTION_PROVIDER_REQUIRED_CREDENTIALS, type AiDetectionCatalogEntry } from '@octafuse/core/lib/ai-detection-system-config';
import { getAiDetectionCredentialFields } from '@/lib/ai-detection-options';
import { toToolPricingFields } from '@octafuse/core/lib/tool-pricing';

export const TOOL_KINDS = ['webSearch', 'webFetch', 'webDeepSearch', 'aiDetection'] as const;
export type ToolKind = typeof TOOL_KINDS[number];
export const PRICE_FIELDS = ['standard', 'charged', 'metered'] as const;
export type PriceField = typeof PRICE_FIELDS[number];
export const CREDENTIAL_FIELDS = ['apiKey', 'secretId', 'secretKey', 'email', 'region', 'bizType'] as const;
export type CredentialField = typeof CREDENTIAL_FIELDS[number];
export type ToolDraft = Record<PriceField | CredentialField | 'billingUnitChars', string>;
export type ToolSectionState = { active: string; savedActive: string | null; drafts: Record<string, ToolDraft> };
export type ToolsSnapshot = { sections: Record<ToolKind, ToolSectionState>; currency: string };

export const TOOL_CONFIG = {
    webSearch: { id: 'web-search', prefix: 'WEB_SEARCH', providers: WEB_SEARCH_PROVIDERS, defaultProvider: DEFAULT_WEB_SEARCH_PROVIDER, cost: DEFAULT_WEB_SEARCH_COST, parse: parseWebSearchCatalogInput, legacy: true },
    webFetch: { id: 'web-fetch', prefix: 'WEB_FETCH', providers: WEB_FETCH_PROVIDERS, defaultProvider: DEFAULT_WEB_FETCH_PROVIDER, cost: DEFAULT_WEB_FETCH_COST, parse: parseWebFetchCatalogInput, legacy: true },
    webDeepSearch: { id: 'web-deep-search', prefix: 'WEB_DEEP_SEARCH', providers: WEB_DEEP_SEARCH_PROVIDERS, defaultProvider: DEFAULT_WEB_DEEP_SEARCH_PROVIDER, cost: DEFAULT_WEB_DEEP_SEARCH_COST, parse: parseWebDeepSearchCatalogInput, legacy: false },
    aiDetection: { id: 'ai-detection', prefix: 'AI_DETECTION', providers: AI_DETECTION_PROVIDERS, defaultProvider: DEFAULT_AI_DETECTION_PROVIDER, cost: DEFAULT_AI_DETECTION_COST, parse: parseAiDetectionCatalogInput, legacy: false },
} as const;

export function parseDraftMoney(raw: string): number | null {
    if (!raw.trim()) return null;
    const value = Number(raw.trim());
    return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Validate the full read before publishing any editable configuration. */
export function parseTools(body: unknown): ToolsSnapshot {
    parseShellSuccess(body);
    if (!isRecord(body) || !Array.isArray(body.data)) throw new ShellRequestError('INVALID_RESPONSE');
    const values = new Map<string, string>();
    for (const row of body.data) {
        if (!isRecord(row) || typeof row.key !== 'string' || !row.key.trim() || values.has(row.key) || typeof row.value !== 'string' || !(row.description === null || typeof row.description === 'string')) throw new ShellRequestError('INVALID_RESPONSE');
        values.set(row.key, row.value);
    }
    const currency = values.get('BILLING_CURRENCY')?.trim().toUpperCase() || 'USD';
    if (!['USD', 'CNY'].includes(currency)) throw new ShellRequestError('INVALID_RESPONSE');
    const sections = {} as Record<ToolKind, ToolSectionState>;
    for (const kind of TOOL_KINDS) {
        const definition = TOOL_CONFIG[kind], providers: readonly string[] = definition.providers;
        const activeRaw = values.get(definition.prefix + '_ACTIVE')?.trim().toLowerCase() || '';
        if (activeRaw && !providers.includes(activeRaw)) throw new ShellRequestError('INVALID_RESPONSE');
        const drafts: Record<string, ToolDraft> = {};
        for (const provider of providers) drafts[provider] = {
            apiKey: '', secretId: '', secretKey: '', email: '', region: provider === 'tencent_tms' ? 'ap-guangzhou' : '', bizType: '',
            standard: String(definition.cost), charged: String(definition.cost), metered: String(definition.cost), billingUnitChars: String(DEFAULT_AI_DETECTION_BILLING_UNIT_CHARS),
        };
        const catalogRaw = values.get(definition.prefix + '_CATALOG')?.trim();
        let active: string = activeRaw || definition.defaultProvider;
        if (catalogRaw) {
            const catalog: Partial<Record<string, AiDetectionCatalogEntry>> | null = definition.parse(catalogRaw);
            if (!catalog) throw new ShellRequestError('INVALID_RESPONSE');
            // The core parser owns price/legacy-cost semantics; check credential types before it normalizes optional strings.
            const raw: unknown = JSON.parse(catalogRaw);
            if (!isRecord(raw)) throw new ShellRequestError('INVALID_RESPONSE');
            const normalizedProviders = new Set<string>();
            for (const [provider, entry] of Object.entries(raw)) {
                const normalized = provider.trim().toLowerCase();
                if (normalizedProviders.has(normalized) || !isRecord(entry)) throw new ShellRequestError('INVALID_RESPONSE');
                normalizedProviders.add(normalized);
                for (const field of CREDENTIAL_FIELDS) if (entry[field] !== undefined && typeof entry[field] !== 'string') throw new ShellRequestError('INVALID_RESPONSE');
            }
            for (const provider of providers) {
                const entry = catalog[provider];
                if (!entry) continue;
                for (const field of PRICE_FIELDS) drafts[provider][field] = String(entry[field]);
                for (const field of CREDENTIAL_FIELDS) if (entry[field] !== undefined) drafts[provider][field] = entry[field];
                if (entry.billingUnitChars !== undefined) drafts[provider].billingUnitChars = String(entry.billingUnitChars);
            }
        } else if (definition.legacy) {
            const legacyProvider = values.get(definition.prefix + '_PROVIDER')?.trim().toLowerCase() || definition.defaultProvider;
            const legacyCost = values.get(definition.prefix + '_COST')?.trim() || String(definition.cost);
            if (!providers.includes(legacyProvider) || parseDraftMoney(legacyCost) === null) throw new ShellRequestError('INVALID_RESPONSE');
            drafts[legacyProvider].apiKey = values.get(definition.prefix + '_API_KEY') || '';
            for (const field of PRICE_FIELDS) drafts[legacyProvider][field] = legacyCost;
            active = activeRaw || legacyProvider;
        }
        sections[kind] = { active, savedActive: activeRaw || null, drafts };
    }
    return { sections, currency };
}

export function hasCredentials(kind: ToolKind, provider: string, draft: ToolDraft): boolean {
    if (kind !== 'aiDetection') return !!draft.apiKey.trim();
    if (provider !== 'tencent_tms') return false;
    return AI_DETECTION_PROVIDER_REQUIRED_CREDENTIALS[provider].every(field => !!draft[field].trim());
}
export function credentialFields(kind: ToolKind): readonly CredentialField[] {
    return kind === 'aiDetection' ? [...getAiDetectionCredentialFields('tencent_tms'), 'region', 'bizType'] : ['apiKey'];
}
function draftEntry(kind: ToolKind, draft: ToolDraft): AiDetectionCatalogEntry {
    const entry: AiDetectionCatalogEntry = toToolPricingFields({ standard: Number(draft.standard), charged: Number(draft.charged), metered: Number(draft.metered) });
    if (kind === 'aiDetection') {
        entry.billingUnitChars = Number(draft.billingUnitChars);
        for (const field of CREDENTIAL_FIELDS) if (draft[field].trim()) entry[field] = draft[field].trim();
    } else entry.apiKey = draft.apiKey.trim();
    return entry;
}
export function buildToolSave(kind: ToolKind, state: ToolSectionState): { entries: { key: string; value: string }[] } | { errorKey: string; focusId: string } {
    const definition = TOOL_CONFIG[kind], catalog: Record<string, AiDetectionCatalogEntry> = {};
    const invalid = (field: string, provider: string) => ({ errorKey: 'invalid' + kind[0].toUpperCase() + kind.slice(1) + 'Cost', focusId: `${definition.id}-${provider}-${field}` });
    for (const provider of definition.providers) {
        const draft = state.drafts[provider];
        for (const field of PRICE_FIELDS) if (parseDraftMoney(draft[field]) === null) return invalid(field, provider);
        if (kind === 'aiDetection' && (!draft.billingUnitChars.trim() || !Number.isInteger(Number(draft.billingUnitChars)) || Number(draft.billingUnitChars) < 1)) return invalid('billingUnitChars', provider);
        catalog[provider] = draftEntry(kind, draft);
    }
    if (!(definition.providers as readonly string[]).includes(state.active) || !hasCredentials(kind, state.active, state.drafts[state.active])) return { errorKey: 'noKeyCannotActivate', focusId: `${definition.id}-active` };
    if (state.savedActive && state.savedActive !== state.active && !hasCredentials(kind, state.savedActive, state.drafts[state.savedActive])) return { errorKey: 'switchActiveBeforeClearingKey', focusId: `${definition.id}-${state.savedActive}-${credentialFields(kind)[0]}` };
    return { entries: [{ key: definition.prefix + '_CATALOG', value: JSON.stringify(catalog) }, { key: definition.prefix + '_ACTIVE', value: state.active }] };
}

'use client';

/**
 * 全站用户审计日志（`user_audit_logs`）：筛选、分页；数据来自 `/api/admin/budget-audit-logs`。
 */
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ControlButton, Dialog, EmptyState, Field, Input, PageHeader, Spinner, Table } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { CopyControl } from '@/components/GatewayCopyControl';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { parseAuditLogs, parseAuditReasons, parseAuditCurrency } from './audit-api';
import { useAuditResource } from './use-audit-resource';
import { AuditFilter } from './audit-filter';
import './audit-logs.css';
import {
  API_KEY_BUDGET_AUDIT_ACTOR_TYPES,
  API_KEY_BUDGET_AUDIT_EVENT_TYPES,
  API_KEY_BUDGET_AUDIT_SOURCE_CHANNELS,
  type GatewayApiKeyBudgetAuditLog,
} from '@/lib/types';
import { AuditRange } from './audit-range';
import {
  createRangeValue,
  DEFAULT_GATEWAY_TIME_RANGE_PRESET,
  detectRollingPreset,
  type GatewayTimeRangeValue,
} from '@/lib/analytics-range';
import { formatGatewayDateTime } from '@/lib/datetime';
import { formatGatewayMoneyCode, formatGatewayMoneyCodeSigned } from '@/lib/format-gateway-currency';
import { GATEWAY_MONEY_DECIMAL_PLACES } from '@/lib/gateway-money';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';

/** 已在 Spend / Budget plan 列展示的快照字段，不在「User change detail」重复 */
const OMIT_AUDIT_LOG_SNAPSHOT_FIELDS = [
	'budget_spent',
	'budget_max',
	'budget_base',
	'budget_period',
	'budget_reset_at',
] as const;

const DEFAULT_AUDIT_LOG_EVENT_TYPES = API_KEY_BUDGET_AUDIT_EVENT_TYPES.filter((type) => type !== 'usage_charge');
const AUDIT_LOG_EVENT_TYPE_SET = new Set<string>(API_KEY_BUDGET_AUDIT_EVENT_TYPES);
const DEFAULT_AUDIT_LOG_ACTOR_TYPES = [...API_KEY_BUDGET_AUDIT_ACTOR_TYPES];
const AUDIT_LOG_ACTOR_TYPE_SET = new Set<string>(API_KEY_BUDGET_AUDIT_ACTOR_TYPES);
const DEFAULT_AUDIT_LOG_SOURCE_CHANNELS = [...API_KEY_BUDGET_AUDIT_SOURCE_CHANNELS];
const AUDIT_LOG_SOURCE_CHANNEL_SET = new Set<string>(API_KEY_BUDGET_AUDIT_SOURCE_CHANNELS);

const EMPTY_REASONS: string[] = [];

function normalizeAuditEventTypes(values: string[]): string[] {
  const normalized: string[] = [];
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .forEach((value) => {
      if (AUDIT_LOG_EVENT_TYPE_SET.has(value) && !normalized.includes(value)) normalized.push(value);
    });
  return normalized;
}

function normalizeAuditActorTypes(values: string[]): string[] {
  const normalized: string[] = [];
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .forEach((value) => {
      if (AUDIT_LOG_ACTOR_TYPE_SET.has(value) && !normalized.includes(value)) normalized.push(value);
    });
  return normalized;
}

function normalizeAuditSourceChannels(values: string[]): string[] {
  const normalized: string[] = [];
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .forEach((value) => {
      if (AUDIT_LOG_SOURCE_CHANNEL_SET.has(value) && !normalized.includes(value)) normalized.push(value);
    });
  return normalized;
}

function normalizeAuditReasonCodes(values: string[]): string[] {
  const normalized: string[] = [];
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .forEach((value) => {
      if (value !== '' && !normalized.includes(value)) normalized.push(value);
    });
  return normalized;
}

function appendAuditEventTypeParams(params: URLSearchParams, eventTypes: string[]): void {
  eventTypes.forEach((eventType) => params.append('event_type', eventType));
}

function appendAuditActorTypeParams(params: URLSearchParams, actorTypes: string[]): void {
  if (actorTypes.length === DEFAULT_AUDIT_LOG_ACTOR_TYPES.length) return;
  actorTypes.forEach((actorType) => params.append('actor_type', actorType));
}

function appendAuditSourceParams(params: URLSearchParams, sources: string[]): void {
  if (sources.length === DEFAULT_AUDIT_LOG_SOURCE_CHANNELS.length) return;
  sources.forEach((source) => params.append('source', source));
}

function appendAuditReasonCodeParams(params: URLSearchParams, reasonCodes: string[], allReasonCodes: string[]): void {
  const selectedSet = new Set(reasonCodes);
  const isAllSelected = allReasonCodes.length > 0 && allReasonCodes.every((reasonCode) => selectedSet.has(reasonCode));
  if (reasonCodes.length === 0 || (isAllSelected && selectedSet.size === allReasonCodes.length)) return;
  reasonCodes.forEach((reasonCode) => params.append('reason_code', reasonCode));
}

/** change_payload 展开行：去掉已由 Budget plan / Time / Event 列展示的键 */
function shouldOmitChangePayloadDisplayLine(line: string): boolean {
	const colon = line.indexOf(':');
	const key = (colon === -1 ? line : line.slice(0, colon)).trim();
	if (!key) return false;
	if (key.startsWith('before_budget_') || key.startsWith('after_budget_')) return true;
	if (['actor_id', 'reason_code', 'reason_text', 'source', 'correlation_id'].includes(key)) return true;
	return false;
}

function formatSignedMoney(value: number, currency: string): string {
  return formatGatewayMoneyCodeSigned(value, currency, GATEWAY_MONEY_DECIMAL_PLACES);
}

function formatPlainMoney(value: number, currency: string): string {
  return formatGatewayMoneyCode(value, currency, GATEWAY_MONEY_DECIMAL_PLACES);
}

function formatBudgetMax(value: number | null, currency: string, noLimitLabel: string): string {
  if (value == null) return noLimitLabel;
  return formatGatewayMoneyCode(value, currency, GATEWAY_MONEY_DECIMAL_PLACES);
}

function formatAuditTime(iso: string | null | undefined, timeZone: string): string {
  if (iso == null || iso === '') return '—';
  return formatGatewayDateTime(iso, timeZone);
}

function shortId(id: string | null | undefined): string {
  if (id == null || id === '') return '—';
  if (id.length < 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Reason 行：code / text 并存且不同时压缩为一行「code · text」，否则单行。 */
function auditReasonOneLine(reasonCode: string | null | undefined, reasonText: string | null | undefined): {
	line: string;
	isMono: boolean;
	title: string;
} {
	const rc = (reasonCode ?? '').trim();
	const rt = (reasonText ?? '').trim();
	if (!rc && !rt) return { line: '—', isMono: true, title: '' };
	if (rc && rt && rc !== rt) {
		const line = `${rc} · ${rt}`;
		return { line, isMono: false, title: line };
	}
	const single = rt || rc;
	return { line: single, isMono: !!rc && !rt, title: single };
}

/** 从 `change_payload` 解析的扩展字段（与 `@octafuse/core` `mergeUserAuditChangePayload` 写入结构对齐） */
function auditDisplayExtras(item: GatewayApiKeyBudgetAuditLog) {
  const m = parseAuditJsonObject(item.change_payload) ?? {};
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    reason_text: item.reason_text ?? str(m.reason_text),
    reason_code: item.reason_code ?? str(m.reason_code),
    actor_id: item.actor_id ?? str(m.actor_id),
    source: item.source ?? str(m.source),
    correlation_id: item.correlation_id ?? str(m.correlation_id),
    before_budget_period: item.before_budget_period ?? str(m.before_budget_period),
    after_budget_period: item.after_budget_period ?? str(m.after_budget_period),
    before_budget_reset_at: item.before_budget_reset_at ?? str(m.before_budget_reset_at),
    after_budget_reset_at: item.after_budget_reset_at ?? str(m.after_budget_reset_at),
  };
}

function isAuditObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** 与网关金额精度一致，用于判断 budget_max / budget_base 是否变化 */
function budgetMoneySemanticallyEqual(
  before: number | null | undefined,
  after: number | null | undefined
): boolean {
  if (before == null && after == null) return true;
  if (before == null || after == null) return false;
  return before.toFixed(GATEWAY_MONEY_DECIMAL_PLACES) === after.toFixed(GATEWAY_MONEY_DECIMAL_PLACES);
}

function budgetResetAtSemanticallyEqual(
  before: string | null | undefined,
  after: string | null | undefined
): boolean {
  if ((before == null || before === '') && (after == null || after === '')) return true;
  if (!before || !after) return false;
  const tb = new Date(before).getTime();
  const ta = new Date(after).getTime();
  if (Number.isNaN(tb) || Number.isNaN(ta)) return before === after;
  return tb === ta;
}

const budgetPlanHighlight = {
  before: 'audit-before',
  after: 'audit-after',
} as const;

type AuditDiffRow = {
  group: 'snapshot' | 'payload';
  field: string;
  before: string;
  after: string;
  beforeObject: boolean;
  afterObject: boolean;
};

function parseAuditJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (raw == null || raw.trim() === '') return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isAuditObject(parsed)) throw new Error('AUDIT_JSON_OBJECT_REQUIRED');
  return parsed;
}
function parseAuditChangedFields(raw: string | null | undefined): string[] | null {
  if (raw == null || raw.trim() === '') return null;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(value => typeof value === 'string' && value.length > 0)) throw new Error('AUDIT_CHANGED_FIELDS_REQUIRED');
  return parsed;
}
function formatAuditDiffValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function pushAuditDiffRow(rows: AuditDiffRow[], group: AuditDiffRow['group'], field: string, before: unknown, after: unknown) {
  const beforeText = formatAuditDiffValue(before);
  const afterText = formatAuditDiffValue(after);
  if (beforeText === afterText) return;
  rows.push({ group, field, before: beforeText, after: afterText, beforeObject: isAuditObject(before), afterObject: isAuditObject(after) });
}

function pushNestedAuditDiffRows(
  rows: AuditDiffRow[],
  group: AuditDiffRow['group'],
  field: string,
  before: unknown,
  after: unknown,
  depth = 0
) {
  if ((isAuditObject(before) || isAuditObject(after)) && depth < 4) {
    const beforeObject = isAuditObject(before) ? before : {};
    const afterObject = isAuditObject(after) ? after : {};
    const keys = Array.from(new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]));
    keys.forEach((key) => {
      pushNestedAuditDiffRows(
        rows,
        group,
        `${field}.${key}`,
        beforeObject[key],
        afterObject[key],
        depth + 1
      );
    });
    return;
  }
  pushAuditDiffRow(rows, group, field, before, after);
}

function appendSnapshotDiffRows(rows: AuditDiffRow[], item: GatewayApiKeyBudgetAuditLog) {
  const before = parseAuditJsonObject(item.before_user_snapshot ?? null);
  const after = parseAuditJsonObject(item.after_user_snapshot ?? null);
  if (!before && !after) return;

  const fields = parseAuditChangedFields(item.changed_fields ?? null);
  const keys =
    fields && fields.length > 0
      ? fields
      : Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter((key) => key !== 'id');
  const omitted = new Set<string>(OMIT_AUDIT_LOG_SNAPSHOT_FIELDS);
  keys.forEach((key) => {
    if (omitted.has(key)) return;
    pushNestedAuditDiffRows(rows, 'snapshot', key, before?.[key], after?.[key]);
  });
}

function appendPayloadDiffRows(rows: AuditDiffRow[], raw: string | null | undefined) {
  const payload = parseAuditJsonObject(raw);
  if (!payload) return;

  const handled = new Set<string>();
  const status = payload.status;
  if (isAuditObject(status) && ('from' in status || 'to' in status)) {
    pushAuditDiffRow(rows, 'payload', 'status', status.from, status.to);
    handled.add('status');
  }

  const metadata = payload.metadata;
  if (isAuditObject(metadata)) {
    handled.add('metadata');
    const changes = metadata.changes;
    if (isAuditObject(changes)) {
      Object.entries(changes).forEach(([key, value]) => {
        if (isAuditObject(value) && ('from' in value || 'to' in value)) {
          pushAuditDiffRow(rows, 'payload', `metadata.${key}`, value.from, value.to);
        } else {
          pushAuditDiffRow(rows, 'payload', `metadata.${key}`, '—', value);
        }
      });
    } else if ('from' in metadata || 'to' in metadata) {
      pushAuditDiffRow(rows, 'payload', 'metadata', metadata.from, metadata.to);
      pushNestedAuditDiffRows(rows, 'payload', 'metadata', metadata.from, metadata.to);
    } else {
      Object.entries(metadata).forEach(([key, value]) => {
        if (key === 'operation') return;
        pushAuditDiffRow(rows, 'payload', `metadata.${key}`, '—', value);
      });
    }
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (handled.has(key)) return;
    if (key.startsWith('before_') || key.startsWith('after_')) return;
    if (key === 'metadata_patch_keys' || shouldOmitChangePayloadDisplayLine(`${key}:`)) return;
    if (isAuditObject(value) && ('from' in value || 'to' in value)) {
      pushAuditDiffRow(rows, 'payload', key, value.from, value.to);
    }
  });

  Object.keys(payload)
    .filter((key) => key.startsWith('before_'))
    .forEach((beforeKey) => {
      const suffix = beforeKey.slice('before_'.length);
      const afterKey = `after_${suffix}`;
      if (!(afterKey in payload)) return;
      if (shouldOmitChangePayloadDisplayLine(beforeKey) || shouldOmitChangePayloadDisplayLine(afterKey)) return;
      pushAuditDiffRow(rows, 'payload', suffix, payload[beforeKey], payload[afterKey]);
    });
}

function auditDiffRows(item: GatewayApiKeyBudgetAuditLog): AuditDiffRow[] {
  const rows: AuditDiffRow[] = [];
  appendSnapshotDiffRows(rows, item);
  appendPayloadDiffRows(rows, item.change_payload);
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.field}:${row.before}:${row.after}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function auditSummaryDiffRows(rows: AuditDiffRow[]): AuditDiffRow[] {
  return rows.filter(row => row.field !== 'metadata' && !row.beforeObject && !row.afterObject);
}
function readAuditDisplay(item: GatewayApiKeyBudgetAuditLog) {
  try { return {kind: 'valid' as const, rows: auditDiffRows(item), extras: auditDisplayExtras(item)}; }
  catch { return {kind: 'invalid' as const, code: 'INVALID_AUDIT_JSON'}; }
}

const subscribeHydration = () => () => {};
export default function GatewayAuditLogsPage() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const common = useTranslations('common');
  return hydrated ? <AuditLogs query={window.location.search} /> : <Spinner label={common('loading')} />;
}
function initialQuery(query: string, timezone: string) {
  const params = new URLSearchParams(query), start = params.get('start_date'), end = params.get('end_date');
  const eventTypes = normalizeAuditEventTypes(params.getAll('event_type')), actorTypes = normalizeAuditActorTypes(params.getAll('actor_type')), sources = normalizeAuditSourceChannels(params.getAll('source')), reasons = normalizeAuditReasonCodes(params.getAll('reason_code'));
  const page = Number(params.get('page'));
  const range: GatewayTimeRangeValue = start === null && end === null ? createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET, timezone) : {preset: start && end ? detectRollingPreset(start, end) ?? 'custom' : 'custom', start_date: start ?? '', end_date: end ?? ''};
  return {apiKeyId: params.get('api_key_id') ?? '', userId: params.get('user_id') ?? '', userEmail: params.get('user_email') ?? '', correlationId: params.get('correlation_id') ?? '', page: Number.isSafeInteger(page) && page >= 1 ? page : 1, eventTypes: eventTypes.length ? eventTypes : [...DEFAULT_AUDIT_LOG_EVENT_TYPES], actorTypes: actorTypes.length ? actorTypes : [...DEFAULT_AUDIT_LOG_ACTOR_TYPES], sources: sources.length ? sources : [...DEFAULT_AUDIT_LOG_SOURCE_CHANNELS], reasons: reasons.length ? reasons : null, range};
}
type AuditRead = {path: string; status: 'loading'} | {path: string; status: 'ready'; logs: GatewayApiKeyBudgetAuditLog[]; total: number} | {path: string; status: 'failed'; failure: ShellFailure};
const EMPTY_LOGS: GatewayApiKeyBudgetAuditLog[] = [];
function AuditLogs({query}: {query: string}) {
  const t = useTranslations('auditLogs');
  const tCommon = useTranslations('common');
  const tShell = useTranslations('shell');
  const { businessTimezone } = useGatewayDateTime();
  const [initial] = useState(() => initialQuery(query, businessTimezone));
  const [advancedOpen, setAdvancedOpen] = useState(initial.reasons !== null || initial.sources.length < DEFAULT_AUDIT_LOG_SOURCE_CHANNELS.length);
  const [readState, setReadState] = useState<AuditRead | null>(null);
  const pageSize = 50;
  const currency = useAuditResource('/api/admin/config', parseAuditCurrency);
  const billingCurrency = currency.value;
  const reasons = useAuditResource('/api/admin/budget-audit-logs/filters', parseAuditReasons);
  const reasonCodeOptions = reasons.value ?? EMPTY_REASONS;
  const {run, cancel} = useShellRequest();
  const detailReturnFocus = useRef<HTMLElement | null>(null);
  const [detailLog, setDetailLog] = useState<GatewayApiKeyBudgetAuditLog | null>(null);
  const [page, setPage] = useState(initial.page);
  const [filterApiKeyId, setFilterApiKeyId] = useState(initial.apiKeyId);
  const [filterUserId, setFilterUserId] = useState(initial.userId);
  const [filterUserEmail, setFilterUserEmail] = useState(initial.userEmail);
  const [filterEventTypes, setFilterEventTypes] = useState<string[]>(initial.eventTypes);
  const [filterActorTypes, setFilterActorTypes] = useState<string[]>(initial.actorTypes);
  const [selectedReasons, setFilterReasonCodes] = useState<string[] | null>(initial.reasons);
  const filterReasonCodes = selectedReasons ?? reasonCodeOptions;
  const [filterSources, setFilterSources] = useState<string[]>(initial.sources);
  const [filterCorrelationId, setFilterCorrelationId] = useState(initial.correlationId);
  const [rangeValue, setRangeValue] = useState<GatewayTimeRangeValue>(initial.range);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({page: String(page), page_size: String(pageSize)});
    if (filterApiKeyId) params.append('api_key_id', filterApiKeyId);
    if (filterUserId) params.append('user_id', filterUserId);
    if (filterUserEmail) params.append('user_email', filterUserEmail);
    appendAuditEventTypeParams(params, filterEventTypes);
    appendAuditActorTypeParams(params, filterActorTypes);
    appendAuditReasonCodeParams(params, filterReasonCodes, reasonCodeOptions);
    appendAuditSourceParams(params, filterSources);
    if (filterCorrelationId) params.append('correlation_id', filterCorrelationId);
    params.append('start_date', rangeValue.start_date);
    params.append('end_date', rangeValue.end_date);
    return params;
  }, [page, filterApiKeyId, filterUserId, filterUserEmail, filterEventTypes, filterActorTypes, filterReasonCodes, reasonCodeOptions, filterSources, filterCorrelationId, rangeValue.start_date, rangeValue.end_date]);

  useEffect(() => {
    if (reasons.value === null) return;
    const url = new URL(window.location.href); url.search = buildParams().toString();
    window.history.replaceState(window.history.state, '', url);
  }, [buildParams, reasons.value]);

  const listPath = '/api/admin/budget-audit-logs?' + buildParams();
  const fetchLogs = useCallback(() => {
    if (reasons.value === null) return;
    return run(listPath, {}, body => parseAuditLogs(body, page),
      result => setReadState({path: listPath, status: 'ready', ...result}),
      failure => { if (failure.status === 401) notifyAdminSessionExpired(); setReadState({path: listPath, status: 'failed', failure}); },
    );
  }, [listPath, page, reasons.value, run]);
  useEffect(() => { void fetchLogs(); return cancel; }, [fetchLogs, cancel]);
  const currentRead = readState?.path === listPath && reasons.value !== null ? readState : null;
  const isLoading = currentRead === null || currentRead.status === 'loading';
  const readFailure = currentRead?.status === 'failed' ? currentRead.failure : null;
  const logs = currentRead?.status === 'ready' ? currentRead.logs : EMPTY_LOGS;
  const total = currentRead?.status === 'ready' ? currentRead.total : 0;
  const refreshLogs = () => {setReadState({path: listPath, status: 'loading'}); void fetchLogs();};

  const displayedLogs = useMemo(() => logs.map(item => ({item, display: readAuditDisplay(item)})), [logs]);
  const detailDisplay = detailLog ? displayedLogs.find(({item}) => item.id === detailLog.id)?.display : null;
  const rawDetail = useMemo(() => detailLog ? JSON.stringify(detailLog, null, 2) : '', [detailLog]);
  const openDetail = (item: GatewayApiKeyBudgetAuditLog, target: HTMLElement) => { detailReturnFocus.current = target; setDetailLog(item); };

  const totalPages = Math.ceil(total / pageSize);
  const setEventTypeChecked = (eventType: string, checked: boolean) => {
    setFilterEventTypes((current) => {
      if (checked) return current.includes(eventType) ? current : [...current, eventType];
      if (current.length <= 1) return current;
      return current.filter((value) => value !== eventType);
    });
    setPage(1);
  };
  const setActorTypeChecked = (actorType: string, checked: boolean) => {
    setFilterActorTypes((current) => {
      if (checked) return current.includes(actorType) ? current : [...current, actorType];
      if (current.length <= 1) return current;
      return current.filter((value) => value !== actorType);
    });
    setPage(1);
  };
  const setSourceChecked = (source: string, checked: boolean) => {
    setFilterSources((current) => {
      if (checked) return current.includes(source) ? current : [...current, source];
      if (current.length <= 1) return current;
      return current.filter((value) => value !== source);
    });
    setPage(1);
  };
  const setReasonCodeChecked = (reasonCode: string, checked: boolean) => {
    setFilterReasonCodes(current => {
      const values = current ?? reasonCodeOptions;
      if (checked) return values.includes(reasonCode) ? values : [...values, reasonCode];
      return values.length <= 1 ? values : values.filter(value => value !== reasonCode);
    });
    setPage(1);
  };
  const detailRows = detailDisplay?.kind === 'valid' ? detailDisplay.rows : [];
  const visibleReasonOptions = [...new Set([...reasonCodeOptions, ...filterReasonCodes])];

  return (
    <div className="audit-logs-page p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <AuditRange value={rangeValue} onChange={value => { setRangeValue(value); setPage(1); }} />
      <div className="audit-filters-panel">
        <AuditFilter label={t('filters.eventType')} options={API_KEY_BUDGET_AUDIT_EVENT_TYPES} selected={filterEventTypes} onChange={setEventTypeChecked} count={tCommon('selected', {count: filterEventTypes.length})} actions={<>
          <ControlButton variant="ghost" onClick={() => {setFilterEventTypes([...API_KEY_BUDGET_AUDIT_EVENT_TYPES]); setPage(1);}}>{tCommon('selectAll')}</ControlButton>
          <ControlButton variant="ghost" onClick={() => {setFilterEventTypes([...DEFAULT_AUDIT_LOG_EVENT_TYPES]); setPage(1);}}>{t('filters.defaultEventTypes')}</ControlButton>
        </>} />
        <details className="audit-advanced-filters" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}><summary>{t('feedback.moreFilters')}</summary>{advancedOpen ? <div className="audit-advanced-content">
        <AuditFilter label={t('filters.source')} options={API_KEY_BUDGET_AUDIT_SOURCE_CHANNELS} selected={filterSources} onChange={setSourceChecked} count={tCommon('selected', {count: filterSources.length})} actions={<ControlButton variant="ghost" onClick={() => {setFilterSources([...DEFAULT_AUDIT_LOG_SOURCE_CHANNELS]); setPage(1);}}>{tCommon('selectAll')}</ControlButton>} />
        <AuditFilter label={t('filters.reasonCode')} options={visibleReasonOptions} selected={filterReasonCodes} onChange={(value, checked) => {setReasonCodeChecked(value, checked);}} disabled={reasons.loading || !!reasons.failure} count={tCommon('selected', {count: filterReasonCodes.length})} actions={<ControlButton variant="ghost" disabled={reasons.value === null || reasonCodeOptions.length === 0} onClick={() => {setFilterReasonCodes(null); setPage(1);}}>{tCommon('selectAll')}</ControlButton>} />
        </div> : null}</details>
        {reasons.loading ? <Spinner label={tCommon('loading')} /> : reasons.failure ? <ShellError title={t('feedback.reasonsFailed')} failure={reasons.failure} action={<ControlButton onClick={() => void reasons.refresh()}>{tShell('retry')}</ControlButton>} /> : reasonCodeOptions.length === 0 ? <p className="audit-muted">{t('filters.noReasonCodes')}</p> : null}
        <div className="audit-text-filters">
          <AuditFilter label={t('filters.actor')} options={API_KEY_BUDGET_AUDIT_ACTOR_TYPES} selected={filterActorTypes} onChange={setActorTypeChecked} count={tCommon('selected', {count: filterActorTypes.length})} actions={<ControlButton variant="ghost" onClick={() => {setFilterActorTypes([...DEFAULT_AUDIT_LOG_ACTOR_TYPES]); setPage(1);}}>{tCommon('selectAll')}</ControlButton>} />
          <Field label={t('filters.userEmail')}>
            {props => <Input {...props} type="text" value={filterUserEmail} onChange={event => { setFilterUserEmail(event.target.value); setPage(1); }} placeholder={t('filters.exactMatch')} />}
          </Field>
          <Field label={t('filters.correlationId')}>
            {props => <Input {...props} type="text" value={filterCorrelationId} onChange={event => { setFilterCorrelationId(event.target.value); setPage(1); }} placeholder={t('filters.correlationPlaceholder')} />}
          </Field>
          <div className="flex items-end">
            <ControlButton variant="outline"
              type="button"
              onClick={() => {
                setFilterEventTypes([...DEFAULT_AUDIT_LOG_EVENT_TYPES]);
                setFilterActorTypes([...DEFAULT_AUDIT_LOG_ACTOR_TYPES]);
                setFilterReasonCodes(null);
                setFilterSources([...DEFAULT_AUDIT_LOG_SOURCE_CHANNELS]);
                setFilterCorrelationId('');
                setFilterUserEmail('');
                setFilterUserId('');
                setFilterApiKeyId('');
                setRangeValue({ preset: 'custom', start_date: '', end_date: '' });
                setPage(1);
              }}
              className="h-10 whitespace-nowrap px-4 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              {tCommon('clearFiltersLower')}
            </ControlButton>
          </div>
        </div>
      </div>

      {!isLoading && !readFailure && reasons.value !== null ? <div className="mb-3 text-sm text-gray-500">{t('totalRecords', { count: total })}</div> : null}

      {currency.loading ? <Spinner label={tCommon('loading')} /> : currency.failure ? <ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={() => void currency.refresh()}>{tShell('retry')}</ControlButton>} /> : null}
      {reasons.value === null ? null : isLoading ? <Spinner label={tCommon('loading')} /> : readFailure ? <ShellError title={t('feedback.logsFailed')} failure={readFailure} action={<ControlButton onClick={refreshLogs}>{tShell('retry')}</ControlButton>} /> : (
        <div className="audit-list">
          <div>
            <Table className="audit-table min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('table.time')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[11rem] max-w-[15rem]">{t('table.event')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[8.5rem] max-w-[12rem]">{t('table.actor')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[14rem]">{t('table.identity')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{t('table.spend')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[14rem]">{t('table.budgetPlan')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[16rem]">
                    {t('table.userChangeDetail')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <EmptyState title={t('empty')} />
                    </td>
                  </tr>
                ) : (
                  displayedLogs.map(({item, display}) => {
                    const ex = display.kind === 'valid' ? display.extras : item;
                    const maxChanged = !budgetMoneySemanticallyEqual(
                      item.before_budget_max,
                      item.after_budget_max
                    );
                    const baseChanged = !budgetMoneySemanticallyEqual(
                      item.before_budget_base,
                      item.after_budget_base
                    );
                    const periodChanged =
                      (ex.before_budget_period ?? '') !== (ex.after_budget_period ?? '');
                    const resetChanged = !budgetResetAtSemanticallyEqual(
                      ex.before_budget_reset_at,
                      ex.after_budget_reset_at
                    );
                    const reasonDisplay = auditReasonOneLine(ex.reason_code, ex.reason_text);
                    const diffRows = display.kind === 'valid' ? display.rows : [];
                    const summaryDiffRows = auditSummaryDiffRows(diffRows);
                    return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 align-top">
                        <div className="text-gray-700 whitespace-nowrap">{formatAuditTime(item.created_at, businessTimezone)}</div>
                        <div
                          className="mt-0.5 font-mono text-xs text-gray-600 whitespace-nowrap"
                          title={item.request_log_id || undefined}
                        >
                          {t('labels.req')}: {item.request_log_id ? shortId(item.request_log_id) : '—'}
                        </div>
                        {ex.correlation_id ? (
                          <div
                            className="mt-0.5 font-mono text-xs text-gray-500 whitespace-nowrap"
                            title={ex.correlation_id}
                          >
                            {t('labels.corr')}: {shortId(ex.correlation_id)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top min-w-0 max-w-[15rem]">
                        <div className="text-xs space-y-1.5 leading-snug">
                          <div className="min-w-0">
                            <span className="text-gray-500">{t('labels.type')}</span>
                            <span className="font-mono text-sm font-medium text-gray-900">{item.event_type}</span>
                          </div>
                          <div className="min-w-0 truncate font-mono text-[11px]" title={ex.source || undefined}>
                            <span className="text-gray-500 font-sans">{t('labels.from')}</span>
                            <span className="text-violet-800">{ex.source ?? '—'}</span>
                          </div>
                          <div className="min-w-0 line-clamp-3 text-gray-800" title={reasonDisplay.title || undefined}>
                            <span className="text-gray-500">{t('labels.reason')}</span>
                            <span className={reasonDisplay.isMono ? 'font-mono text-[11px] text-gray-900' : 'text-[11px]'}>
                              {reasonDisplay.line}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top min-w-0 max-w-[12rem]">
                        <div className="text-xs space-y-1.5 leading-snug">
                          <div>
                            <span className="text-gray-500">{t('labels.kind')}</span>
                            <span className="text-sm text-gray-900">{item.actor_type}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-gray-500">{t('labels.principal')}</span>
                            {ex.actor_id ? (
                              <span className="font-mono text-[11px] text-gray-700 break-all" title={ex.actor_id}>
                                {shortId(ex.actor_id)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top min-w-0 max-w-[18rem]">
                        <div className="text-sm text-gray-900 truncate leading-snug" title={item.user_email || ''}>
                          {item.user_email || '—'}
                        </div>
                        {item.user_id ? (
                          <div className="mt-0.5 flex items-baseline gap-1 min-w-0 font-mono text-xs">
                            <span className="shrink-0 text-gray-600">{t('labels.user')}</span>
                            <Link
                              href={`/gateway/users/${encodeURIComponent(item.user_id)}`}
                              className="min-w-0 truncate text-blue-600 hover:underline"
                              title={item.user_id}
                            >
                              {shortId(item.user_id)}
                            </Link>
                          </div>
                        ) : (
                          <div className="mt-0.5 font-mono text-xs text-gray-400 truncate" title={t('userRemovedTitle')}>
                            {t('labels.user')} —
                          </div>
                        )}
                        <div className="mt-0.5 font-mono text-xs text-gray-500 truncate leading-snug" title={item.api_key_id ?? ''}>
                          {t('labels.key')}{item.api_key_id ? shortId(item.api_key_id) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-600">
                        <div className="space-y-1 leading-snug">
                          <div className="grid grid-cols-[3rem_1fr] gap-x-2 items-baseline">
                            <span className="text-right font-medium text-gray-700">{t('labels.before')}</span>
                            <span>{billingCurrency ? formatPlainMoney(item.before_spent, billingCurrency) : '—'}</span>
                          </div>
                          <div className="grid grid-cols-[3rem_1fr] gap-x-2 items-baseline">
                            <span className="text-right font-medium text-gray-700">{t('labels.after')}</span>
                            <span>{billingCurrency ? formatPlainMoney(item.after_spent, billingCurrency) : '—'}</span>
                          </div>
                          <div className="grid grid-cols-[3rem_1fr] gap-x-2 items-baseline">
                            <span className="text-right font-medium text-gray-700">{t('labels.delta')}</span>
                            <span
                              className={
                                item.delta_spent > 0
                                  ? 'text-red-600'
                                  : item.delta_spent < 0
                                    ? 'text-green-600'
                                    : 'text-gray-600'
                              }
                            >
                              {billingCurrency ? formatSignedMoney(item.delta_spent, billingCurrency) : '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-600">
                        <div className="space-y-1 leading-snug">
                          <div>
                            <span className="font-medium text-gray-700">{t('labels.max')}</span>{' '}
                            <span className={maxChanged ? budgetPlanHighlight.before : undefined}>
                              {billingCurrency ? formatBudgetMax(item.before_budget_max, billingCurrency, tCommon('noLimit')) : '—'}
                            </span>
                            <span className="text-gray-400"> → </span>
                            <span className={maxChanged ? budgetPlanHighlight.after : undefined}>
                              {billingCurrency ? formatBudgetMax(item.after_budget_max, billingCurrency, tCommon('noLimit')) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">{t('labels.base')}</span>{' '}
                            <span className={baseChanged ? budgetPlanHighlight.before : undefined}>
                              {billingCurrency ? formatGatewayMoneyCode(item.before_budget_base, billingCurrency, GATEWAY_MONEY_DECIMAL_PLACES) : '—'}
                            </span>
                            <span className="text-gray-400"> → </span>
                            <span className={baseChanged ? budgetPlanHighlight.after : undefined}>
                              {billingCurrency ? formatGatewayMoneyCode(item.after_budget_base, billingCurrency, GATEWAY_MONEY_DECIMAL_PLACES) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">{t('labels.period')}</span>{' '}
                            <span className={periodChanged ? budgetPlanHighlight.before : undefined}>
                              {ex.before_budget_period ?? '—'}
                            </span>
                            <span className="text-gray-400"> → </span>
                            <span className={periodChanged ? budgetPlanHighlight.after : undefined}>
                              {ex.after_budget_period ?? '—'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">{t('labels.resetAt')}</span>{' '}
                            <span className="whitespace-nowrap">
                              <span className={resetChanged ? budgetPlanHighlight.before : undefined}>
                                {formatAuditTime(ex.before_budget_reset_at, businessTimezone)}
                              </span>
                              <span className="text-gray-400"> → </span>
                              <span className={resetChanged ? budgetPlanHighlight.after : undefined}>
                                {formatAuditTime(ex.after_budget_reset_at, businessTimezone)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600 min-w-[14rem] max-w-lg align-top">
                        <div className="space-y-1 text-xs leading-snug">
                          {display.kind === 'invalid' ? <><p role="alert" className="audit-json-error">{t('feedback.invalidJson')}</p><ControlButton variant="outline" onClick={event => openDetail(item, event.currentTarget)}>{t('labels.viewChangeDetail')}</ControlButton></> : summaryDiffRows.length > 0 ? (
                            <>
                              {summaryDiffRows.slice(0, 3).map((row, index) => (
                                <div key={`${item.id}-diff-${index}`} className="grid grid-cols-[minmax(5rem,8rem)_1fr] gap-x-2">
                                  <span className="truncate font-mono text-gray-700" title={row.field}>
                                    {row.field}
                                  </span>
                                  <span className="min-w-0 truncate" title={`${row.before} → ${row.after}`}>
                                    <span className="text-amber-700">{row.before}</span>
                                    <span className="px-1 text-gray-400">→</span>
                                    <span className="text-sky-700">{row.after}</span>
                                  </span>
                                </div>
                              ))}
                              <ControlButton variant="outline"
                                type="button"
                                onClick={event => openDetail(item, event.currentTarget)}
                                className="audit-detail-trigger"
                              >
                                {t('labels.viewChangeDetail')}
                                {summaryDiffRows.length > 3 ? ` · ${t('labels.more', { count: summaryDiffRows.length - 3 })}` : ''}
                              </ControlButton>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-400">—</span>
                                <ControlButton variant="outline"
                                  type="button"
                                  onClick={event => openDetail(item, event.currentTarget)}
                                  className="audit-detail-trigger"
                                >
                                  {t('labels.viewChangeDetail')}
                                </ControlButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={detailLog !== null && !isLoading && !readFailure} onOpenChange={open => {if (!open) setDetailLog(null);}} title={t('labels.changeDetailTitle')} description={detailLog ? <>{detailLog.event_type} · {formatAuditTime(detailLog.created_at, businessTimezone)} · {detailLog.user_email ?? '—'}</> : undefined} className="audit-detail-dialog" finalFocus={() => detailReturnFocus.current}>
        {detailLog ? <div className="audit-detail audit-logs-page">
          {detailDisplay?.kind === 'invalid' ? <p role="alert" className="audit-json-error">{t('feedback.invalidJson')}</p> : null}
            <div className="overflow-y-auto p-5">
              {detailDisplay?.kind === 'valid' && detailRows.length > 0 ? (
                <div className="space-y-3">
                  {detailRows.map((row, index) => (
                    <div key={`${row.group}-${row.field}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {row.group === 'snapshot' ? t('labels.userSnapshot') : t('labels.extraJson')}
                        </span>
                        <span className="min-w-0 break-all font-mono text-sm font-medium text-gray-900">
                          {row.field}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="min-w-0">
                          <div className="mb-1 text-xs font-medium uppercase text-gray-500">{t('labels.originalValue')}</div>
                          <pre className="audit-before max-w-full whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">{row.before}</pre>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 text-xs font-medium uppercase text-gray-500">{t('labels.changedValue')}</div>
                          <pre className="audit-after max-w-full whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">{row.after}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                detailDisplay?.kind === 'valid' ? <EmptyState title={t('labels.noChangeDetail')} /> : null
              )}
            </div>
            <section className="audit-raw"><div className="audit-raw-header"><h3>{t('feedback.rawRecord')}</h3><CopyControl value={rawDetail} label={tCommon('copy')} /></div><pre>{rawDetail}</pre></section>
        </div> : null}
      </Dialog>

      {totalPages > 1 && !isLoading && !readFailure && reasons.value !== null && (
        <div className="audit-pagination">
          <ControlButton variant="outline"
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            {tCommon('previous')}
          </ControlButton>
          <span className="px-4 py-2 text-sm text-gray-600">
            {tCommon('pageOf', { page, totalPages })}
          </span>
          <ControlButton variant="outline"
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            {tCommon('next')}
          </ControlButton>
        </div>
      )}
    </div>
  );
}

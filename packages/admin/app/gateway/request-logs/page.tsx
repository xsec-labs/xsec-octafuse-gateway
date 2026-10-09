'use client';

/**
 * 全站请求日志表：多维筛选、分页；Model / Route 分列展示模型与上游路由；抽屉展示计费审计和三份报文；数据来自 `/api/admin/request-logs`。
 */
import { useTranslations } from 'next-intl';
import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronRightIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import {
  ControlButton,
  ControlIconButton,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
} from '@xsec/ui-react';
import { readApiJson } from '@/lib/api-json';
import ShellError from '@/components/layout/ShellError';
import { CopyControl } from '@/components/GatewayCopyControl';
import { ShellRequestError, shellFailure, type ShellFailure } from '@/lib/shell-request';
import type { GatewayRequestLog } from '@/lib/types';
import {
  compareRouteGroupsForDisplay,
  normalizeRouteGroup,
  routeGroupBadgeClass,
} from '@/lib/route-group-ui';
import { UPSTREAM_PROTOCOLS } from '@/lib/upstream-protocol';
import { UpstreamProtocolBrandIcon } from '@/components/upstream-brand-logo';
import { RequestLogRange } from './request-log-range';
import {
  createRangeValue,
  DEFAULT_GATEWAY_TIME_RANGE_PRESET,
  detectRollingPreset,
  type GatewayTimeRangeValue,
} from '@/lib/analytics-range';
import { formatGatewayMoneyCode, formatGatewayMoneyCodeSigned, getGatewayCurrencySymbol } from '@/lib/format-gateway-currency';
import { summarizePricingAuditJson } from '@/lib/pricing-ui';
import { parseModels, parseProviders, parseRoutes, parseCurrency, parseLogs } from '@/lib/gateway-log-api';
import { useLogResource } from './use-log-resource';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import './request-logs.css';


export default function GatewayRequestLogsPage() {
  const t = useTranslations('requestLogs');
  const tCommon = useTranslations('common');
  const tOptions = useTranslations('options');
  const tShell = useTranslations('shell');
  const [logs, setLogs] = useState<GatewayRequestLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readFailure, setReadFailure] = useState<ShellFailure | null>(null);
  const requestOwner = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  /** 详情抽屉：pricing audit / 入口请求体 / 上游请求体 / raw usage */
  const [detailLogId, setDetailLogId] = useState<string | null>(null);
  const [timingHelpLog, setTimingHelpLog] = useState<GatewayRequestLog | null>(null);
  const detailReturnFocus = useRef<HTMLElement | null>(null);
  const timingReturnFocus = useRef<HTMLElement | null>(null);
  const [queryReady, setQueryReady] = useState(false);
  const pageSize = 50;
  const currency = useLogResource('/api/admin/config', parseCurrency);
  const billingCurrency = currency.value;
  const models = useLogResource('/api/admin/models', parseModels);
  const providers = useLogResource('/api/admin/providers', parseProviders);
  const routes = useLogResource('/api/admin/routes', parseRoutes);
  const { formatDateTime, businessTimezone } = useGatewayDateTime();
  const billingCurrencySym = billingCurrency ? getGatewayCurrencySymbol(billingCurrency) : '—';

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterUserEmail, setFilterUserEmail] = useState('');
  const [filterApiKeyId, setFilterApiKeyId] = useState('');
  const [rangeValue, setRangeValue] = useState<GatewayTimeRangeValue>(() => createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET, businessTimezone));
  const [filterProviderId, setFilterProviderId] = useState('');
  const [filterRouteGroup, setFilterRouteGroup] = useState('');
  const [filterProtocol, setFilterProtocol] = useState('');

  useEffect(() => {
    // Read filters from URL on mount (e.g. from Model / Provider Usage drill-down)
    const params = new URLSearchParams(window.location.search);
    const apiKeyId = params.get('api_key_id');
    const modelId = params.get('model_id');
    const providerId = params.get('provider_id');
    const userEmail = params.get('user_email');
    const status = params.get('status');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const routeGroup = params.get('route_group');
    const protocol = params.get('protocol');
    const pageParam = params.get('page');
    if (apiKeyId != null) setFilterApiKeyId(apiKeyId);
    if (modelId != null) setFilterModel(modelId);
    if (providerId != null) setFilterProviderId(providerId);
    if (userEmail != null) setFilterUserEmail(userEmail);
    if (status != null) setFilterStatus(status);
    const hasStart = startDate != null && startDate !== '';
    const hasEnd = endDate != null && endDate !== '';
    if (hasStart || hasEnd) {
      const s = hasStart ? startDate! : '';
      const e = hasEnd ? endDate! : '';
      setRangeValue({
        preset: hasStart && hasEnd ? detectRollingPreset(s, e) ?? 'custom' : 'custom',
        start_date: s,
        end_date: e,
      });
    } else if (startDate == null && endDate == null) {
      setRangeValue(createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET, businessTimezone));
    } else {
      setRangeValue({ preset: 'custom', start_date: '', end_date: '' });
    }
    if (routeGroup != null) setFilterRouteGroup(routeGroup);
    if (protocol != null) setFilterProtocol(protocol);
    if (pageParam != null) {
      const n = parseInt(pageParam, 10);
      if (!Number.isNaN(n) && n >= 1) setPage(n);
    }
    setQueryReady(true);
  }, [businessTimezone]);

  useEffect(
    () => {
      if (!queryReady) return;
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (filterStatus) params.append('status', filterStatus);
      if (filterModel) params.append('model_id', filterModel);
      if (filterProviderId) params.append('provider_id', filterProviderId);
      if (filterUserEmail) params.append('user_email', filterUserEmail);
      if (filterApiKeyId) params.append('api_key_id', filterApiKeyId);
      params.append('start_date', rangeValue.start_date);
      params.append('end_date', rangeValue.end_date);
      if (filterRouteGroup) params.append('route_group', filterRouteGroup);
      if (filterProtocol) params.append('protocol', filterProtocol);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`);
    },
    [
      page,
      queryReady,
      pageSize,
      filterStatus,
      filterModel,
      filterProviderId,
      filterUserEmail,
      filterApiKeyId,
      rangeValue.start_date,
      rangeValue.end_date,
      filterRouteGroup,
      filterProtocol,
    ]
  );

  const modelSelectOptions = useMemo(() => {
    const rows = [...(models.value ?? [])]
      .sort((a, b) =>
        (a.display_name?.trim() || a.id).localeCompare(b.display_name?.trim() || b.id, undefined, {
          sensitivity: 'base',
        })
      )
      .map((m) => ({
        id: m.id,
        label: m.display_name?.trim() || m.id,
      }));
    const ids = new Set(rows.map((r) => r.id));
    if (filterModel && !ids.has(filterModel)) {
      rows.unshift({ id: filterModel, label: t('feedback.unlisted', { id: filterModel }) });
    }
    return rows;
  }, [models.value, filterModel, t]);

  const providerSelectOptions = useMemo(() => {
    const rows = [...(providers.value ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((p) => ({ id: p.id, label: p.name }));
    const ids = new Set(rows.map((r) => r.id));
    if (filterProviderId && !ids.has(filterProviderId)) {
      rows.unshift({
        id: filterProviderId,
        label: t('feedback.unlisted', { id: filterProviderId }),
      });
    }
    return rows;
  }, [providers.value, filterProviderId, t]);

  /** option 的 value 与展示文案均为规范化后的 route_group（与目录一致） */
  const routeGroupSelectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of routes.value ?? []) {
      set.add(normalizeRouteGroup(r.route_group));
    }
    const sorted = [...set].sort(compareRouteGroupsForDisplay);
    const rows = sorted.map((g) => ({ value: g, label: g }));
    const fg = filterRouteGroup;
    if (fg && !set.has(fg) && !set.has(normalizeRouteGroup(fg))) {
      rows.unshift({ value: fg, label: t('feedback.unlisted', { id: fg }) });
    }
    return rows;
  }, [routes.value, filterRouteGroup, t]);

  const fetchLogs = useCallback(async () => {
    if (!queryReady) return;
    if (requestOwner.current) {
      clearTimeout(requestOwner.current.timer);
      requestOwner.current.controller.abort();
    }
    const controller = new AbortController();
    const operation = {
      controller,
      timer: setTimeout(() => controller.abort(new ShellRequestError('REQUEST_TIMEOUT')), 20_000),
    };
    requestOwner.current = operation;
    setIsLoading(true);
    setReadFailure(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (filterStatus) params.append('status', filterStatus);
      if (filterModel) params.append('model_id', filterModel);
      if (filterProviderId) params.append('provider_id', filterProviderId);
      if (filterUserEmail) params.append('user_email', filterUserEmail);
      if (filterApiKeyId) params.append('api_key_id', filterApiKeyId);
      params.append('start_date', rangeValue.start_date);
      params.append('end_date', rangeValue.end_date);
      if (filterRouteGroup) params.append('route_group', filterRouteGroup);
      if (filterProtocol) params.append('protocol', filterProtocol);

      const response = await fetch(`/api/admin/request-logs?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      let data;
      try { data = await readApiJson<GatewayRequestLog[]>(response); }
      catch { throw controller.signal.aborted ? controller.signal.reason : new ShellRequestError('INVALID_RESPONSE', response.status); }
      if (!response.ok) {
        const message = typeof data.message === 'string' ? data.message.slice(0, 300) : undefined;
        throw new ShellRequestError('HTTP_ERROR', response.status, undefined, message);
      }
      const result = parseLogs(data, page);
      if (requestOwner.current === operation) {
        setLogs(result.logs);
        setTotal(result.total);
      }
    } catch (error) {
      if (requestOwner.current === operation) {
        setReadFailure(shellFailure(controller.signal.aborted ? controller.signal.reason : error));
        setLogs([]);
        setTotal(0);
      }
    } finally {
      clearTimeout(operation.timer);
      if (requestOwner.current === operation) {
        requestOwner.current = null;
        setIsLoading(false);
      }
    }
  }, [
    page,
    queryReady,
    pageSize,
    filterStatus,
    filterModel,
    filterProviderId,
    filterUserEmail,
    filterApiKeyId,
    rangeValue.start_date,
    rangeValue.end_date,
    filterRouteGroup,
    filterProtocol,
  ]);

  useEffect(() => {
    fetchLogs();
    return () => {
      if (requestOwner.current) {
        clearTimeout(requestOwner.current.timer);
        requestOwner.current.controller.abort();
        requestOwner.current = null;
      }
    };
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => formatDateTime(dateStr);

  /** 毫秒数用千分位（如 23,332ms），便于扫读秒级量级 */
  const formatLatencyMs = (ms: number | null | undefined) => {
    if (ms == null) return '-';
    return `${Number(ms).toLocaleString('en-US')}ms`;
  };

  const timingDiagram = (log: GatewayRequestLog): string => {
    const gateway = formatLatencyMs(log.gateway_overhead_ms);
    const upstream = formatLatencyMs(log.upstream_response_ms);
    const headers = formatLatencyMs(log.final_upstream_headers_ms);
    const reasoningTtft = formatLatencyMs(log.first_reasoning_token_ms);
    const contentTtft = formatLatencyMs(log.first_token_ms);
    const stream = formatLatencyMs(log.stream_duration_ms);
    const reasoningPhaseMs =
      log.first_reasoning_token_ms != null &&
      log.first_token_ms != null &&
      log.first_token_ms >= log.first_reasoning_token_ms
        ? formatLatencyMs(log.first_token_ms - log.first_reasoning_token_ms)
        : null;
    const hasReasoning = log.first_reasoning_token_ms != null;
    const lines = [
      'Start',
      '  |',
      `  | Gateway ${gateway}`,
      '  |<-- preflight -->|',
      '                    |',
      `                    | Upstream ${upstream}`,
      '                    |<------ dispatch + provider headers ------>|',
      `                    | Headers(final attempt) ${headers}`,
      '                    |<---------- final fetch headers ---------->|',
    ];
    if (hasReasoning) {
      lines.push(
        '                                                                  |',
        `                                                                  | Reasoning ${reasoningPhaseMs ?? reasoningTtft}`,
        `                                                                  |<---- ${t('timing.reasoningPhase')} ---->|`,
      );
    } else {
      lines.push('                                                                  |');
    }
    lines.push(
      `                                                                  | Stream ${stream}`,
      `                                                                  |<------ ${t('timing.contentPhase')} ------>|`,
    );
    if (hasReasoning) {
      lines.push(`  |<-------- ${t('timing.ttftReasoningBracket')} ${reasoningTtft} -------->|`);
    }
    if (log.first_token_ms != null) {
      lines.push(`  |<--------------------- ${t('timing.ttftContent')} ${contentTtft} --------------------->|`);
    } else if (!hasReasoning) {
      lines.push(`  |<------------------------- TTFT ${contentTtft} ---------------------->|`);
    }
    lines.push('', `Attempts: ${log.upstream_attempt_count ?? '-'} / failover ${log.upstream_failover_count ?? '-'}`);
    return lines.join('\n');
  };

  const formatTtftListLine = (log: GatewayRequestLog): { text: string; title?: string } => {
    if (log.first_reasoning_token_ms != null) {
      const text = t('timing.listReasoning', { ms: formatLatencyMs(log.first_reasoning_token_ms) });
      const title =
        log.first_token_ms != null
          ? t('timing.listContentTtftTitle', { ms: formatLatencyMs(log.first_token_ms) })
          : undefined;
      return { text, title };
    }
    if (log.first_token_ms != null) {
      return { text: `TTFT ${formatLatencyMs(log.first_token_ms)}` };
    }
    if (log.upstream_response_ms != null) {
      return { text: `Up ${formatLatencyMs(log.upstream_response_ms)}` };
    }
    return { text: '\u00A0' };
  };

  const prettifyLogJson = (raw: string | null | undefined): { text: string; invalid: boolean } => {
    if (raw == null || raw === '') return { text: '', invalid: false };
    try {
      return { text: JSON.stringify(JSON.parse(raw), null, 2), invalid: false };
    } catch {
      // Retain the recorded bytes for inspection while exposing the parse failure.
      return { text: raw, invalid: true };
    }
  };

  const formatCostMultiplier = (cost: number, standardCost: number): string | null => {
    if (!Number.isFinite(cost) || !Number.isFinite(standardCost) || standardCost <= 0) {
      return null;
    }
    const ratio = cost / standardCost;
    if (!Number.isFinite(ratio) || ratio < 0) {
      return null;
    }
    return `×${ratio.toLocaleString('en-US', { maximumFractionDigits: 3 })}`;
  };

  /** Tokens：默认一行 input/output；存在 cache 时补充第二行；按张/按秒保持单行。 */
  const renderTokensCell = (log: GatewayRequestLog) => {
    if (log.billing_kind === 'image_per_image') {
      const inN = log.input_image_count ?? 0;
      const outN = log.output_image_count ?? 0;
      const line =
        inN > 0 && outN > 0
          ? `${inN}×${outN} img`
          : `${inN + outN} ${inN + outN === 1 ? 'image' : 'images'}`;
      return (
        <div className="leading-tight">
          <div className="text-gray-900 tabular-nums" title={t('titles.imagePerImageUsage')}>
            {line}
          </div>
        </div>
      );
    }
    if (log.billing_kind === 'audio_per_second') {
      const secs = log.audio_duration_seconds;
      const line =
        secs != null && Number.isFinite(secs)
          ? `${Number(secs).toLocaleString('en-US', { maximumFractionDigits: 3 })} s`
          : '—';
      return (
        <div className="leading-tight">
          <div className="text-gray-900 tabular-nums" title={t('titles.audioPerSecondUsage')}>
            {line}
          </div>
        </div>
      );
    }
    const hasCache = log.cache_read_tokens > 0 || log.cache_write_tokens > 0;
    return (
      <div className="leading-tight space-y-0.5">
        <div className="text-gray-900 tabular-nums" title={t('titles.inputOutputTokens')}>
          {log.input_tokens} / {log.output_tokens}
        </div>
        {hasCache ? (
          <div className="text-gray-400 tabular-nums" title={t('titles.cacheTokens')}>
            CR {log.cache_read_tokens} / CW {log.cache_write_tokens}
          </div>
        ) : null}
      </div>
    );
  };

  /** 列表只展示 Charged / Metered 两行；Standard 与倍率保留在悬停及展开审计中。 */
  const renderCostCell = (
    standardCost: number,
    chargedCost: number,
    meteredCost: number
  ) => {
    const chargedMultiplier = formatCostMultiplier(chargedCost, standardCost);
    const meteredMultiplier = formatCostMultiplier(meteredCost, standardCost);
    const costLine = (label: 'C' | 'M', amount: number, multiplier: string | null) => (
      <div className="inline-flex items-baseline gap-1 tabular-nums">
        <span className="w-3 text-[10px] font-semibold text-gray-400">{label}</span>
        <span>{billingCurrency ? formatGatewayMoneyCode(amount, billingCurrency, 6) : '—'}</span>
        {multiplier ? <span className="text-[10px] text-gray-400">{multiplier}</span> : null}
      </div>
    );
    return (
      <div
        className="leading-tight space-y-0.5"
        title={billingCurrency ? `${t('titles.standardCatalogPrice')}: ${formatGatewayMoneyCode(standardCost, billingCurrency, 6)}` : undefined}
      >
        <div className="text-gray-900" title={t('titles.chargedUserBudget')}>
          {costLine('C', chargedCost, chargedMultiplier)}
        </div>
        <div className="text-gray-700" title={t('titles.meteredSupplierCost')}>
          {costLine('M', meteredCost, meteredMultiplier)}
        </div>
      </div>
    );
  };

  const toggleDetail = (logId: string) => {
    setDetailLogId((prev) => (prev === logId ? null : logId));
    setTimingHelpLog(null);
  };

  /** 客户端接入的 Gateway API 协议；旧行缺省时用路由快照 upstream_protocol */
  const logProtocolKey = (log: GatewayRequestLog): string => {
    const r = log.request_protocol?.trim().toLowerCase() ?? '';
    const u = log.upstream_protocol?.trim().toLowerCase() ?? '';
    return r || u || '';
  };

  const protocolIconOrDash = (p: string) =>
    p ? (
      <UpstreamProtocolBrandIcon protocol={p} />
    ) : (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[10px] text-gray-400" title={t('titles.unknown')}>
        —
      </span>
    );

  /** Model 列压缩为两行：模型；协议 + route_group + operation。完整 ID 通过 title / 展开查看。 */
  const renderModelCell = (log: GatewayRequestLog) => {
    const protocol = logProtocolKey(log);
    const name = log.model_name?.trim();
    const id = log.model_id?.trim();
    const route = normalizeRouteGroup(log.route_group);
    return (
      <div className="min-w-0 leading-tight">
        <div
          className="truncate font-medium text-gray-900"
          title={[name, id ? `model_id: ${id}` : ''].filter(Boolean).join('\n') || undefined}
        >
          {name || id || <span className="font-normal text-gray-400">-</span>}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0" title={protocol ? `Protocol: ${protocol}` : 'Protocol unknown'}>
            {protocolIconOrDash(protocol)}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold leading-4 ${routeGroupBadgeClass(route)}`}
            title={`route_group: ${route}`}
          >
            @{route}
          </span>
          {log.request_operation ? (
            <span
              className="inline-flex min-w-0 items-center truncate rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200"
              title={`request_operation: ${log.request_operation}`}
            >
              {log.request_operation}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  /** Route 列压缩为两行：Provider；上游模型 + 上游协议。Target / Key 进入展开详情。 */
  const renderRouteCell = (log: GatewayRequestLog) => {
    const pname = log.provider_name?.trim();
    const pid = log.provider_id?.trim();
    const upstream = log.provider_model_name?.trim();
    const providerDisplay = pname || pid;
    const idOnly = !pname && Boolean(pid);
    const providerTitle =
      pname && pid && pname !== pid ? `Provider: ${pname} (id: ${pid})` : providerDisplay || undefined;
    /** Agent Tools：第二行是引擎 id（如 bocha），不是 LLM upstream model；协议徽章占位勿展示 */
    const isAgentTool = pid === 'octafuse-tools';
    const showUpstreamProtocol = !isAgentTool && Boolean(log.upstream_protocol || log.upstream_operation);
    const engineOrUpstreamTitle = isAgentTool
      ? upstream
        ? `Tool engine: ${upstream}`
        : undefined
      : upstream
        ? `Upstream model: ${upstream}`
        : undefined;

    return (
      <div className="min-w-0 leading-tight">
        <div
          className={`truncate ${idOnly ? 'font-mono text-gray-800' : 'text-gray-900'}`}
          title={providerTitle}
        >
          {providerDisplay || '-'}
        </div>
        {upstream || showUpstreamProtocol ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {upstream ? (
              <span
                className={`min-w-0 truncate font-mono ${isAgentTool ? 'text-indigo-700' : 'text-gray-600'}`}
                title={engineOrUpstreamTitle}
              >
                {upstream}
              </span>
            ) : null}
            {showUpstreamProtocol ? (
              <span
                className="shrink-0 truncate font-mono text-[10px] text-indigo-600"
                title={[log.upstream_protocol, log.upstream_operation].filter(Boolean).join(' · ')}
              >
                {[log.upstream_protocol, log.upstream_operation].filter(Boolean).join(' · ')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  /** 首列状态色块（实心）；悬停色块见完整 status 文案 */
  const statusSwatchClass = (status: string) => {
    if (status === 'success') return 'request-log-status-success';
    if (status === 'error') return 'request-log-status-error';
    if (status === 'incomplete') return 'request-log-status-incomplete';
    if (status === 'cancelled') return 'request-log-status-cancelled';
    return 'request-log-status-other';
  };

  return (
    <div className="request-logs-page p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Filters — time range first row */}
      <div className="mb-4 w-full min-w-0">
        <RequestLogRange
          value={rangeValue}
          onChange={(v) => {
            setRangeValue(v);
            setPage(1);
          }}
        />
      </div>

      <div className="request-logs-filters mb-4 flex gap-4 flex-wrap">
        <Field label={tCommon('status')}>{(props) => <Select {...props} value={filterStatus} onValueChange={(v) => { setFilterStatus(v ?? ''); setPage(1); }} options={[{ value: '', label: tCommon('all') }, ...(['success', 'error', 'incomplete', 'cancelled'] as const).map((value) => ({ value, label: tOptions(`requestStatus.${value}`) }))]} />}</Field>
        <Field label={tCommon('model')}>{(props) => <Select {...props} disabled={models.loading || !!models.failure} value={filterModel} onValueChange={(v) => { setFilterModel(v ?? ''); setPage(1); }} options={[{ value: '', label: tCommon('all') }, ...modelSelectOptions.map((o) => ({ value: o.id, label: o.label }))]} />}</Field>
        <Field label={tCommon('provider')}>{(props) => <Select {...props} disabled={providers.loading || !!providers.failure} value={filterProviderId} onValueChange={(v) => { setFilterProviderId(v ?? ''); setPage(1); }} options={[{ value: '', label: tCommon('all') }, ...providerSelectOptions.map((o) => ({ value: o.id, label: o.label }))]} />}</Field>
        <Field label={t('filters.protocol')}>{(props) => <Select {...props} value={filterProtocol} onValueChange={(v) => { setFilterProtocol(v ?? ''); setPage(1); }} options={[{ value: '', label: tCommon('all') }, ...UPSTREAM_PROTOCOLS.map((value) => ({ value, label: value }))]} />}</Field>
        <Field label={t('filters.routeGroup')}>{(props) => <Select {...props} disabled={routes.loading || !!routes.failure} value={filterRouteGroup} onValueChange={(v) => { setFilterRouteGroup(v ?? ''); setPage(1); }} options={[{ value: '', label: tCommon('all') }, ...routeGroupSelectOptions]} />}</Field>
        <Field label={t('filters.userEmail')}>{(props) => <Input {...props} value={filterUserEmail} placeholder={t('filters.emailPlaceholder')} onChange={(e) => { setFilterUserEmail(e.target.value); setPage(1); }} />}</Field>
        <Field label={t('filters.apiKeyId')}>{(props) => <Input {...props} value={filterApiKeyId} placeholder={t('filters.apiKeyPlaceholder')} onChange={(e) => { setFilterApiKeyId(e.target.value); setPage(1); }} />}</Field>
        <ControlButton variant="outline" onClick={() => { setFilterStatus(''); setFilterModel(''); setFilterProviderId(''); setFilterUserEmail(''); setFilterApiKeyId(''); setRangeValue({ preset: 'custom', start_date: '', end_date: '' }); setFilterRouteGroup(''); setFilterProtocol(''); setPage(1); }}>{tCommon('clearFilters')}</ControlButton>
      </div>

      {readFailure ? <ShellError title={t('feedback.readFailed')} failure={readFailure} action={<ControlButton variant="outline" onClick={() => void fetchLogs()}>{tShell('retry')}</ControlButton>} /> : null}

      {([{ resource: models, label: tCommon('model') }, { resource: providers, label: tCommon('provider') }, { resource: routes, label: t('filters.routeGroup') }, { resource: currency, label: t('feedback.currency') }]).map(({resource, label}) => resource.failure ? <ShellError key={label} title={t('feedback.resourceFailed', { resource: label })} failure={resource.failure} action={<ControlButton variant="outline" onClick={() => void resource.refresh()}>{tShell('retry')}</ControlButton>} /> : null)}

      {/* Stats + status swatch legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        {!isLoading && !readFailure ? <>
          <span className="text-sm">{t('totalRequests', { count: total })}</span>
          <span className="hidden sm:inline h-3 w-px bg-gray-200" aria-hidden />
        </> : null}
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm request-log-status-success shrink-0" aria-hidden />
            {tOptions('requestStatus.success')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm request-log-status-error shrink-0" aria-hidden />
            {tOptions('requestStatus.error')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm request-log-status-incomplete shrink-0" aria-hidden />
            {tOptions('requestStatus.incomplete')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm request-log-status-cancelled shrink-0" aria-hidden />
            {tOptions('requestStatus.cancelled')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm request-log-status-other shrink-0" aria-hidden />
            {t('statusOther')}
          </span>
        </span>
      </div>

      {/* Logs Table */}
      <div className="request-log-list">
        <div className="overflow-x-auto">
          <Table className="request-log-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('headers.statusTime')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{t('headers.userSystem')}</th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[9rem] max-w-xs"
                  title={t('titles.model')}
                >
                  {t('headers.model')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[10rem] max-w-xs"
                  title={t('titles.route')}
                >
                  {t('headers.route')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {t('headers.tokens')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap"
                  title={t('titles.cost')}
                >
                  {t('headers.cost', { currency: billingCurrencySym })}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap"
                  title={t('titles.profit')}
                >
                  {t('headers.profit', { currency: billingCurrencySym })}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(!isLoading && !readFailure ? logs : []).map((log) => {
                const standardCost = Number(log.standard_cost ?? 0);
                const chargedCost = Number(log.charged_cost ?? 0);
                const meteredCost = Number(log.metered_cost ?? 0);
                const profit = chargedCost - meteredCost;
                const profitToneClass =
                  profit > 0 ? 'request-log-profit-positive' : profit < 0 ? 'request-log-profit-negative' : 'request-log-profit-neutral';
                return (
                  <Fragment key={log.id}>
                  <tr
                    className={`align-middle cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 ${
                      detailLogId === log.id ? 'bg-slate-50' : ''
                    }`}
                    onClick={(event) => { detailReturnFocus.current = event.currentTarget; toggleDetail(log.id); }}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        detailReturnFocus.current = e.currentTarget;
                        toggleDetail(log.id);
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={detailLogId === log.id}
                    title={t('titles.rowDetail')}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 leading-tight">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${statusSwatchClass(log.status)}`}
                          title={log.status}
                          role="img"
                          aria-label={`Status: ${log.status}`}
                        />
                        <div className="min-w-0">
                          <div>{formatDate(log.created_at)}</div>
                          <div
                            className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400 tabular-nums"
                            title={formatTtftListLine(log).title ?? (log.first_token_ms != null ? `TTFT ${formatLatencyMs(log.first_token_ms)}` : undefined)}
                          >
                            <span>{formatLatencyMs(log.latency_ms)}</span>
                            <span aria-hidden>·</span>
                            <span>{formatTtftListLine(log).text}</span>
                          </div>
                        </div>
                        <ControlIconButton label={t('titles.rowDetail')} aria-expanded={detailLogId === log.id} onClick={(event) => { event.stopPropagation(); detailReturnFocus.current = event.currentTarget; toggleDetail(log.id); }}>
                        <ChevronRightIcon
                          className={`h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform ${
                            detailLogId === log.id ? 'rotate-90 text-blue-500' : ''
                          }`}
                          aria-hidden
                        />
                        </ControlIconButton>
                      </div>
                      {log.status === 'error' && log.error_message?.trim() ? (
                        <div
                          className="mt-1 max-w-[18rem] truncate text-[11px] leading-snug text-red-600"
                          title={log.error_message}
                        >
                          {log.error_message.trim()}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[14rem] min-w-0">
                      <div className="min-w-0 space-y-0.5 leading-snug">
                        <div className="truncate text-gray-900" title={log.user_email || undefined}>
                          {log.user_email || '-'}
                        </div>
                        <div
                          className="truncate font-mono text-[11px] text-gray-500"
                          title={log.external_system?.trim() || undefined}
                        >
                          {log.external_system?.trim() || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs">
                      {renderModelCell(log)}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs">
                      {renderRouteCell(log)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600 leading-tight">
                      {renderTokensCell(log)}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {renderCostCell(standardCost, chargedCost, meteredCost)}
                    </td>
                    <td
                      className={`px-3 py-2 text-xs whitespace-nowrap tabular-nums font-medium ${profitToneClass}`}
                      title={t('titles.profit')}
                    >
                      {billingCurrency ? formatGatewayMoneyCodeSigned(profit, billingCurrency, 6) : '—'}
                    </td>
                  </tr>
                  {detailLogId === log.id && (
                    <Drawer open onOpenChange={(open) => { if (!open) setDetailLogId(null); }} title={t('detail.requestId')} description={log.id} className="request-log-detail-drawer" finalFocus={() => detailReturnFocus.current}>
                        <div className="request-log-detail-content">
                          {(() => {
                            const auditLine = summarizePricingAuditJson(log.pricing_audit ?? null);
                            const auditRaw = log.pricing_audit?.trim();
                            const auditJson = prettifyLogJson(auditRaw);
                            const auditDisplay = auditJson.text;
                            const auditEmpty = !auditDisplay;
                            const timingJson = prettifyLogJson(log.timing_metadata ?? null);
                            const timingDisplay = timingJson.text;
                            const timingRows = [
                              ['Gateway', log.gateway_overhead_ms],
                              ['Upstream', log.upstream_response_ms],
                              ['Headers', log.final_upstream_headers_ms],
                              [t('timing.reasoning'), log.first_reasoning_token_ms],
                              [t('timing.ttftContent'), log.first_token_ms],
                              ['Stream', log.stream_duration_ms],
                            ] as const;
                            const upstreamRequestId = log.upstream_request_id?.trim() ?? '';
                            const upstreamMessageId = log.upstream_message_id?.trim() ?? '';
                            const providerKey = [
                              log.provider_key_label?.trim(),
                              log.provider_key_fingerprint?.trim(),
                              log.provider_key_id?.trim(),
                            ].filter(Boolean).join(' · ');
                            const protocolMapping = [
                              [log.request_protocol, log.request_operation].filter(Boolean).join('.'),
                              [log.upstream_protocol, log.upstream_operation].filter(Boolean).join('.'),
                            ].filter(Boolean).join(' → ');
                            const routeTarget = [
                              log.model_surface_id ? `surface ${log.model_surface_id}` : '',
                              log.route_pool_id ? `pool ${log.route_pool_id}` : '',
                              log.route_target_id ? `target ${log.route_target_id}` : '',
                            ].filter(Boolean).join(' · ');
                            const summaryFields = [
                              { label: t('detail.requestId'), value: log.id },
                              {
                                label: t('detail.identity'),
                                value: [log.user_email, log.api_key_id].filter(Boolean).join(' · '),
                              },
                              { label: t('detail.modelId'), value: log.model_id ?? '' },
                              {
                                label: t('detail.routeGroup'),
                                value: normalizeRouteGroup(log.route_group),
                              },
                              {
                                label: t('detail.providerRoute'),
                                value: [log.provider_name || log.provider_id, log.provider_model_name]
                                  .filter(Boolean)
                                  .join(' · '),
                              },
                              { label: t('detail.protocolMapping'), value: protocolMapping },
                              { label: t('detail.providerKey'), value: providerKey },
                              { label: t('detail.routeTarget'), value: routeTarget },
                            ];
                            return (
                              <div className="request-logs-page request-log-detail">
                                <div className="border-b border-gray-200 bg-slate-50/70 p-3">
                                  <div className="request-log-summary">
                                    {summaryFields.map(({ label, value }) => (
                                      <div key={label} className="min-w-0">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                          {label}
                                        </div>
                                        <div
                                          className="mt-0.5 truncate font-mono text-[11px] text-slate-700"
                                          title={value || undefined}
                                        >
                                          {value || '-'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {log.error_message?.trim() ? (
                                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                                        {t('detail.error')}
                                      </div>
                                      <div className="mt-0.5 whitespace-pre-wrap break-words text-xs text-red-800">
                                        {log.error_message.trim()}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                {upstreamMessageId || upstreamRequestId ? (
                                  <div className="request-log-identifiers grid grid-cols-2 gap-3 border-b border-gray-200 bg-gray-50/70 p-3">
                                    {[
                                      {
                                        id: 'upstream_message_id' as const,
                                        label: t('detail.upstreamMessageId'),
                                        value: upstreamMessageId,
                                      },
                                      {
                                        id: 'upstream_request_id' as const,
                                        label: t('detail.upstreamRequestId'),
                                        value: upstreamRequestId,
                                      },
                                    ].map(({ id, label, value }) => (
                                      <div
                                        key={id}
                                        className="request-log-identifier min-w-0 rounded border px-3 py-2"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-[11px] font-medium">{label}</div>
                                            <div
                                              className="mt-0.5 truncate font-mono text-xs"
                                              title={value || undefined}
                                            >
                                              {value || '-'}
                                            </div>
                                          </div>
                                          {value ? <CopyControl value={value} label={`${tCommon('copy')} · ${label}`} /> : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              <div className="request-log-payloads">
                                <div className="min-w-0 flex h-full min-h-[22rem] flex-col border border-sky-200 rounded-md overflow-hidden bg-sky-50/50">
                                  <div className="px-2 py-1.5 border-b border-sky-200 bg-sky-100/50 flex items-center justify-between gap-2 shrink-0">
                                    <span className="text-xs font-medium text-sky-950">{t('detail.timing')}</span>
                                    <div className="flex items-center gap-1.5">
                                      <ControlIconButton label={t('timing.explain')} onClick={(event) => { timingReturnFocus.current = event.currentTarget; setTimingHelpLog(log); }}>
                                        <QuestionMarkCircleIcon className="h-4 w-4" aria-hidden />
                                      </ControlIconButton>
                                      {timingDisplay ? <CopyControl value={timingDisplay} label={`${tCommon('copy')} · ${t('detail.timing')}`} /> : null}
                                    </div>
                                  </div>
                                  <div className="p-2 text-[11px] text-sky-950 space-y-1 shrink-0">
                                    {timingRows.map(([label, value]) => (
                                      <div key={label} className="flex items-center justify-between gap-3">
                                        <span>{label}</span>
                                        <span className="font-mono tabular-nums">{formatLatencyMs(value)}</span>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-3 border-t border-sky-100 pt-1">
                                      <span>{t('timing.attempts')}</span>
                                      <span className="font-mono tabular-nums">
                                        {log.upstream_attempt_count ?? '-'} / failover {log.upstream_failover_count ?? '-'}
                                      </span>
                                    </div>
                                  </div>
                                  {timingJson.invalid ? <p role="alert" className="request-log-json-error">{t('feedback.invalidJson')}</p> : null}
                                  <pre className="mx-2 mb-2 flex-1 min-h-0 overflow-auto rounded border border-sky-100 bg-white/90 p-2 font-mono text-[11px] leading-snug text-gray-800 whitespace-pre-wrap break-words">
                                    {timingDisplay || tCommon('noDataFound')}
                                  </pre>
                                </div>
                                <div className="min-w-0 flex h-full min-h-[22rem] flex-col border border-violet-200 rounded-md overflow-hidden bg-violet-50/50">
                                  <div className="px-2 py-1.5 border-b border-violet-200 bg-violet-100/40 flex items-center justify-between gap-2 shrink-0">
                                    <span className="text-xs font-medium text-violet-950">{t('detail.pricingAudit')}</span>
                                    {!auditEmpty ? <CopyControl value={auditDisplay} label={`${tCommon('copy')} · ${t('detail.pricingAudit')}`} /> : null}
                                  </div>
                                  <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">
                                    {auditJson.invalid ? <p role="alert" className="request-log-json-error">{t('feedback.invalidJson')}</p> : null}
                                    {auditLine ? (
                                      <div className="text-[11px] text-violet-950/95 shrink-0">{auditLine}</div>
                                    ) : null}
                                    <pre className="flex-1 min-h-0 overflow-auto rounded border border-violet-100 bg-white/90 p-2 font-mono text-[11px] leading-snug text-gray-800 whitespace-pre-wrap break-words">
                                      {auditEmpty ? tCommon('noDataFound') : auditDisplay}
                                    </pre>
                                  </div>
                                </div>
                                {(
                                  [
                                    {
                                      col: 'entry' as const,
                                      title: t('detail.entryRequestBody'),
                                      raw: log.request_body,
                                    },
                                    {
                                      col: 'upstream' as const,
                                      title: t('detail.upstreamRequestBody'),
                                      raw: log.upstream_request_body,
                                    },
                                    {
                                      col: 'usage' as const,
                                      title: t('detail.upstreamUsageRaw'),
                                      raw: log.raw_usage,
                                    },
                                  ] as const
                                ).map(({ col, title, raw }) => {
                                  const parsed = prettifyLogJson(raw);
                                  const display = parsed.text;
                                  const empty = !display;
                                  return (
                                    <div
                                      key={col}
                                      className="min-w-0 flex h-full min-h-[22rem] flex-col border border-gray-200 rounded-md overflow-hidden"
                                    >
                                      <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
                                        <span className="text-xs font-medium text-gray-700">{title}</span>
                                        {!empty ? <CopyControl value={display} label={`${tCommon('copy')} · ${title}`} /> : null}
                                      </div>
                                      {parsed.invalid ? <p role="alert" className="request-log-json-error">{t('feedback.invalidJson')}</p> : null}
                                      <pre className="p-2 text-xs text-gray-800 whitespace-pre-wrap break-words min-h-0 overflow-auto font-mono flex-1">
                                        {empty ? tCommon('noDataFound') : display}
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                              </div>
                            );
                          })()}
                        </div>
      <Dialog open={timingHelpLog !== null} onOpenChange={(open) => { if (!open) setTimingHelpLog(null); }} title={t('timing.helpTitle')} className="request-log-timing-dialog" finalFocus={() => timingReturnFocus.current}>
        {timingHelpLog ? <div className="request-log-timing-help">
              <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                <div><span className="font-medium text-gray-950">{t('timing.gateway')}</span>: {t('timing.gatewayDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.upstream')}</span>: {t('timing.upstreamDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.headers')}</span>: {t('timing.headersDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.reasoning')}</span>: {t('timing.reasoningDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.ttftContent')}</span>: {t('timing.ttftContentDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.stream')}</span>: {t('timing.streamDesc')}</div>
                <div><span className="font-medium text-gray-950">{t('timing.attempts')}</span>: {t('timing.attemptsDesc')}</div>
              </div>
              <pre className="mt-4 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-sky-50 whitespace-pre">
                {timingDiagram(timingHelpLog)}
              </pre>
        </div> : null}
      </Dialog>

                    </Drawer>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>

        {logs.length === 0 && !isLoading && !readFailure && (
          <EmptyState title={tCommon('noLogsFound')} />
        )}

        {isLoading && (
          <Spinner label={tCommon('loading')} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !isLoading && !readFailure && (
        <div className="mt-4 flex justify-center gap-2">
          <ControlButton variant="outline"
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

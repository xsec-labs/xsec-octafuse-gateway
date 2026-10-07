'use client';

/**
 * Playground：选定单条 model_route，编辑 JSON 请求体，直连上游验证连通性（不计费、不入库）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { flushSync } from 'react-dom';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { ImageGenerationsPreview } from '@/components/image-generations-preview';
import { RequestTargetUrl } from '@/components/request-target-url';
import { ControlButton, Field, Input, PageHeader, Spinner } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { usePlaygroundCatalog } from './use-playground-catalog';
import { PlaygroundCatalog, type CatalogFilters } from './playground-catalog';
import type { PlaygroundCatalog as PlaygroundCatalogData } from './catalog-api';
import type { RouteListRow } from '../routes/catalog';
import './catalog.css';
import { PlaygroundToolsPanel } from './playground-tools-panel';
import {
	AUDIO_TRANSCRIPTIONS_BODY_TEMPLATE,
	isAudioRouteModel,
	validateAudioTranscriptionFile,
} from '@/lib/audio-transcriptions';
import {
	IMAGE_EDITS_BODY_TEMPLATE,
	IMAGE_GENERATIONS_BODY_TEMPLATE,
	IMAGE_MAX_REFERENCE_COUNT,
	imageRequestMetaFromBody,
	isImageRouteModel,
	parseImagesGenerationsResponse,
	readFileAsDataUrl,
	validateEditImageFiles,
	type ImageOperation,
	type ImagePreviewItem,
} from '@/lib/image-generations';
import {
	inferPlaygroundParseMode,
	mergeAssistantTextParts,
	type PlaygroundProtocol,
} from '@/lib/playground/merge-assistant-text';
import { previewPlaygroundUpstreamUrl } from '@/lib/playground/preview-upstream-url';
import {
	normalizeProtocol,
	parseLastStreamUsage,
	tryParseUsageSummary,
} from '@/lib/playground/usage-parsing';
import { ShellRequestError } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { isRecord } from '@/lib/shell-request';
import {
	DEFAULT_KIND_FILTER,
	type ModelKindFilter,
} from '../models/types';

const inputClass =
	'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1';

function resolveRouteModelKind(
	m: Parameters<typeof isAudioRouteModel>[0] | undefined
): ModelKindFilter {
	if (!m) throw new ShellRequestError('INVALID_RESPONSE');
	if (isAudioRouteModel(m)) return 'audio';
	if (isImageRouteModel(m)) return 'image';
	return 'llm';
}

const BODY_TEMPLATES: Record<string, string> = {
	openai: `{
  "messages": [{ "role": "user", "content": "Hello" }],
  "max_tokens": 256,
  "stream": true,
  "stream_options": { "include_usage": true }
}`,
	anthropic: `{
  "messages": [{ "role": "user", "content": "Hello" }],
  "max_tokens": 256,
  "stream": true
}`,
	gemini: `{
  "contents": [{ "role": "user", "parts": [{ "text": "Hello" }] }]
}`,
};

const codeBlockClass =
	'p-3 text-xs overflow-x-auto whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-md font-mono text-gray-900';

function decodeWireRequestBodyHeader(res: Response): string | null {
	const raw = res.headers.get('x-playground-request-body');
	if (raw == null || raw === '') return null;
	try {
		const decoded = decodeURIComponent(raw);
		try {
			return JSON.stringify(JSON.parse(decoded), null, 2);
		} catch {
			return decoded;
		}
	} catch {
		return '（无法解码 x-playground-request-body）';
	}
}

const EMPTY_CATALOG: PlaygroundCatalogData = { routes: [], models: [], providers: [] };

function PlaygroundPageInner() {
	const t = useTranslations('playground');
	const tBrand = useTranslations('brand');
	const tCommon = useTranslations('common');
	const searchParams = useSearchParams();
	const initialMode =
		searchParams.get('mode') === 'tools' || searchParams.get('tool')
			? 'tools'
			: 'routes';
	const [playgroundMode, setPlaygroundMode] = useState<'routes' | 'tools'>(initialMode);
	const initialToolId = searchParams.get('tool');
	const initialProvider = searchParams.get('provider');

	const { read, refresh } = usePlaygroundCatalog();
	const catalog = read.status === 'ready' ? read.data : EMPTY_CATALOG;
	const routes = catalog.routes;
	const modelsById = useMemo(() => new Map(catalog.models.map(model => [model.id, model])), [catalog]);
	const providersById = useMemo(() => new Map(catalog.providers.map(provider => [provider.id, provider])), [catalog]);
	const [filters, setFilters] = useState<CatalogFilters>({ kind: DEFAULT_KIND_FILTER, model: '', provider: '', protocol: '', group: '' });
	const { kind: filterKind, model: filterModel, provider: filterProvider, protocol: filterProtocol, group: filterGroup } = filters;

	const [selectedId, setSelectedId] = useState('');
	const [bodyText, setBodyText] = useState(BODY_TEMPLATES.openai);
	const [bodyError, setBodyError] = useState<string | null>(null);
	const [geminiAction, setGeminiAction] = useState<'generateContent' | 'streamGenerateContent'>('streamGenerateContent');
	const [imageOperation, setImageOperation] = useState<ImageOperation>('generations');
	const [editFiles, setEditFiles] = useState<File[]>([]);
	const [audioFile, setAudioFile] = useState<File | null>(null);

	const [sending, setSending] = useState(false);
	const [sendTimeoutSeconds, setSendTimeoutSeconds] = useState('300');
	const [sendNotice, setSendNotice] = useState<string | null>(null);
	const activeSend = useRef<AbortController | null>(null);
	useEffect(() => () => { const active = activeSend.current; activeSend.current = null; active?.abort(); }, []);
	const cancelSend = () => {
		const active = activeSend.current;
		if (!active) return;
		activeSend.current = null;
		active.abort();
		setSending(false);
		setSendNotice(t('sendState.cancelled'));
	};
	const [responseMeta, setResponseMeta] = useState<{
		status: number;
		latencyMs: string | null;
		upstreamUrl: string | null;
		contentType: string | null;
	} | null>(null);
	const [responseText, setResponseText] = useState('');
	/** 与最后一次 Send 时的路由协议一致，避免切换下拉后拼接错乱 */
	const [responseProtocol, setResponseProtocol] = useState<PlaygroundProtocol>('openai');
	const [usageHint, setUsageHint] = useState<string | null>(null);
	const [imagePreviews, setImagePreviews] = useState<ImagePreviewItem[]>([]);
	/** Send 成功后由响应头 `x-playground-request-body` 解析（服务端合并后的实际上游 JSON）。 */
	const [lastSentWireBody, setLastSentWireBody] = useState<string | null>(null);
	const streamEndRef = useRef<HTMLSpanElement>(null);
	const mergedStreamEndRef = useRef<HTMLSpanElement>(null);

	const selected = useMemo(
		() => routes.find((r) => r.id === selectedId) ?? null,
		[routes, selectedId]
	);

	const selectedIsImage = useMemo(() => {
		if (!selected) return false;
		const m = modelsById.get(selected.model_id);
		return m ? isImageRouteModel(m) : false;
	}, [selected, modelsById]);

	const selectedIsAudio = useMemo(() => {
		if (!selected) return false;
		const m = modelsById.get(selected.model_id);
		return m ? isAudioRouteModel(m) : false;
	}, [selected, modelsById]);

	const imageSendBlocked =
		selectedIsImage && normalizeProtocol(selected?.upstream_protocol ?? 'openai') !== 'openai';
	const audioSendBlocked =
		selectedIsAudio && normalizeProtocol(selected?.upstream_protocol ?? 'openai') !== 'openai';

	const previewUpstreamUrl = useMemo(() => {
		if (!selected) return null;
		return previewPlaygroundUpstreamUrl({
			provider: providersById.get(selected.provider_id),
			upstreamProtocol: selected.upstream_protocol,
			providerModelName: selected.provider_model_name,
			isImageModel: selectedIsImage && !selectedIsAudio,
			imageOperation: selectedIsImage && !selectedIsAudio ? imageOperation : undefined,
			isAudioModel: selectedIsAudio,
			geminiAction,
		});
	}, [selected, providersById, selectedIsImage, selectedIsAudio, imageOperation, geminiAction]);

	/** 发送后以上游实际 URL 为准；否则展示与 Send 同规则的预览。 */
	const requestTargetUrl = responseMeta?.upstreamUrl ?? previewUpstreamUrl;

	const mergedAssistantParts = useMemo(() => {
		const mode = inferPlaygroundParseMode(responseMeta?.contentType ?? null);
		if (!responseText.trim() || !mode) {
			return { reasoning: '', body: '' };
		}
		return mergeAssistantTextParts(responseText, responseProtocol, mode);
	}, [responseText, responseProtocol, responseMeta?.contentType]);

	const { mergedReasoningDisplay, mergedBodyDisplay } = useMemo(() => {
		const hasRaw = responseText.trim().length > 0;
		const p = mergedAssistantParts;
		const reasoningDisplay =
			p.reasoning ||
			(sending && hasRaw ? '（接收中…）' : '') ||
			(!sending && hasRaw && !p.reasoning ? '—' : '');
		const bodyDisplay =
			p.body ||
			(sending && hasRaw ? '（接收中…）' : '') ||
			(!sending && hasRaw && !p.body ? (!p.reasoning ? '（无法从报文提取正文）' : '—') : '');
		return { mergedReasoningDisplay: reasoningDisplay, mergedBodyDisplay: bodyDisplay };
	}, [mergedAssistantParts, responseText, sending]);

	const matchesFilters = useCallback(
		(
			r: RouteListRow,
			omit: 'model' | 'provider' | 'protocol' | 'group' | null = null
		) => {
			if (resolveRouteModelKind(modelsById.get(r.model_id)) !== filterKind) return false;
			if (omit !== 'model' && filterModel && r.model_id !== filterModel) return false;
			if (omit !== 'provider' && filterProvider && r.provider_id !== filterProvider) return false;
			if (omit !== 'protocol' && filterProtocol && r.upstream_protocol !== filterProtocol) return false;
			if (omit !== 'group' && filterGroup && r.route_group !== filterGroup) return false;
			return true;
		},
		[modelsById, filterKind, filterModel, filterProvider, filterProtocol, filterGroup]
	);

	const kindCounts = useMemo(() => {
		const counts = { llm: 0, image: 0, audio: 0 };
		const seen = new Set<string>();
		for (const r of routes) {
			if (seen.has(r.model_id)) continue;
			seen.add(r.model_id);
			counts[resolveRouteModelKind(modelsById.get(r.model_id))] += 1;
		}
		return counts;
	}, [routes, modelsById]);

	const routesInKind = useMemo(
		() =>
			routes.filter(
				(r) => resolveRouteModelKind(modelsById.get(r.model_id)) === filterKind
			),
		[routes, modelsById, filterKind]
	);

	const filteredRoutes = useMemo(
		() => routes.filter((r) => matchesFilters(r)),
		[routes, matchesFilters]
	);

	/** Model 下拉：按当前其它筛选项联动（不含 model 自身）。 */
	const modelOptions = useMemo(() => {
		const pool = routes.filter((r) => matchesFilters(r, 'model'));
		const byId = new Map<string, { value: string; label: string }>();
		for (const r of pool) {
			if (byId.has(r.model_id)) continue;
			const name = (r.model_name ?? '').trim();
			byId.set(r.model_id, {
				value: r.model_id,
				label: name && name !== r.model_id ? `${name} (${r.model_id})` : r.model_id,
			});
		}
		return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
	}, [routes, matchesFilters]);

	/** Provider 下拉：按当前其它筛选项联动（不含 provider 自身）。 */
	const providerOptions = useMemo(() => {
		const pool = routes.filter((r) => matchesFilters(r, 'provider'));
		const byId = new Map<string, { value: string; label: string }>();
		for (const r of pool) {
			if (byId.has(r.provider_id)) continue;
			const name = (r.provider_name ?? '').trim();
			byId.set(r.provider_id, {
				value: r.provider_id,
				label: name && name !== r.provider_id ? `${name} (${r.provider_id})` : r.provider_id,
			});
		}
		return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
	}, [routes, matchesFilters]);

	const protocolOptions = useMemo(() => {
		const set = new Set<string>();
		for (const r of routes) {
			if (!matchesFilters(r, 'protocol')) continue;
			if (r.upstream_protocol) set.add(r.upstream_protocol);
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [routes, matchesFilters]);

	const groupOptions = useMemo(() => {
		const set = new Set<string>();
		for (const r of routes) {
			if (!matchesFilters(r, 'group')) continue;
			if (r.route_group) set.add(r.route_group);
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [routes, matchesFilters]);

	const onSelectRoute = useCallback((id: string) => {
		setSelectedId(id);
		setBodyError(null);
		setSendNotice(null);
		setImageOperation('generations');
		setEditFiles([]);
		setAudioFile(null);
		setImagePreviews([]);
		setResponseMeta(null);
		setLastSentWireBody(null);
		setResponseText('');
		setUsageHint(null);
		const route = routes.find(row => row.id === id);
		if (!route) return;
		const proto = normalizeProtocol(route.upstream_protocol), model = modelsById.get(route.model_id);
		if (!model) throw new ShellRequestError('INVALID_RESPONSE');
		setBodyText(isAudioRouteModel(model) && proto === 'openai'
			? AUDIO_TRANSCRIPTIONS_BODY_TEMPLATE
			: isImageRouteModel(model) && proto === 'openai'
				? IMAGE_GENERATIONS_BODY_TEMPLATE : BODY_TEMPLATES[proto]);
	}, [routes, modelsById]);

	const onFilter = useCallback(<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => {
		const next: CatalogFilters = { kind: filterKind, model: '', provider: '', protocol: '', group: '' };
		next[key] = value;
		const match = (route: RouteListRow) =>
			resolveRouteModelKind(modelsById.get(route.model_id)) === next.kind &&
			(!next.model || route.model_id === next.model) &&
			(!next.provider || route.provider_id === next.provider) &&
			(!next.protocol || route.upstream_protocol === next.protocol) &&
			(!next.group || route.route_group === next.group);
		for (const name of ['model','provider','protocol','group'] as const) {
			if (name === key || (key === 'kind' && name === 'model')) continue;
			next[name] = filters[name];
			if (next[name] && !routes.some(match)) next[name] = '';
		}
		setFilters(next);
		if (key === 'kind' || (selectedId && !routes.some(route => route.id === selectedId && match(route)))) onSelectRoute('');
	}, [filters, filterKind, modelsById, onSelectRoute, routes, selectedId]);
	const clearFilters = useCallback(() => {
		setFilters({ kind: filterKind, model: '', provider: '', protocol: '', group: '' });
	}, [filterKind]);

	const onImageOperationChange = (next: ImageOperation) => {
		setImageOperation(next);
		if (selectedIsImage && normalizeProtocol(selected?.upstream_protocol ?? 'openai') === 'openai') {
			setBodyText(next === 'edits' ? IMAGE_EDITS_BODY_TEMPLATE : IMAGE_GENERATIONS_BODY_TEMPLATE);
			setBodyError(null);
		}
		if (next === 'generations') {
			setEditFiles([]);
		}
	};

	const scrollStreamToBottom = useCallback(() => {
		streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
		mergedStreamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	const send = async () => {
		if (activeSend.current) return;
		const timeoutSeconds = Number(sendTimeoutSeconds);
		if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) {
			setBodyError(t('sendState.invalidTimeout'));
			return;
		}
		if (!selected) {
			setBodyError(tCommon('selectRouteFirst'));
			return;
		}
		if (imageSendBlocked) {
			setBodyError(t('imageOpenaiOnly'));
			return;
		}
		if (audioSendBlocked) {
			setBodyError(t('audioOpenaiOnly'));
			return;
		}
		let bodyObj: Record<string, unknown>;
		try {
			bodyObj = JSON.parse(bodyText) as Record<string, unknown>;
			if (bodyObj === null || typeof bodyObj !== 'object' || Array.isArray(bodyObj)) {
				setBodyError(tCommon('bodyMustBeJsonObject'));
				return;
			}
		} catch {
			setBodyError(tCommon('invalidJson'));
			return;
		}

		const proto = normalizeProtocol(selected.upstream_protocol);
		const useAudio = selectedIsAudio && proto === 'openai';
		const useImages = selectedIsImage && !selectedIsAudio && proto === 'openai';
		const effectiveImageOp: ImageOperation | undefined = useImages ? imageOperation : undefined;

		const controller = new AbortController();
		activeSend.current = controller;
		const timer = setTimeout(() => controller.abort(new Error(t('sendState.timeout'))), timeoutSeconds * 1000);
		setSendNotice(null);
		setBodyError(null);
		setSending(true);
		setResponseText('');
		setUsageHint(null);
		setImagePreviews([]);
		setResponseMeta(null);
		setLastSentWireBody(null);

		setResponseProtocol(proto);
		const payload: {
			routeId: string;
			body: Record<string, unknown>;
			geminiAction?: 'generateContent' | 'streamGenerateContent';
			imageOperation?: ImageOperation;
		} = { routeId: selected.id, body: bodyObj };
		if (proto === 'gemini') {
			payload.geminiAction = geminiAction;
		}
		if (effectiveImageOp) {
			payload.imageOperation = effectiveImageOp;
		}

		try {
			if (useAudio) {
				const validated = validateAudioTranscriptionFile(audioFile);
				if (!validated.ok) {
					setBodyError(validated.error);
					return;
				}
				const dataUrl = await readFileAsDataUrl(audioFile!, controller.signal);
				controller.signal.throwIfAborted();
				// file_name：供服务端拼 multipart 文件名（勿丢扩展名；中文名服务端会规范为 audio.<ext>）
				bodyObj = { ...bodyObj, file: dataUrl, file_name: audioFile!.name };
			}

			if (effectiveImageOp === 'edits') {
				const validated = validateEditImageFiles(editFiles);
				if (!validated.ok) {
					setBodyError(validated.error);
					return;
				}
				const dataUrls = await Promise.all(editFiles.map((f) => readFileAsDataUrl(f, controller.signal)));
				controller.signal.throwIfAborted();
				bodyObj = {
					...bodyObj,
					image: dataUrls.length === 1 ? dataUrls[0] : dataUrls,
				};
			}
			payload.body = bodyObj;
			const res = await fetch('/api/admin/playground', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: controller.signal,
			});
			controller.signal.throwIfAborted();
			if (res.status === 401) { notifyAdminSessionExpired(); controller.abort(); return; }

			const latencyMs = res.headers.get('x-playground-latency-ms');
			const upstreamUrl = res.headers.get('x-playground-upstream-url');
			const ct = res.headers.get('Content-Type') ?? '';

			setLastSentWireBody(decodeWireRequestBodyHeader(res));

			setResponseMeta({
				status: res.status,
				latencyMs,
				upstreamUrl,
				contentType: ct,
			});

			const jsonErr = ct.includes('application/json') && !ct.includes('text/event-stream');
			if (jsonErr) {
				const j: unknown = await res.json();
				controller.signal.throwIfAborted();
				setResponseText(JSON.stringify(j, null, 2));
				if (!res.ok) {
					setUsageHint(null);
					const errObj = isRecord(j) ? j.error : undefined;
					const nested =
						errObj && typeof errObj === 'object' && 'message' in errObj
							? String((errObj as { message?: unknown }).message ?? '')
							: '';
					let msg = isRecord(j) && typeof j.message === 'string' ? j.message.trim() : '';
					if (!msg && typeof errObj === 'string') msg = errObj;
					if (!msg) msg = nested.trim();
					if (!msg) msg = tCommon('requestFailed');
					setBodyError(msg);
				} else if (useImages) {
					const parsedImg = parseImagesGenerationsResponse(
						JSON.stringify(j),
						imageRequestMetaFromBody(bodyObj)
					);
					setImagePreviews(parsedImg.images);
					setUsageHint(parsedImg.usageHint);
				} else {
					const summary = tryParseUsageSummary(JSON.stringify(j), proto);
					setUsageHint(summary);
				}
				return;
			}

			if (ct.includes('text/event-stream') && res.body) {
				const reader = res.body.getReader();
				try {
					const dec = new TextDecoder();
					let acc = '';
					while (true) {
						const { done, value } = await reader.read();
						controller.signal.throwIfAborted();
						if (done) break;
						acc += dec.decode(value, { stream: true });
						// 避免 React 18 批处理把多次更新合成一次渲染，导致「拼接内容」只在流结束后才出现
						flushSync(() => {
							setResponseText(acc);
						});
						scrollStreamToBottom();
					}
					acc += dec.decode();
					flushSync(() => {
						setResponseText(acc);
					});
					setUsageHint(parseLastStreamUsage(acc, proto));
					return;
				} finally { reader.releaseLock(); }
			}

			const text = await res.text();
			controller.signal.throwIfAborted();
			setResponseText(text);
			if (!res.ok) { setBodyError(tCommon('requestFailed') + ' (HTTP ' + res.status + ')'); setUsageHint(null); return; }
			if (useImages) {
				const parsedImg = parseImagesGenerationsResponse(text, imageRequestMetaFromBody(bodyObj));
				setImagePreviews(parsedImg.images);
				setUsageHint(parsedImg.usageHint);
			} else {
				setUsageHint(tryParseUsageSummary(text, proto));
			}
		} catch (e) {
			if (activeSend.current === controller) {
				const failure = controller.signal.aborted ? controller.signal.reason : e;
				controller.abort();
				setBodyError(failure instanceof Error ? failure.message : tCommon('requestFailed'));
			}
		} finally {
			clearTimeout(timer);
			if (activeSend.current === controller) { activeSend.current = null; setSending(false); }
		}
	};

	return (
		<div className="playground-page p-8">
			<div className="mb-6">
				<PageHeader title={t('title')} description={<>
					{playgroundMode === 'tools' ? t('toolsSubtitle', { product: tBrand('product') }) : t('subtitle', { product: tBrand('product') })}
					<span> · </span>{t('usageNote')}
				</>} />
				<div
					className="mt-4 inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5"
					role="group"
					aria-label={t('mode')}
				>
					{(
						[
							{ id: 'routes' as const, label: t('modeRoutes') },
							{ id: 'tools' as const, label: t('modeTools') },
						] as const
					).map((opt) => {
						const active = playgroundMode === opt.id;
						return (
							<button
								key={opt.id}
								type="button"
								onClick={() => { if (opt.id !== playgroundMode) cancelSend(); setPlaygroundMode(opt.id); }}
								className={
									active
										? 'rounded px-3 py-1.5 text-sm font-medium bg-white text-gray-900 shadow-sm'
										: 'rounded px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900'
								}
							>
								{opt.label}
							</button>
						);
					})}
				</div>
			</div>

			{playgroundMode === 'tools' ? (
				<div className="max-w-3xl">
					<PlaygroundToolsPanel
						initialToolId={initialToolId}
						initialProvider={initialProvider}
					/>
				</div>
			) : read.status === 'loading' ? <Spinner label={tCommon('loading')} /> : read.status === 'failed' ? (
				<ShellError title={t('catalog.readFailed')} failure={read.failure} action={<ControlButton variant="outline" onClick={() => { onSelectRoute(''); refresh(); }}>{tCommon('reload')}</ControlButton>} />
			) : (
				<div className="flex flex-col gap-6">
					<PlaygroundCatalog filters={filters} modelOptions={modelOptions}
						providerOptions={providerOptions} protocolOptions={protocolOptions} groupOptions={groupOptions}
						kindCounts={kindCounts} routes={filteredRoutes} total={routesInKind.length} selected={selected} disabled={sending}
						onFilter={onFilter} onSelect={onSelectRoute} onClear={clearFilters} />

					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<div className="min-w-0">
						<div className="bg-white rounded-lg shadow-md p-6 space-y-4">
							<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-gray-100 pb-3">
								<h2 className="text-lg font-semibold text-gray-900">{t('requestBody')}</h2>
								{sending ? <ControlButton variant="outline" onClick={cancelSend}>{tCommon('cancel')}</ControlButton> : null}
								<button
									type="button"
									onClick={() => void send()}
									disabled={
										sending ||
										!selected ||
										imageSendBlocked ||
										audioSendBlocked ||
										(selectedIsAudio && !validateAudioTranscriptionFile(audioFile).ok) ||
										(selectedIsImage &&
											!selectedIsAudio &&
											imageOperation === 'edits' &&
											!validateEditImageFiles(editFiles).ok)
									}
									className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
								>
									<PaperAirplaneIcon className="h-4 w-4" />
									{sending ? tCommon('sending') : tCommon('send')}
								</button>
							</div>
							<Field label={t('sendState.timeoutLabel')} hint={t('sendState.timeoutHint')}>
								{field => <Input {...field} type="number" min={1} max={3600} step={1} disabled={sending} value={sendTimeoutSeconds} onChange={event => setSendTimeoutSeconds(event.target.value)} />}
							</Field>
							{sendNotice ? <p role="status">{sendNotice}</p> : null}
							{imageSendBlocked ? (
								<div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm">
									{t('imageOpenaiOnly')}
								</div>
							) : null}
							{audioSendBlocked ? (
								<div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm">
									{t('audioOpenaiOnly')}
								</div>
							) : null}
							<div className="space-y-1">
								<RequestTargetUrl
									label={t('requestTargetUrl')}
									url={requestTargetUrl}
									emptyHint={t('requestTargetUrlEmpty')}
								/>
								{selected ? (
									<p className="text-[11px] text-gray-400">{t('requestTargetUrlHint')}</p>
								) : null}
							</div>
							{selectedIsAudio && !audioSendBlocked ? (
								<div className="space-y-2">
									<p className="text-xs text-gray-500">{t('audioTranscriptionsHint')}</p>
									<div>
										<label className={labelClass}>{t('audioFile')}</label>
										<input
											type="file"
											accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
											disabled={sending}
											className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700`}
											onChange={(e) => {
												const f = e.target.files?.[0] ?? null;
												setAudioFile(f);
											}}
										/>
										<p className="mt-1 text-[11px] text-gray-400">{t('audioFileHint')}</p>
										{!audioFile ? (
											<p className="mt-1 text-xs text-amber-700">{t('audioFileRequired')}</p>
										) : (
											<p className="mt-1 text-xs text-gray-600">
												{audioFile.name} ({audioFile.size} bytes)
											</p>
										)}
										{(() => {
											if (!audioFile) return null;
											const validated = validateAudioTranscriptionFile(audioFile);
											if (validated.ok) return null;
											return <p className="mt-1 text-xs text-red-600">{validated.error}</p>;
										})()}
									</div>
								</div>
							) : null}
							{selectedIsImage && !selectedIsAudio && !imageSendBlocked ? (
								<>
									<fieldset className="flex flex-wrap items-center gap-4 text-sm border border-gray-200 rounded-md px-3 py-2">
										<legend className="sr-only">{t('imageOperation')}</legend>
										<span className="text-gray-600 font-medium">{t('imageOperation')}</span>
										<label className="inline-flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												name="playgroundImageOperation"
												className="text-blue-600 focus:ring-blue-500"
												checked={imageOperation === 'generations'}
												onChange={() => onImageOperationChange('generations')}
												disabled={sending}
											/>
											generations
										</label>
										<label className="inline-flex items-center gap-2 cursor-pointer">
											<input
												type="radio"
												name="playgroundImageOperation"
												className="text-blue-600 focus:ring-blue-500"
												checked={imageOperation === 'edits'}
												onChange={() => onImageOperationChange('edits')}
												disabled={sending}
											/>
											edits
										</label>
									</fieldset>
									<p className="text-xs text-gray-500">
										{imageOperation === 'edits' ? t('imageEditsHint') : t('imageGenerationsHint')}
									</p>
									{imageOperation === 'edits' ? (
										<div>
											<label className={labelClass}>{t('referenceImages')}</label>
											<input
												type="file"
												accept="image/png,image/jpeg,image/webp,image/*"
												multiple
												disabled={sending}
												className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700`}
												onChange={(e) => {
													const list = e.target.files ? Array.from(e.target.files) : [];
													setEditFiles(list.slice(0, IMAGE_MAX_REFERENCE_COUNT));
												}}
											/>
											<p className="mt-1 text-[11px] text-gray-400">
												{t('referenceImagesHint', { max: IMAGE_MAX_REFERENCE_COUNT })}
												{editFiles.length > 0
													? ` · ${t('referenceImagesSelected', { count: editFiles.length })}`
													: ''}
											</p>
											{editFiles.length === 0 ? (
												<p className="mt-1 text-xs text-amber-700">{t('referenceImagesRequired')}</p>
											) : null}
											{(() => {
												if (editFiles.length === 0) return null;
												const validated = validateEditImageFiles(editFiles);
												if (validated.ok) return null;
												return <p className="mt-1 text-xs text-red-600">{validated.error}</p>;
											})()}
											{editFiles.length > 0 ? (
												<ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
													{editFiles.map((f) => (
														<li key={`${f.name}-${f.size}-${f.lastModified}`}>
															{f.name} ({f.size} bytes)
														</li>
													))}
												</ul>
											) : null}
										</div>
									) : null}
								</>
							) : null}
							{normalizeProtocol(selected?.upstream_protocol ?? 'openai') === 'gemini' &&
								!selectedIsImage &&
								!selectedIsAudio && (
								<fieldset className="flex flex-wrap items-center gap-4 text-sm border border-gray-200 rounded-md px-3 py-2">
									<legend className="sr-only">{t('geminiAction')}</legend>
									<span className="text-gray-600 font-medium">{t('geminiAction')}</span>
									<label className="inline-flex items-center gap-2 cursor-pointer">
										<input
											type="radio"
											name="geminiAction"
											className="text-blue-600 focus:ring-blue-500"
											checked={geminiAction === 'generateContent'}
											onChange={() => setGeminiAction('generateContent')}
											disabled={sending}
										/>
										generateContent
									</label>
									<label className="inline-flex items-center gap-2 cursor-pointer">
										<input
											type="radio"
											name="geminiAction"
											checked={geminiAction === 'streamGenerateContent'}
											onChange={() => setGeminiAction('streamGenerateContent')}
											disabled={sending}
										/>
										streamGenerateContent
									</label>
								</fieldset>
							)}
							<div>
								<label className={labelClass}>JSON</label>
								<textarea
									value={bodyText}
									onChange={(e) => setBodyText(e.target.value)}
									disabled={sending}
									rows={8}
									className={`${inputClass} font-mono text-sm min-h-[100px]`}
									spellCheck={false}
								/>
							</div>
							{bodyError && (
								<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">{bodyError}</div>
							)}
							{lastSentWireBody != null && lastSentWireBody !== '' && (
								<div className="pt-2 border-t border-gray-100 space-y-2">
									<div>
										<div className="text-xs font-medium text-gray-600 mb-1">
											{t('sentBody')}
											<span className="font-normal text-gray-500 normal-case tracking-normal">
												{' '}
												{t('sentBodyHint')}
											</span>
										</div>
										<pre className={codeBlockClass}>{lastSentWireBody}</pre>
									</div>
								</div>
							)}
						</div>
						</div>

						<div className="min-w-0">
						<div className="bg-white rounded-lg shadow-md p-6 space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-gray-100 pb-3">
								<h2 className="text-lg font-semibold text-gray-900 shrink-0">{t('response')}</h2>
								{responseMeta && (
									<div className="flex flex-wrap items-center justify-end gap-2 text-xs min-w-0">
										<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-800">
											HTTP {responseMeta.status}
										</span>
										{responseMeta.latencyMs != null && (
											<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-800">
												{responseMeta.latencyMs} ms
											</span>
										)}
										{responseMeta.contentType && (
											<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 max-w-full truncate" title={responseMeta.contentType}>
												{responseMeta.contentType}
											</span>
										)}
									</div>
								)}
							</div>
							{responseMeta || responseText || imagePreviews.length > 0 ? (
								<>
									{responseMeta?.upstreamUrl && (
										<div className="text-xs text-gray-500 break-all">
											<span className="font-medium text-gray-600">{t('upstream')}</span>
											{responseMeta.upstreamUrl}
										</div>
									)}
									{usageHint && (
										<div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-900">
											<span className="font-semibold">{t('usageDisplayOnly')}</span>
											{usageHint}
										</div>
									)}
									{imagePreviews.length > 0 ? (
										<ImageGenerationsPreview images={imagePreviews} label={t('imagePreview')} />
									) : null}
									<div className="space-y-3">
										{imagePreviews.length === 0 ? (
										<div>
											<div className="text-xs font-medium text-gray-600 mb-1">{t('mergedContent')}</div>
											<div className="rounded-md border border-slate-200 overflow-hidden divide-y divide-slate-200">
												<div>
													<div className="text-[11px] font-semibold text-amber-900/85 uppercase tracking-wide px-3 py-1.5 bg-amber-50 border-b border-amber-100">
														{t('thinking')}
													</div>
													<pre className="max-h-[min(220px,32vh)] overflow-auto p-3 bg-amber-50/60 text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
														{mergedReasoningDisplay}
													</pre>
												</div>
												<div>
													<div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide px-3 py-1.5 bg-slate-50 border-b border-slate-100">
														{t('body')}
													</div>
													<pre className="max-h-[min(280px,38vh)] overflow-auto p-3 bg-slate-50 text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
														{mergedBodyDisplay}
														<span ref={mergedStreamEndRef} className="inline-block w-0 h-0 overflow-hidden" aria-hidden />
													</pre>
												</div>
											</div>
										</div>
										) : null}
										<div>
											<div className="text-xs font-medium text-gray-600 mb-1">{t('rawPayload')}</div>
											<pre className="max-h-[min(520px,50vh)] overflow-auto p-4 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-900 font-mono whitespace-pre-wrap break-words">
												{responseText}
												<span ref={streamEndRef} className="inline-block w-0 h-0 overflow-hidden" aria-hidden />
											</pre>
										</div>
									</div>
								</>
							) : (
								<p className="text-sm text-gray-500">{t('emptyResponseHint')}</p>
							)}
						</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function PlaygroundPage() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-full min-h-[240px]">
					<div className="text-gray-600">Loading…</div>
				</div>
			}
		>
			<PlaygroundPageInner />
		</Suspense>
	);
}

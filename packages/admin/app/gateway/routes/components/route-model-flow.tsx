'use client';
import { ControlButton, Badge } from '@xsec/ui-react';

import {
	ArrowDownIcon,
	ArrowLongRightIcon,
	ClipboardDocumentIcon,
	ExclamationTriangleIcon,
	PencilSquareIcon,
	PlusIcon,
	PowerIcon,
} from '@heroicons/react/24/outline';
import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
} from '@octafuse/core/db/model-modalities';
import { parseRoutePricingSchedule } from '@octafuse/core/db/pricing-schedule';
import { useTranslations } from 'next-intl';
import { UpstreamProtocolBrandIcon } from '@/components/upstream-brand-logo';
import { formatCompactTokens } from '@/lib/format-compact-tokens';
import {
	parseChargedFactorFromPriceOverride,
	parseMeteredFactorFromPriceOverride,
} from '@/lib/pricing-ui';
import type { GatewayModel, GatewayProvider } from '@/lib/types';
import { tagBadgeClass } from '../../models/model-utils';
import type { RouteModelGroup } from '../route-utils';
import {
	compareRoutesWithinPriorityLayer,
	factorChipClassForValue,
	factorLevelForValue,
	formatFactorMultiplier,
	formatFactorMultiplierForChip,
	formatScheduleWindowsHint,
	hasBasePricingInversion,
	parseModelTagsList,
	protocolBadgeClass,
	resolveEffectiveRouteStrategy,
	splitRoutesByProtocolAndRouteGroup,
} from '../route-utils';
import { FACTOR_CHIP_BASE, type RouteListRow, type RouteProtocolGroupSection } from '../types';

type Props = {
	card: RouteModelGroup;
	meta: GatewayModel | undefined;
	providerMeta: Map<string, GatewayProvider>;
	globalRouteStrategy: string | null;
	copiedModelId: string | null;
	togglingId: string | null;
	onCopyModelId: (modelId: string) => void;
	onCreate: (
		modelId: string,
		preset?: { protocol?: string; operation?: string; group?: string }
	) => void;
	onEdit: (route: RouteListRow) => void;
	onEditModel: (modelId: string) => void;
	onToggleStatus: (route: RouteListRow) => void;
	onOpenStrategyDialog: (
		modelId: string,
		modelTitle: string,
		protocol: string,
		protocolLabel: string,
		group: string,
		poolId?: string | null,
		poolStrategy?: string | null,
		requestOperation?: string
	) => void;
};

function RouteTarget({
	route,
	provider,
	requestProtocol,
	requestOperation,
	togglingId,
	onEdit,
	onToggleStatus,
}: {
	route: RouteListRow;
	provider: GatewayProvider | undefined;
	requestProtocol: string;
	requestOperation: string;
	togglingId: string | null;
	onEdit: (route: RouteListRow) => void;
	onToggleStatus: (route: RouteListRow) => void;
}) {
	const t = useTranslations('routes.flow');
	const tList = useTranslations('routes.listItem');
	const charged = parseChargedFactorFromPriceOverride(route.price_override);
	const metered = parseMeteredFactorFromPriceOverride(route.price_override);
	const chargedValue = charged != null && Number.isFinite(charged) ? charged : 1;
	const meteredValue = metered != null && Number.isFinite(metered) ? metered : 1;
	const schedule = parseRoutePricingSchedule(route.price_override);
	const scheduleHint =
		formatScheduleWindowsHint(schedule.charged) || formatScheduleWindowsHint(schedule.metered);
	const chargedLevel = factorLevelForValue(chargedValue);
	const meteredLevel = factorLevelForValue(meteredValue);
	const chargedStatus = tList(`factorStatus.charged.${chargedLevel}`);
	const meteredStatus = tList(`factorStatus.metered.${meteredLevel}`);
	const hasPricingInversion = hasBasePricingInversion(chargedValue, meteredValue);
	const enabled = route.status === 'active';
	const providerDisabled = provider?.status === 'disabled';
	const configuredUpstreamOperation = route.upstream_operation ?? '*';
	const effectiveUpstreamOperation =
		configuredUpstreamOperation === '*' ? requestOperation : configuredUpstreamOperation;
	const showUpstreamMapping =
		route.upstream_protocol !== requestProtocol ||
		effectiveUpstreamOperation !== requestOperation ||
		(route.adapter != null && route.adapter !== 'passthrough');

	return (
		<div
			className={`route-target w-full min-w-0 rounded-lg border ${
				enabled ? 'route-target-active' : 'route-target-inactive'
			}`}
		>
			<div className="flex items-start gap-2 p-2.5">
				<ControlButton
					variant="ghost"
					type="button"
					onClick={() => onToggleStatus(route)}
					disabled={togglingId !== null}
					className="route-toggle"
					aria-pressed={enabled}
					title={enabled ? tList('routeEnabled') : tList('routeDisabled')}
					aria-label={enabled ? tList('routeEnabled') : tList('routeDisabled')}
				>
					<PowerIcon className="h-3.5 w-3.5" />
				</ControlButton>
				<ControlButton
					variant="ghost"
					type="button"
					onClick={() => onEdit(route)}
					className="route-target-edit min-w-0 flex-1"
					title={t('editRoute')}
				>
					<div className="flex min-w-0 items-center gap-2">
						<span className="min-w-0 flex-1 truncate text-[11px] font-semibold route-text">
							{route.provider_name || provider?.name || route.provider_id}
						</span>
						<PencilSquareIcon className="h-3 w-3 shrink-0 route-muted" />
					</div>
					<p
						className="mt-0.5 truncate font-mono text-[10px] route-muted"
						title={route.provider_model_name}
					>
						{route.provider_model_name}
					</p>
				</ControlButton>
			</div>
			<div
				className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t route-surface px-2.5 py-1.5 ${
					enabled ? 'border-emerald-200' : 'border-red-200'
				}`}
			>
				<div className="flex min-w-0 flex-wrap items-center gap-1">
					{showUpstreamMapping ? (
						<span
							className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${protocolBadgeClass(
								route.upstream_protocol
							)}`}
						>
							<UpstreamProtocolBrandIcon protocol={route.upstream_protocol} />
							{route.upstream_protocol}.{effectiveUpstreamOperation}
						</span>
					) : null}
					<span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
						{t('weight', { value: route.weight ?? 1 })}
					</span>
					{route.custom_params ? (
						<span
							className="rounded route-subtle px-1.5 py-0.5 text-[10px] font-medium route-muted ring-1 ring-inset ring-gray-200"
							title={t('customParamsTooltip')}
						>
							{t('customParams')}
						</span>
					) : null}
					{providerDisabled ? (
						<span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
							<ExclamationTriangleIcon className="h-3 w-3" />
							{t('providerDisabled')}
						</span>
					) : null}
				</div>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-1">
					<span
						className={factorChipClassForValue(chargedValue, 'charged')}
						title={tList('chargedTooltip', {
							value: formatFactorMultiplier(chargedValue),
							status: chargedStatus,
						})}
						aria-label={tList('chargedFactorAria', {
							value: formatFactorMultiplier(chargedValue),
							status: chargedStatus,
						})}
					>
						{t('chargedShort')} {formatFactorMultiplierForChip(chargedValue)}
					</span>
					<span
						className={factorChipClassForValue(meteredValue, 'metered')}
						title={tList('meteredTooltip', {
							value: formatFactorMultiplier(meteredValue),
							status: meteredStatus,
						})}
						aria-label={tList('meteredFactorAria', {
							value: formatFactorMultiplier(meteredValue),
							status: meteredStatus,
						})}
					>
						{t('meteredShort')} {formatFactorMultiplierForChip(meteredValue)}
					</span>
					{hasPricingInversion ? (
						<span
							className={`${FACTOR_CHIP_BASE} w-auto bg-rose-100 text-rose-950 ring-rose-300/90`}
							title={tList('baseInversionTooltip')}
						>
							{tList('baseInversionBadge')}
						</span>
					) : null}
					{scheduleHint ? (
						<span
							className={`${FACTOR_CHIP_BASE} w-auto bg-sky-50 text-sky-800 ring-sky-200`}
							title={scheduleHint}
						>
							{t('scheduled')}
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}

function FlowConnector({ onAdd }: { onAdd: () => void }) {
	const t = useTranslations('routes.flow');

	return (
		<>
			<div className="relative hidden h-5 route-flow-wide">
				<span className="absolute inset-x-0 top-1/2 h-px bg-blue-300" aria-hidden />
				<ArrowLongRightIcon
					className="absolute -right-px top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500"
					aria-hidden
				/>
				<span className="absolute bottom-[calc(50%+0.45rem)] left-0 right-0 truncate text-center text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
					{t('providerStep')}
				</span>
				<ControlButton
					variant="ghost"
					type="button"
					onClick={onAdd}
					className="route-add-inline absolute left-1/2 top-[calc(50%+0.7rem)] inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md route-surface px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-200 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					<PlusIcon className="h-3 w-3" />
					{t('addProvider')}
				</ControlButton>
			</div>
			<div className="flex flex-col items-center gap-1 py-1 route-flow-narrow">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
					{t('providerStep')}
				</span>
				<ArrowDownIcon className="h-4 w-4 text-blue-400" aria-hidden />
				<ControlButton
					variant="ghost"
					type="button"
					onClick={onAdd}
					className="inline-flex items-center gap-1 rounded-md route-surface px-2 py-1 text-[11px] font-semibold text-blue-600 ring-1 ring-inset ring-blue-200 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					{t('addProvider')}
				</ControlButton>
			</div>
		</>
	);
}

function RoutingMatchConnector({ modelId, routeGroup }: { modelId: string; routeGroup: string }) {
	const t = useTranslations('routes.flow');
	const requestedModelId = routeGroup === 'default' ? modelId : `${modelId}:${routeGroup}`;

	return (
		<>
			<div
				className="relative hidden h-5 min-w-0 route-flow-wide"
				aria-label={t('routeMatchAria', { group: routeGroup, model: requestedModelId })}
			>
				<span className="absolute inset-x-0 top-1/2 h-px bg-blue-300" aria-hidden />
				<span
					title={routeGroup}
					className="absolute left-1/2 top-1/2 z-10 max-w-full -translate-x-1/2 -translate-y-1/2 truncate rounded-full route-subtle px-2 py-0.5 text-[10px] font-semibold route-muted ring-1 ring-inset ring-slate-200"
				>
					{t('routeGroup')} · {routeGroup}
				</span>
				<ArrowLongRightIcon
					className="absolute -right-px top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500"
					aria-hidden
				/>
				<p
					className="absolute left-0 right-0 top-[calc(50%+0.8rem)] line-clamp-2 break-all text-center font-mono text-[10px] font-medium leading-3 text-blue-600"
					title={`model=${requestedModelId}`}
				>
					model={requestedModelId}
				</p>
			</div>
			<div
				className="flex min-w-0 flex-col items-center gap-1 py-0.5 route-flow-narrow"
				aria-label={t('routeMatchAria', { group: routeGroup, model: requestedModelId })}
			>
				<span className="max-w-full break-all rounded-full route-subtle px-2 py-0.5 text-center text-[10px] font-semibold route-muted ring-1 ring-inset ring-slate-200">
					{t('routeGroup')} · {routeGroup}
				</span>
				<span
					className="line-clamp-2 max-w-full break-all text-center font-mono text-[10px] font-medium leading-3 text-blue-600"
					title={`model=${requestedModelId}`}
				>
					model={requestedModelId}
				</span>
				<ArrowDownIcon className="h-4 w-4 text-blue-400" aria-hidden />
			</div>
		</>
	);
}

function requestSurfacePath(protocol: string, operation: string, modelId: string): string {
	if (protocol === 'openai') {
		const paths: Record<string, string> = {
			chat: '/v1/chat/completions',
			responses: '/v1/responses',
			'images.generations': '/v1/images/generations',
			'images.edits': '/v1/images/edits',
			'audio.transcriptions': '/v1/audio/transcriptions',
		};
		return operation === '*' ? '/v1/*' : paths[operation] ?? `/v1/${operation}`;
	}
	if (protocol === 'anthropic') {
		return operation === '*' ? '/v1/*' : '/v1/messages';
	}
	if (protocol === 'gemini') {
		return `/v1beta/models/${modelId}:${operation}`;
	}
	return operation === '*' ? '/*' : `/${operation}`;
}

type RequestSurfaceGroup = {
	key: string;
	protocol: string;
	protocolLabel: string;
	requestOperation: string;
	sections: RouteProtocolGroupSection<RouteListRow>[];
};

function groupSectionsByRequestSurface(
	sections: RouteProtocolGroupSection<RouteListRow>[]
): RequestSurfaceGroup[] {
	const groups = new Map<string, RequestSurfaceGroup>();
	for (const section of sections) {
		const key = `${section.protocol}\u0000${section.requestOperation}`;
		const group = groups.get(key) ?? {
			key,
			protocol: section.protocol,
			protocolLabel: section.protocolLabel,
			requestOperation: section.requestOperation,
			sections: [],
		};
		group.sections.push(section);
		groups.set(key, group);
	}
	return [...groups.values()];
}

function RequestSurfaceNode({
	surface,
	modelId,
}: {
	surface: RequestSurfaceGroup;
	modelId: string;
}) {
	const t = useTranslations('routes.flow');
	const surfacePath = requestSurfacePath(surface.protocol, surface.requestOperation, modelId);

	return (
		<div className="route-request-node">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
					{t('requestNode')}
				</span>
				<span
					className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1 ring-inset ${protocolBadgeClass(
						surface.protocol
					)}`}
					title={surface.protocolLabel}
					aria-label={surface.protocolLabel}
				>
					<UpstreamProtocolBrandIcon protocol={surface.protocol} />
				</span>
			</div>
			<div className="mt-1.5 min-w-0">
				<span
					className="block min-w-0 truncate font-mono text-[11px] font-semibold route-text"
					title={surfacePath}
				>
					{surfacePath}
				</span>
			</div>
		</div>
	);
}

function FlowBranch({
	section,
	card,
	meta,
	providerMeta,
	globalRouteStrategy,
	branchIndex,
	branchCount,
	togglingId,
	onCreate,
	onEdit,
	onToggleStatus,
	onOpenStrategyDialog,
}: {
	section: RouteProtocolGroupSection<RouteListRow>;
	card: RouteModelGroup;
	meta: GatewayModel | undefined;
	providerMeta: Map<string, GatewayProvider>;
	globalRouteStrategy: string | null;
	branchIndex: number;
	branchCount: number;
	togglingId: string | null;
	onCreate: Props['onCreate'];
	onEdit: Props['onEdit'];
	onToggleStatus: Props['onToggleStatus'];
	onOpenStrategyDialog: Props['onOpenStrategyDialog'];
}) {
	const t = useTranslations('routes.flow');
	const strategy = resolveEffectiveRouteStrategy({
		poolStrategy: section.poolStrategy,
		routePolicyRaw: meta?.route_policy ?? null,
		protocol: section.protocol,
		requestOperation: section.requestOperation,
		routeGroup: section.group,
		globalStrategy: globalRouteStrategy,
	});
	const strategySourceLabel = t(`strategySource.${strategy.source}`);
	const priorityLayers = [
		...section.routes.reduce((map, route) => {
			const layer = map.get(route.priority) ?? [];
			layer.push(route);
			map.set(route.priority, layer);
			return map;
		}, new Map<number, RouteListRow[]>()),
	]
		.sort(([a], [b]) => b - a)
		.map(
			([priority, routes]) =>
				[priority, [...routes].sort(compareRoutesWithinPriorityLayer)] as const
		);
	const railClass =
		branchIndex === 0
			? 'top-1/2 bottom-0'
			: branchIndex === branchCount - 1
			? 'top-0 bottom-1/2'
			: 'inset-y-0';

	return (
		<div className="route-branch relative py-3">
			{branchCount > 1 ? (
				<span
					className={`absolute left-0 hidden w-px bg-blue-300 route-flow-wide ${railClass}`}
					aria-hidden
				/>
			) : null}
			<span
				className="absolute left-0 top-1/2 hidden h-px w-4 bg-blue-300 route-flow-wide"
				aria-hidden
			/>
			<div className="route-branch-grid grid min-w-0 gap-y-2">
				<RoutingMatchConnector modelId={card.model_id} routeGroup={section.group} />

				<ControlButton
					variant="ghost"
					type="button"
					onClick={() =>
						onOpenStrategyDialog(
							card.model_id,
							card.title,
							section.protocol,
							section.protocolLabel,
							section.group,
							section.poolId,
							section.poolStrategy,
							section.requestOperation
						)
					}
					className="route-policy-node"
					title={`${t('effectiveStrategy')}: ${strategy.strategy} · ${strategySourceLabel}`}
				>
					<span className="flex items-center justify-between gap-2">
						<span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
							{t('policyNode')}
						</span>
						<PencilSquareIcon className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
					</span>
					<span className="mt-1.5 block truncate text-xs font-semibold route-text">
						{strategy.inherited ? `${t('inheritShort')} → ${strategy.strategy}` : strategy.strategy}
					</span>
					<span className="mt-0.5 block truncate text-[10px] text-indigo-500">
						{strategySourceLabel}
					</span>
				</ControlButton>

				<FlowConnector
					onAdd={() =>
						onCreate(card.model_id, {
							protocol: section.protocol,
							operation: section.requestOperation,
							group: section.group,
						})
					}
				/>

				<div className="w-full min-w-0 rounded-lg border route-border route-surface p-2 shadow-sm ">
					<div className="space-y-1.5">
						{priorityLayers.map(([priority, routes], layerIndex) => (
							<div key={priority}>
								{layerIndex > 0 ? (
									<div className="flex items-center gap-1.5 py-0.5 text-[10px] font-medium route-muted">
										<ArrowDownIcon className="h-3 w-3" />
										<span>{t('fallback')}</span>
									</div>
								) : null}
								<div className="mb-1 flex items-center gap-1.5">
									<span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
										P{priority}
									</span>
									<span className="text-[10px] font-medium route-muted">
										{layerIndex === 0 ? t('firstAttempt') : t('fallbackLayer')}
									</span>
								</div>
								<div className="flex min-w-0 flex-wrap gap-2">
									{routes.map((route) => (
										<RouteTarget
											key={route.id}
											route={route}
											provider={providerMeta.get(route.provider_id)}
											requestProtocol={section.protocol}
											requestOperation={section.requestOperation}
											togglingId={togglingId}
											onEdit={onEdit}
											onToggleStatus={onToggleStatus}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function FlowSection({
	surface,
	card,
	meta,
	providerMeta,
	globalRouteStrategy,
	togglingId,
	onCreate,
	onEdit,
	onToggleStatus,
	onOpenStrategyDialog,
}: {
	surface: RequestSurfaceGroup;
	card: RouteModelGroup;
	meta: GatewayModel | undefined;
	providerMeta: Map<string, GatewayProvider>;
	globalRouteStrategy: string | null;
	togglingId: string | null;
	onCreate: Props['onCreate'];
	onEdit: Props['onEdit'];
	onToggleStatus: Props['onToggleStatus'];
	onOpenStrategyDialog: Props['onOpenStrategyDialog'];
}) {
	return (
		<div className="route-subtle px-3 sm:px-4">
			<div className="route-surface-grid">
				<div className="relative flex min-w-0 flex-col justify-center py-3 route-request-column">
					<RequestSurfaceNode surface={surface} modelId={card.model_id} />
					<span
						className="absolute right-0 top-1/2 hidden h-px w-4 bg-blue-300 route-flow-wide"
						aria-hidden
					/>
					<div className="flex justify-center pt-1 route-flow-narrow" aria-hidden>
						<ArrowDownIcon className="h-4 w-4 text-blue-400" />
					</div>
				</div>
				<div className="divide-y divide-slate-200/80">
					{surface.sections.map((section, branchIndex) => (
						<FlowBranch
							key={section.key}
							section={section}
							card={card}
							meta={meta}
							providerMeta={providerMeta}
							globalRouteStrategy={globalRouteStrategy}
							branchIndex={branchIndex}
							branchCount={surface.sections.length}
							togglingId={togglingId}
							onCreate={onCreate}
							onEdit={onEdit}
							onToggleStatus={onToggleStatus}
							onOpenStrategyDialog={onOpenStrategyDialog}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export function RouteModelFlow(props: Props) {
	const {
		card,
		meta,
		providerMeta,
		globalRouteStrategy,
		copiedModelId,
		togglingId,
		onCopyModelId,
		onCreate,
		onEdit,
		onEditModel,
		onToggleStatus,
		onOpenStrategyDialog,
	} = props;
	const t = useTranslations('routes.card');
	const tFlow = useTranslations('routes.flow');
	const tModelsCard = useTranslations('models.card');
	const isImage = meta ? isImageGenerationModel(meta) : false;
	const isAudio = meta ? isAudioTranscriptionModel(meta) : false;
	const context = formatCompactTokens(meta?.context_window);
	const maxOutput = formatCompactTokens(meta?.max_tokens);
	const stats = isAudio
		? t('audioModelHint')
		: isImage
		? t('imageModelHint')
		: t('contextLine', { context, max: maxOutput });
	const tags = parseModelTagsList(meta);
	const sections = splitRoutesByProtocolAndRouteGroup(card.groupRoutes);
	const surfaceGroups = groupSectionsByRequestSurface(sections);

	return (
		<article className="route-topology overflow-hidden rounded-xl border route-border route-surface">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b route-border route-surface px-4 py-2.5 sm:px-5">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<ControlButton
							variant="ghost"
							type="button"
							onClick={() => onEditModel(card.model_id)}
							className="route-model-name"
						>
							{card.title}
						</ControlButton>
						<div className="flex shrink-0 items-center gap-0.5">
							<ControlButton
								variant="ghost"
								type="button"
								onClick={() => void onCopyModelId(card.model_id)}
								className={`rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
									copiedModelId === card.model_id
										? 'bg-emerald-50 text-emerald-600'
										: 'route-muted hover:bg-gray-100 hover:text-gray-700'
								}`}
								title={
									copiedModelId === card.model_id
										? t('copiedModelId')
										: t('copyModelId', { id: card.model_id })
								}
							>
								<ClipboardDocumentIcon className="h-4 w-4" />
							</ControlButton>
							<ControlButton
								variant="ghost"
								type="button"
								onClick={() => onEditModel(card.model_id)}
								className="rounded-md p-1 route-muted hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
								title={t('editModel', { title: card.title })}
							>
								<PencilSquareIcon className="h-4 w-4" />
							</ControlButton>
						</div>
					</div>
					<div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
						<span className="route-model-id font-mono text-[11px] route-muted">
							{card.model_id}
						</span>
						<span className="text-gray-300">·</span>
						<span className="text-[11px] route-muted">{stats}</span>
						{tags.length ? (
							tags.slice(0, 4).map((tag) => (
								<span
									key={tag}
									className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tagBadgeClass(tag)}`}
								>
									{tag}
								</span>
							))
						) : (
							<span className="text-[10px] route-muted">{tModelsCard('noTags')}</span>
						)}
					</div>
				</div>
				<div className="route-card-actions flex min-w-0 max-w-full flex-wrap items-center gap-2">
					<Badge tone={card.activeCount > 0 ? 'success' : 'danger'}>
						{t('activeTotalRoutes', { active: card.activeCount, total: card.groupRoutes.length })}
					</Badge>
					<ControlButton
						variant="ghost"
						type="button"
						onClick={() => onCreate(card.model_id)}
						className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
					>
						<PlusIcon className="h-3.5 w-3.5" />
						{tFlow('addRoute')}
					</ControlButton>
				</div>
			</header>

			<div className="divide-y divide-slate-200/80 route-subtle px-3 sm:px-4">
				{surfaceGroups.length ? (
					surfaceGroups.map((surface) => (
						<FlowSection
							key={surface.key}
							surface={surface}
							card={card}
							meta={meta}
							providerMeta={providerMeta}
							globalRouteStrategy={globalRouteStrategy}
							togglingId={togglingId}
							onCreate={onCreate}
							onEdit={onEdit}
							onToggleStatus={onToggleStatus}
							onOpenStrategyDialog={onOpenStrategyDialog}
						/>
					))
				) : (
					<ControlButton
						variant="ghost"
						type="button"
						onClick={() => onCreate(card.model_id)}
						className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed route-border route-surface px-4 py-8 text-sm font-medium route-muted hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
					>
						<PlusIcon className="h-5 w-5" />
						{t('clickToAdd')}
					</ControlButton>
				)}
			</div>
		</article>
	);
}

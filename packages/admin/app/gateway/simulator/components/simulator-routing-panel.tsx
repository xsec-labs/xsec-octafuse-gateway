'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, EmptyState, Field, Input, RadioGroup, Section, Select, type SelectOption } from '@xsec/ui-react';
import type { GatewayToolDefinition } from '@/lib/gateway-tools';
import { isInvokeKind, type InvokeKind } from '@/lib/invoke-kind';
import { formatModelLabel } from '../simulator-utils';
import type { AdminModelRow, RouteListRow } from '../types';

function ReadonlyField({ label, children }: { label: string; children: ReactNode }) {
	return <div className="simulator-routing-detail"><dt>{label}</dt><dd>{children}</dd></div>;
}

type Props = {
	filterKind: InvokeKind;
	onFilterKindChange: (kind: InvokeKind) => void;
	kindCounts: { llm: number; image: number; audio: number; tool: number };
	isToolKind: boolean;
	gatewayTools: readonly GatewayToolDefinition[];
	selectedToolId: string;
	onSelectTool: (id: string) => void;
	filterModel: string;
	onFilterModelChange: (value: string) => void;
	filteredModels: AdminModelRow[];
	modelsInKindTotal: number;
	modelIdsWithActiveRouter: Set<string>;
	selectedModelId: string;
	onSelectModel: (id: string) => void;
	routeGroup: string;
	onRouteGroupChange: (group: string) => void;
	routeGroupsForModel: string[];
	selectedModel: AdminModelRow | null;
	selectedModelIsImage?: boolean;
	selectedModelIsAudio?: boolean;
	modelRoutingString: string;
	matchingRoutes: RouteListRow[];
	routingSelectionError: 'model' | 'routeGroup' | null;
};

export function SimulatorRoutingPanel({
	filterKind, onFilterKindChange, kindCounts, isToolKind, gatewayTools,
	selectedToolId, onSelectTool, filterModel, onFilterModelChange, filteredModels,
	modelsInKindTotal, modelIdsWithActiveRouter, selectedModelId, onSelectModel,
	routeGroup, onRouteGroupChange, routeGroupsForModel, selectedModel,
	selectedModelIsImage = false, selectedModelIsAudio = false, modelRoutingString,
	matchingRoutes, routingSelectionError,
}: Props) {
	const t = useTranslations('simulator');
	const tRoutes = useTranslations('routes.card');
	const tTools = useTranslations('tools.catalog');
	const selectedOutsideFilter = Boolean(selectedModel && !filteredModels.some(model => model.id === selectedModel.id));
	const modelOptions = useMemo(() => {
		const visible = selectedModel && !filteredModels.some(model => model.id === selectedModel.id)
			? [selectedModel, ...filteredModels] : filteredModels;
		const options: SelectOption[] = [{ value: '', label: t('selectModel') }, ...visible.map(model => ({
			value: model.id,
			label: `${formatModelLabel(model)} · ${t(modelIdsWithActiveRouter.has(model.id) ? 'routing.activeRoute' : 'routing.noActiveRoute')}`,
		}))];
		if (selectedModelId && !selectedModel) options.push({ value: selectedModelId, label: t('routing.unavailableOption', { id: selectedModelId }), disabled: true });
		return options;
	}, [t, filteredModels, selectedModel, selectedModelId, modelIdsWithActiveRouter]);
	const groupOptions = useMemo(() => {
		const options: { value: string; label: string; disabled?: boolean }[] = [
			{ value: '', label: t('defaultRouteGroup') },
			...routeGroupsForModel.filter(group => group !== 'default').map(group => ({ value: group, label: group })),
		];
		if (routingSelectionError === 'routeGroup') options.push({ value: routeGroup, label: t('routing.unavailableOption', { id: routeGroup }), disabled: true });
		return options;
	}, [t, routeGroupsForModel, routeGroup, routingSelectionError]);
	const toolOptions = useMemo(() => gatewayTools.map(tool => ({ value: tool.id, label: `${tTools(tool.nameKey)} (${tool.id})` })), [gatewayTools, tTools]);
	const kinds = [
		{ value: 'llm', label: <>{t('kindLlm')} <Badge>{kindCounts.llm}</Badge></> },
		{ value: 'image', label: <>{t('kindImage')} <Badge>{kindCounts.image}</Badge></> },
		{ value: 'audio', label: <>{t('kindAudio')} <Badge>{kindCounts.audio}</Badge></> },
		{ value: 'tool', label: <>{t('kindTool')} <Badge>{kindCounts.tool}</Badge></> },
	];

	return <Section title={t('routingTarget')} className="simulator-routing-panel">
		<Field label={t('kind')}>{field => <RadioGroup {...field} aria-label={t('kind')} value={filterKind} options={kinds} onValueChange={value => {
			if (!isInvokeKind(value)) throw new Error('INVALID_SIMULATOR_KIND');
			onFilterKindChange(value);
		}} />}</Field>
		{isToolKind ? <>
			<Field label={t('tool')} hint={t('toolHint')}>{field => <Select {...field} value={selectedToolId} onValueChange={value => {
				if (!value || !gatewayTools.some(tool => tool.id === value)) throw new Error('INVALID_SIMULATOR_TOOL');
				onSelectTool(value);
			}} options={toolOptions} />}</Field>
			<p className="simulator-routing-hint">{t('toolNoRoutes')}</p>
			<dl className="simulator-routing-details"><ReadonlyField label={t('toolEndpoint')}>{`/v1/tools/${selectedToolId}`}</ReadonlyField></dl>
		</> : <>
			<Field label={t('filter')}>{field => <Input {...field} value={filterModel} onChange={event => onFilterModelChange(event.target.value)} placeholder={t('modelFilterPlaceholder')} autoComplete="off" />}</Field>
			<Field label={t('model')} hint={t('routing.modelCount', { total: modelsInKindTotal, filtered: filteredModels.length })} error={routingSelectionError === 'model' ? t('routing.modelUnavailable') : undefined}>{field => <Select {...field} value={selectedModelId} onValueChange={value => onSelectModel(value ?? '')} options={modelOptions} />}</Field>
			{selectedOutsideFilter ? <p className="simulator-routing-hint" role="status">{t('routing.selectedOutsideFilter')}</p> : null}
			{filteredModels.length === 0 ? <EmptyState title={t('routing.noModels')} /> : null}
			<Field label={t('routeGroupOptional')} hint={t('routeGroupHint')} error={routingSelectionError === 'routeGroup' ? t('routing.groupUnavailable') : undefined}>{field => <Select {...field} value={routeGroup === 'default' ? '' : routeGroup} onValueChange={value => onRouteGroupChange(value ?? '')} disabled={!selectedModel} options={groupOptions} />}</Field>
			{selectedModel ? <dl className="simulator-routing-details">
				<ReadonlyField label={t('routingModelString')}>{modelRoutingString}</ReadonlyField>
				{selectedModelIsAudio ? <ReadonlyField label={t('modelKind')}>{tRoutes('audioModelHint')}</ReadonlyField>
					: selectedModelIsImage ? <ReadonlyField label={t('modelKind')}>{tRoutes('imageModelHint')}</ReadonlyField>
						: <ReadonlyField label="max_tokens">{selectedModel.max_tokens ?? '—'}</ReadonlyField>}
			</dl> : null}
			<div className="simulator-routing-preview"><h3>{t('matchingRoutes')}</h3>
				{!selectedModel ? <EmptyState title={t('matchingRoutesNeedModel')} />
					: matchingRoutes.length === 0 ? <EmptyState title={t('matchingRoutesEmpty')} />
						: <ul className="simulator-routing-matches">{matchingRoutes.map(route => <li key={route.id}>
							<div><strong>{route.provider_name || route.provider_id}</strong><Badge>p{route.priority}</Badge><span>{route.route_group || 'default'}</span></div>
							<p>{[route.provider_model_name, route.upstream_protocol ? `${route.upstream_protocol}.${route.upstream_operation ?? '*'}` : null].filter(Boolean).join(' · ')}</p>
							<p>{route.pool_name ?? route.route_pool_id ?? t('routing.legacyPool')}</p>
						</li>)}</ul>}
			</div>
		</>}
	</Section>;
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	isAudioTranscriptionModel,
	isImageGenerationModel,
} from '@octafuse/core/db/model-modalities';
import { useBusinessTimezone } from '@/components/BusinessTimezoneProvider';
import { getCatalogAudioPricingDisplay, isAudioRouteModel } from '@/lib/audio-transcriptions';
import { isImageRouteModel } from '@/lib/image-generations';
import { getCatalogImagePricingDisplay, getCatalogPricingTierRows } from '@/lib/pricing-ui';
import { normalizeModelVendorInput } from '@/lib/model-vendor';
import { normalizeRouteGroup } from '@/lib/route-group-ui';
import { useTranslations } from 'next-intl';
import {
	useShellRequest,
	parseShellSuccess,
	shellFailure,
	type ShellFailure,
} from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import {
	UPSTREAM_PROTOCOLS,
	providerSupportsUpstreamProtocol,
	type UpstreamProtocol,
} from '@/lib/upstream-protocol';
import type { GatewayModel, GatewayProvider } from '@/lib/types';
import { parseKindFilterParam, type ModelKindFilter } from '../models/types';
import { useModelEditModal } from '../models/use-model-edit-modal';
import { fetchRoutesPageData, routeWrite, jsonWrite } from './route-api';
import {
	buildFormDataFromRoute,
	buildRouteCardVendorGroups,
	buildRoutePolicyPatch,
	buildRoutesByModel,
	buildVendorFilterOptions,
	createInitialRouteForm,
	readRoutePolicyFormFromRaw,
	resolveEffectiveRouteStrategy,
	sortRouteCards,
	upstreamOperationsForProviderModel,
} from './route-utils';
import {
	EMPTY_ROUTE_FORM,
	type RouteFormData,
	type RouteListRow,
	type RoutePolicyDialogState,
	type RoutePolicyFormState,
} from './types';

export function useRoutesPageState() {
	const t = useTranslations('routes.feedback'),
		common = useTranslations('common'),
		filters = useTranslations('filter');
	const searchParams = useSearchParams(),
		router = useRouter(),
		pathname = usePathname();
	const readOwner = useRef<AbortController | null>(null),
		mounted = useRef(true),
		writeBusy = useRef(false);
	const { run: write } = useShellRequest();
	const [readFailure, setReadFailure] = useState<ShellFailure | null>(null);
	const [actionFailure, setActionFailure] = useState<{
		title: string;
		failure: ShellFailure;
		uncertain: boolean;
	} | null>(null);
	const [showDelete, setShowDelete] = useState(false);
	const returnFocus = useRef<HTMLElement | null>(null),
		strategyReturnFocus = useRef<HTMLElement | null>(null),
		deleteReturnFocus = useRef<HTMLElement | null>(null);
	const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const authorizedFailure = useCallback((failure: ShellFailure, record: () => void) => {
		if (failure.status === 401) notifyAdminSessionExpired();
		else record();
	}, []);
	const [routes, setRoutes] = useState<RouteListRow[]>([]);
	const [models, setModels] = useState<GatewayModel[]>([]);
	const [providers, setProviders] = useState<GatewayProvider[]>([]);
	const [globalRouteStrategy, setGlobalRouteStrategy] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [editingRoute, setEditingRoute] = useState<RouteListRow | null>(null);
	const [duplicateSourceRouteId, setDuplicateSourceRouteId] = useState<string | null>(null);
	const [formData, setFormData] = useState<RouteFormData>(EMPTY_ROUTE_FORM);
	const filterVendor = searchParams.get('vendor')
		? normalizeModelVendorInput(searchParams.get('vendor'))
		: '';
	const filterProviderId = searchParams.get('provider_id') ?? '',
		filterRouteGroup = searchParams.get('route_group') ?? '';
	const filterStatus = searchParams.get('status') ?? '',
		filterKind = parseKindFilterParam(searchParams.get('kind'));
	const replaceFilter = useCallback(
		(key: string, value: string) => {
			const params = new URLSearchParams(searchParams.toString());
			if (value) params.set(key, value);
			else params.delete(key);
			router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
		},
		[searchParams, router, pathname]
	);
	const setFilterVendor = useCallback(
		(value: string) => replaceFilter('vendor', value),
		[replaceFilter]
	);
	const setFilterProviderId = useCallback(
		(value: string) => replaceFilter('provider_id', value),
		[replaceFilter]
	);
	const setFilterRouteGroup = useCallback(
		(value: string) => replaceFilter('route_group', value),
		[replaceFilter]
	);
	const setFilterStatus = useCallback(
		(value: string) => replaceFilter('status', value),
		[replaceFilter]
	);
	const setFilterKind = useCallback(
		(value: ModelKindFilter) => replaceFilter('kind', value),
		[replaceFilter]
	);
	const [saveError, setSaveError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [togglingId, setTogglingId] = useState<string | null>(null);
	const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
	const [strategyDialog, setStrategyDialog] = useState<RoutePolicyDialogState | null>(null);
	const [strategyForm, setStrategyForm] = useState<RoutePolicyFormState>({
		protocolStrategy: '',
		capabilityStrategies: {},
	});
	const [strategySaving, setStrategySaving] = useState(false);
	const [strategyError, setStrategyError] = useState('');
	const [billingCurrency, setBillingCurrency] = useState('USD');
	const businessTimezone = useBusinessTimezone();

	const refreshRoutesPage = useCallback(async () => {
		readOwner.current?.abort();
		const owner = new AbortController();
		readOwner.current = owner;
		setIsLoading(true);
		setReadFailure(null);
		try {
			const data = await fetchRoutesPageData(owner);
			if (!mounted.current || readOwner.current !== owner) return;
			setRoutes(data.routes);
			setModels(data.models);
			setProviders(data.providers);
			setGlobalRouteStrategy(data.globalRouteStrategy);
			setBillingCurrency(data.billingCurrency);
		} catch (error) {
			if (!mounted.current || readOwner.current !== owner) return;
			const failure = shellFailure(error);
			authorizedFailure(failure, () => setReadFailure(failure));
		} finally {
			if (mounted.current && readOwner.current === owner) {
				setIsLoading(false);
				readOwner.current = null;
			}
		}
	}, [authorizedFailure]);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			readOwner.current?.abort();
			readOwner.current = null;
			if (copyTimer.current) clearTimeout(copyTimer.current);
		};
	}, []);

	const modelSuccessFocus = useRef<HTMLHeadingElement | null>(null);
	const attachModelSuccessFocus = useCallback((element: HTMLHeadingElement | null) => {
		modelSuccessFocus.current = element;
	}, []);
	const modelEdit = useModelEditModal({
		onChanged: refreshRoutesPage,
		successFocus: modelSuccessFocus,
	});

	useEffect(() => {
		void refreshRoutesPage();
	}, [refreshRoutesPage]);

	const modelMeta = useMemo(() => {
		const map = new Map<string, GatewayModel>();
		for (const m of models) {
			map.set(m.id, m);
		}
		return map;
	}, [models]);

	const providerMeta = useMemo(() => {
		const map = new Map<string, GatewayProvider>();
		for (const provider of providers) map.set(provider.id, provider);
		return map;
	}, [providers]);

	const distinctRouteGroups = useMemo(() => {
		const set = new Set<string>();
		for (const r of routes) {
			set.add(normalizeRouteGroup(r.route_group));
		}
		return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	}, [routes]);

	const routeGroupFilterOptions = useMemo(() => {
		const list = [...distinctRouteGroups];
		if (filterRouteGroup && !list.includes(filterRouteGroup)) {
			list.push(filterRouteGroup);
		}
		return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	}, [distinctRouteGroups, filterRouteGroup]);

	const vendorFilterOptions = useMemo(
		() => buildVendorFilterOptions({ models, routes, modelMeta }),
		[models, routes, modelMeta]
	);

	const providerRouteCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const r of routes) {
			counts.set(r.provider_id, (counts.get(r.provider_id) ?? 0) + 1);
		}
		return counts;
	}, [routes]);

	const routeGroupCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const r of routes) {
			const g = normalizeRouteGroup(r.route_group);
			counts.set(g, (counts.get(g) ?? 0) + 1);
		}
		return counts;
	}, [routes]);

	const statusCounts = useMemo(() => {
		let active = 0;
		let inactive = 0;
		for (const r of routes) {
			if (r.status === 'active') active += 1;
			else inactive += 1;
		}
		return { all: routes.length, active, inactive };
	}, [routes]);

	const kindCounts = useMemo(() => {
		let llm = 0;
		let image = 0;
		let audio = 0;
		for (const m of models) {
			if (isImageGenerationModel(m)) image += 1;
			else if (isAudioTranscriptionModel(m)) audio += 1;
			else llm += 1;
		}
		return { llm, image, audio };
	}, [models]);

	const routesByModel = useMemo(
		() =>
			buildRoutesByModel({
				routes,
				models,
				modelMeta,
				filterVendor,
				filterProviderId,
				filterRouteGroup,
				filterStatus,
				filterKind,
			}),
		[
			routes,
			models,
			modelMeta,
			filterVendor,
			filterProviderId,
			filterRouteGroup,
			filterStatus,
			filterKind,
		]
	);

	const routeCards = useMemo(
		() => sortRouteCards(routesByModel, modelMeta),
		[routesByModel, modelMeta]
	);

	const routeCardVendorGroups = useMemo(
		() => buildRouteCardVendorGroups(routeCards, filterVendor),
		[routeCards, filterVendor]
	);

	const visibleModelCount = routesByModel.length;

	const visibleRouteCount = useMemo(
		() => routesByModel.reduce((sum, g) => sum + g.groupRoutes.length, 0),
		[routesByModel]
	);

	const hasActiveFilters = Boolean(
		filterVendor || filterProviderId || filterRouteGroup || filterStatus
	);

	const activeFilterSummary = useMemo(
		() =>
			[
				filterStatus ? (filterStatus === 'active' ? common('active') : common('inactive')) : '',
				filterRouteGroup ? filters('routeGroup') + ': ' + filterRouteGroup : '',
				filterVendor
					? vendorFilterOptions.find((vendor) => vendor.key === filterVendor)?.label ?? filterVendor
					: '',
				filterProviderId
					? providers.find((provider) => provider.id === filterProviderId)?.name ?? filterProviderId
					: '',
			].filter(Boolean),
		[
			filterStatus,
			filterRouteGroup,
			filterVendor,
			filterProviderId,
			providers,
			vendorFilterOptions,
			common,
			filters,
		]
	);

	const selectedProvider = useMemo(
		() => providers.find((p) => p.id === formData.provider_id),
		[providers, formData.provider_id]
	);

	const selectedModel = useMemo(
		() => models.find((m) => m.id === formData.model_id),
		[models, formData.model_id]
	);

	const selectedModelIsImage = useMemo(
		() => (selectedModel ? isImageRouteModel(selectedModel) : false),
		[selectedModel]
	);

	const selectedModelIsAudio = useMemo(
		() => (selectedModel ? isAudioRouteModel(selectedModel) : false),
		[selectedModel]
	);

	const lockOpenaiProtocol = selectedModelIsImage || selectedModelIsAudio;

	const catalogStandardTierRows = useMemo(() => {
		if (!selectedModel || selectedModelIsImage || selectedModelIsAudio) return [];
		return getCatalogPricingTierRows(selectedModel, billingCurrency);
	}, [selectedModel, selectedModelIsImage, selectedModelIsAudio, billingCurrency]);

	const catalogImagePricingDisplay = useMemo(() => {
		if (!selectedModel || !selectedModelIsImage) return null;
		return getCatalogImagePricingDisplay(selectedModel, billingCurrency);
	}, [selectedModel, selectedModelIsImage, billingCurrency]);

	const catalogAudioPricingDisplay = useMemo(() => {
		if (!selectedModel || !selectedModelIsAudio) return null;
		return getCatalogAudioPricingDisplay(selectedModel, billingCurrency);
	}, [selectedModel, selectedModelIsAudio, billingCurrency]);

	const allowedProtocolsForProvider = useMemo((): UpstreamProtocol[] => {
		if (!selectedProvider) return [];
		const supported = UPSTREAM_PROTOCOLS.filter(
			(proto) =>
				providerSupportsUpstreamProtocol(proto, selectedProvider) &&
				upstreamOperationsForProviderModel(selectedProvider, selectedModel, proto).length > 0
		);
		if (lockOpenaiProtocol) {
			return supported.includes('openai') ? ['openai'] : [];
		}
		return supported;
	}, [selectedProvider, selectedModel, lockOpenaiProtocol]);

	useEffect(() => {
		if (!showModal || !selectedProvider || allowedProtocolsForProvider.length === 0) return;
		setFormData((fd) => {
			if (allowedProtocolsForProvider.includes(fd.upstream_protocol)) return fd;
			const upstreamProtocol = allowedProtocolsForProvider[0]!;
			const upstreamOperations = upstreamOperationsForProviderModel(
				selectedProvider,
				selectedModel,
				upstreamProtocol
			);
			return {
				...fd,
				upstream_protocol: upstreamProtocol,
				upstream_operation: upstreamOperations[0] ?? fd.upstream_operation,
			};
		});
	}, [
		showModal,
		formData.provider_id,
		selectedProvider,
		selectedModel,
		allowedProtocolsForProvider,
	]);

	useEffect(() => {
		if (!showModal || !lockOpenaiProtocol) return;
		setFormData((fd) =>
			fd.upstream_protocol === 'openai' ? fd : { ...fd, upstream_protocol: 'openai' }
		);
	}, [showModal, lockOpenaiProtocol, formData.model_id]);

	const clearAllFilters = useCallback(() => {
		const params = new URLSearchParams(searchParams.toString());
		for (const key of ['vendor', 'provider_id', 'route_group', 'status']) params.delete(key);
		router.replace(pathname + (params.size ? '?' + params.toString() : ''), { scroll: false });
	}, [searchParams, pathname, router]);
	const captureFocus = useCallback(() => {
		returnFocus.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setActionFailure(null);
		setShowDelete(false);
	}, []);

	const handleCreate = useCallback(
		(
			presetModelId?: string,
			preset?: { protocol?: string; operation?: string; group?: string }
		) => {
			if (writeBusy.current) return;
			captureFocus();
			setEditingRoute(null);
			setDuplicateSourceRouteId(null);
			const initial = createInitialRouteForm(models, presetModelId);
			setFormData({
				...initial,
				upstream_protocol:
					preset?.protocol && UPSTREAM_PROTOCOLS.includes(preset.protocol as UpstreamProtocol)
						? (preset.protocol as UpstreamProtocol)
						: initial.upstream_protocol,
				request_protocol:
					preset?.protocol && UPSTREAM_PROTOCOLS.includes(preset.protocol as UpstreamProtocol)
						? (preset.protocol as UpstreamProtocol)
						: initial.request_protocol,
				request_operation: preset?.operation ?? initial.request_operation,
				upstream_operation: preset?.operation ?? initial.upstream_operation,
				route_group: preset?.group ?? initial.route_group,
			});
			setShowModal(true);
			setSaveError('');
		},
		[models, captureFocus]
	);

	const handleEdit = useCallback(
		(route: RouteListRow) => {
			if (writeBusy.current) return;
			captureFocus();
			setEditingRoute(route);
			setDuplicateSourceRouteId(null);
			setFormData(buildFormDataFromRoute(route, models));
			setShowModal(true);
			setSaveError('');
		},
		[models, captureFocus]
	);

	const handleDuplicate = useCallback(
		(route: RouteListRow) => {
			if (writeBusy.current) return;
			setActionFailure(null);
			setEditingRoute(null);
			setDuplicateSourceRouteId(route.id);
			setFormData(buildFormDataFromRoute(route, models));
			setShowModal(true);
			setSaveError('');
		},
		[models]
	);

	const recordAction = useCallback(
		(title: string, failure: ShellFailure) =>
			authorizedFailure(failure, () =>
				setActionFailure({ title, failure, uncertain: failure.code !== 'HTTP_ERROR' })
			),
		[authorizedFailure]
	);
	const handleDelete = useCallback(
		async (id: string) => {
			if (writeBusy.current) return;
			writeBusy.current = true;
			setIsDeleting(true);
			setActionFailure(null);
			let committed = false;
			try {
				await write(
					'/api/admin/routes/' + encodeURIComponent(id),
					{ method: 'DELETE' },
					parseShellSuccess,
					() => {
						committed = true;
						setShowDelete(false);
						setShowModal(false);
						setEditingRoute(null);
						setDuplicateSourceRouteId(null);
					},
					(failure) => recordAction(t('deleteFailed'), failure)
				);
				if (mounted.current && committed) await refreshRoutesPage();
			} finally {
				writeBusy.current = false;
				if (mounted.current) setIsDeleting(false);
			}
		},
		[write, recordAction, t, refreshRoutesPage]
	);
	const handleToggleStatus = useCallback(
		async (route: RouteListRow) => {
			if (writeBusy.current) return;
			writeBusy.current = true;
			setTogglingId(route.id);
			setActionFailure(null);
			const status = route.status === 'active' ? 'inactive' : 'active';
			try {
				await write(
					'/api/admin/routes/' + encodeURIComponent(route.id),
					jsonWrite('PATCH', { status }),
					parseShellSuccess,
					() =>
						setRoutes((previous) =>
							previous.map((row) => (row.id === route.id ? { ...row, status } : row))
						),
					(failure) => recordAction(t('statusFailed'), failure)
				);
			} finally {
				writeBusy.current = false;
				if (mounted.current) setTogglingId(null);
			}
		},
		[write, recordAction, t]
	);
	const copyModelId = useCallback(
		async (modelId: string) => {
			try {
				await navigator.clipboard.writeText(modelId);
				if (!mounted.current) return;
				if (copyTimer.current) clearTimeout(copyTimer.current);
				setCopiedModelId(modelId);
				copyTimer.current = setTimeout(() => {
					setCopiedModelId(null);
					copyTimer.current = null;
				}, 2000);
			} catch (error) {
				if (mounted.current)
					setActionFailure({
						title: t('copyFailed'),
						failure: shellFailure(error),
						uncertain: false,
					});
			}
		},
		[t]
	);
	const handleSave = useCallback(async () => {
		if (writeBusy.current) return;
		setSaveError('');
		setActionFailure(null);
		let request: ReturnType<typeof routeWrite>;
		try {
			request = routeWrite(formData, editingRoute);
		} catch (error) {
			setSaveError(
				error instanceof Error && error.message === 'INVALID_ROUTE_FIELDS'
					? t('invalidFields')
					: (error instanceof Error && error.message.includes('custom_params')) ||
					  error instanceof SyntaxError
					? t('invalidParams')
					: t('invalidPricing')
			);
			return;
		}
		writeBusy.current = true;
		setIsSaving(true);
		let committed = false;
		try {
			await write(
				request.path,
				request.init,
				parseShellSuccess,
				() => {
					committed = true;
					setShowModal(false);
					setEditingRoute(null);
					setDuplicateSourceRouteId(null);
				},
				(failure) => recordAction(t('saveFailed'), failure)
			);
			if (committed && mounted.current) await refreshRoutesPage();
		} finally {
			writeBusy.current = false;
			if (mounted.current) setIsSaving(false);
		}
	}, [formData, editingRoute, t, common, write, recordAction, refreshRoutesPage]);

	const handleOpenStrategyDialog = useCallback(
		(
			modelId: string,
			modelTitle: string,
			protocol: string,
			protocolLabel: string,
			group: string,
			poolId?: string | null,
			poolStrategy?: string | null,
			requestOperation?: string
		) => {
			if (writeBusy.current) return;
			strategyReturnFocus.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			setActionFailure(null);
			const raw = modelMeta.get(modelId)?.route_policy ?? null;
			const inherited = resolveEffectiveRouteStrategy({
				routePolicyRaw: raw,
				protocol,
				requestOperation,
				routeGroup: group,
				globalStrategy: globalRouteStrategy,
			});
			const matchingTargets = routes
				.filter((route) =>
					poolId
						? route.route_pool_id === poolId
						: route.model_id === modelId &&
						  route.upstream_protocol === protocol &&
						  normalizeRouteGroup(route.route_group) === normalizeRouteGroup(group)
				)
				.map((route) => ({
					id: route.id,
					providerId: route.provider_id,
					providerName:
						route.provider_name || providerMeta.get(route.provider_id)?.name || route.provider_id,
					providerModelName: route.provider_model_name,
					priority: route.priority,
					weight: route.weight ?? 1,
					active:
						route.status === 'active' && providerMeta.get(route.provider_id)?.status !== 'disabled',
				}));
			setStrategyForm(
				poolId
					? { protocolStrategy: poolStrategy ?? '', capabilityStrategies: {} }
					: readRoutePolicyFormFromRaw(raw, protocol, group)
			);
			setStrategyError('');
			setStrategyDialog({
				modelId,
				modelTitle,
				protocol,
				protocolLabel,
				group,
				poolId,
				poolStrategy,
				requestOperation,
				inheritedStrategy: inherited.strategy,
				inheritedSource: inherited.source,
				targets: matchingTargets,
			});
		},
		[globalRouteStrategy, modelMeta, providerMeta, routes]
	);

	const handleSaveStrategy = useCallback(async () => {
		if (!strategyDialog || writeBusy.current) return;
		writeBusy.current = true;
		setStrategySaving(true);
		setStrategyError('');
		setActionFailure(null);
		let committed = false;
		try {
			const path = strategyDialog.poolId
				? '/api/admin/routes/pools/' + encodeURIComponent(strategyDialog.poolId)
				: '/api/admin/models/' + encodeURIComponent(strategyDialog.modelId);
			const payload = strategyDialog.poolId
				? { strategy: strategyForm.protocolStrategy || null }
				: {
						route_policy: buildRoutePolicyPatch(
							modelMeta.get(strategyDialog.modelId)?.route_policy ?? null,
							strategyDialog.protocol,
							strategyDialog.group,
							strategyForm
						),
				  };
			await write(
				path,
				jsonWrite('PATCH', payload),
				parseShellSuccess,
				() => {
					committed = true;
					setStrategyDialog(null);
				},
				(failure) => recordAction(t('strategyFailed'), failure)
			);
			if (committed && mounted.current) await refreshRoutesPage();
		} finally {
			writeBusy.current = false;
			if (mounted.current) setStrategySaving(false);
		}
	}, [modelMeta, refreshRoutesPage, strategyDialog, strategyForm, write, t, recordAction]);
	const closeRouteModal = useCallback(() => {
		if (!writeBusy.current && !showDelete) setShowModal(false);
	}, [showDelete]);
	const closeStrategyDialog = useCallback(() => {
		if (!writeBusy.current) setStrategyDialog(null);
	}, []);
	const openDelete = useCallback(() => {
		if (writeBusy.current) return;
		deleteReturnFocus.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		setActionFailure(null);
		setShowDelete(true);
	}, []);
	const closeDelete = useCallback(() => {
		if (!writeBusy.current) {
			setShowDelete(false);
			setActionFailure(null);
		}
	}, []);

	return {
		isLoading,
		readFailure,
		actionFailure,
		showDelete,
		openDelete,
		closeDelete,
		returnFocus,
		strategyReturnFocus,
		deleteReturnFocus,
		busy: isSaving || isDeleting || strategySaving || togglingId !== null,
		routes,
		models,
		providers,
		globalRouteStrategy,
		modelMeta,
		providerMeta,
		billingCurrency,
		filterVendor,
		setFilterVendor,
		filterProviderId,
		setFilterProviderId,
		filterRouteGroup,
		setFilterRouteGroup,
		filterStatus,
		setFilterStatus,
		filterKind,
		setFilterKind,
		hasActiveFilters,
		clearAllFilters,
		activeFilterSummary,
		visibleModelCount,
		visibleRouteCount,
		statusCounts,
		kindCounts,
		routeGroupFilterOptions,
		routeGroupCounts,
		vendorFilterOptions,
		providerRouteCounts,
		routesByModel,
		routeCards,
		routeCardVendorGroups,
		showModal,
		setShowModal,
		editingRoute,
		duplicateSourceRouteId,
		formData,
		setFormData,
		saveError,
		isSaving,
		isDeleting,
		togglingId,
		copiedModelId,
		selectedProvider,
		selectedModel,
		catalogStandardTierRows,
		catalogImagePricingDisplay,
		catalogAudioPricingDisplay,
		selectedModelIsImage,
		selectedModelIsAudio,
		allowedProtocolsForProvider,
		businessTimezone,
		strategyDialog,
		setStrategyDialog,
		strategyForm,
		setStrategyForm,
		strategySaving,
		strategyError,
		handleCreate,
		handleEdit,
		handleDuplicate,
		handleDelete,
		handleToggleStatus,
		copyModelId,
		handleSave,
		handleOpenStrategyDialog,
		handleSaveStrategy,
		closeRouteModal,
		closeStrategyDialog,
		refreshRoutesPage,
		modelEdit,
		attachModelSuccessFocus,
	};
}

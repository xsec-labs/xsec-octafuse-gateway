'use client';
import { memo } from 'react';
import { ControlButton, Field, RadioGroup, Select } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import type { GatewayProvider } from '@/lib/types';
import type { ModelKindFilter } from '../../models/types';
type Props = {
	visibleModelCount: number;
	visibleRouteCount: number;
	hasActiveFilters: boolean;
	filterStatus: string;
	filterKind: ModelKindFilter;
	filterRouteGroup: string;
	filterVendor: string;
	filterProviderId: string;
	statusCounts: { all: number; active: number; inactive: number };
	kindCounts: { llm: number; image: number; audio: number };
	routesCount: number;
	routeGroupFilterOptions: string[];
	routeGroupCounts: Map<string, number>;
	vendorFilterOptions: Array<{ key: string; label: string; count: number }>;
	providers: GatewayProvider[];
	providerRouteCounts: Map<string, number>;
	onFilterStatusChange: (status: string) => void;
	onFilterKindChange: (kind: ModelKindFilter) => void;
	onFilterRouteGroupChange: (group: string) => void;
	onFilterVendorChange: (vendor: string) => void;
	onFilterProviderIdChange: (providerId: string) => void;
	onClearAllFilters: () => void;
};

export const RouteFilterSidebar = memo(function RouteFilterSidebar(props: Props) {
	const t = useTranslations('filter'),
		common = useTranslations('common');
	const countLabel = (label: string, count: number) => label + ' · ' + count;
	return (
		<section className="route-filters" aria-label={t('title')}>
			<div className="route-filter-heading">
				<h2>{t('title')}</h2>
				<span>
					{t('modelsAndRoutes', {
						models: props.visibleModelCount,
						routes: props.visibleRouteCount,
					})}
				</span>
				{props.hasActiveFilters ? (
					<ControlButton variant="ghost" size="sm" onClick={props.onClearAllFilters}>
						{t('clear')}
					</ControlButton>
				) : null}
			</div>
			<div className="route-filter-grid">
				<Field label={t('kind')}>
					{(field) => (
						<RadioGroup
							id={field.id}
							aria-label={t('kindAria')}
							value={props.filterKind}
							onValueChange={(value) => props.onFilterKindChange(value as ModelKindFilter)}
							options={(['llm', 'image', 'audio'] as const).map((value) => ({
								value,
								label: countLabel(
									t(value === 'llm' ? 'kindLlm' : value === 'image' ? 'kindImage' : 'kindAudio'),
									props.kindCounts[value]
								),
							}))}
						/>
					)}
				</Field>
				<Field label={t('status')}>
					{(field) => (
						<Select
							{...field}
							value={props.filterStatus}
							onValueChange={(value) => props.onFilterStatusChange(value ?? '')}
							options={[
								{ value: '', label: countLabel(t('all'), props.statusCounts.all) },
								{ value: 'active', label: countLabel(common('active'), props.statusCounts.active) },
								{
									value: 'inactive',
									label: countLabel(common('inactive'), props.statusCounts.inactive),
								},
							]}
						/>
					)}
				</Field>
				<Field label={t('routeGroup')}>
					{(field) => (
						<Select
							{...field}
							value={props.filterRouteGroup}
							onValueChange={(value) => props.onFilterRouteGroupChange(value ?? '')}
							options={[
								{ value: '', label: countLabel(t('all'), props.routesCount) },
								...props.routeGroupFilterOptions.map((value) => ({
									value,
									label: countLabel(value, props.routeGroupCounts.get(value) ?? 0),
								})),
							]}
						/>
					)}
				</Field>
				<Field label={t('vendor')}>
					{(field) => (
						<Select
							{...field}
							value={props.filterVendor}
							onValueChange={(value) => props.onFilterVendorChange(value ?? '')}
							options={[
								{ value: '', label: countLabel(t('all'), props.routesCount) },
								...props.vendorFilterOptions.map((vendor) => ({
									value: vendor.key,
									label: countLabel(vendor.label, vendor.count),
								})),
								...(props.filterVendor &&
								!props.vendorFilterOptions.some((vendor) => vendor.key === props.filterVendor)
									? [{ value: props.filterVendor, label: props.filterVendor }]
									: []),
							]}
						/>
					)}
				</Field>
				<Field label={t('provider')}>
					{(field) => (
						<Select
							{...field}
							value={props.filterProviderId}
							onValueChange={(value) => props.onFilterProviderIdChange(value ?? '')}
							options={[
								{ value: '', label: countLabel(t('all'), props.routesCount) },
								...props.providers.map((provider) => ({
									value: provider.id,
									label: countLabel(provider.name, props.providerRouteCounts.get(provider.id) ?? 0),
								})),
								...(props.filterProviderId &&
								!props.providers.some((provider) => provider.id === props.filterProviderId)
									? [{ value: props.filterProviderId, label: props.filterProviderId }]
									: []),
							]}
						/>
					)}
				</Field>
			</div>
		</section>
	);
});

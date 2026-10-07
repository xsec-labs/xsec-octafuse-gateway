'use client';
import { Badge, ControlButton, EmptyState, Field, RadioGroup, Section, Select, type SelectOption } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import { memo, type ReactNode } from 'react';
import type { RouteListRow } from '../routes/catalog';
import type { ModelKindFilter } from '../models/types';

export type CatalogFilters = { kind: ModelKindFilter; model: string; provider: string; protocol: string; group: string };
type Props = {
 filters: CatalogFilters;
 modelOptions: SelectOption[];
 providerOptions: SelectOption[];
 protocolOptions: string[];
 groupOptions: string[];
 kindCounts: Record<ModelKindFilter, number>;
 routes: RouteListRow[];
 total: number;
 selected: RouteListRow | null;
 disabled: boolean;
 onFilter: <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => void;
 onSelect: (id: string) => void;
 onClear: () => void;
};
function Detail({ label, children }: { label: string; children: ReactNode }) {
 return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
function jsonText(raw: string | null | undefined) {
 return raw == null ? '—' : JSON.stringify(JSON.parse(raw), null, 2);
}
export const PlaygroundCatalog = memo(function PlaygroundCatalog(props: Props) {
 const t = useTranslations('playground'), common = useTranslations('common');
 const { filters, selected, disabled } = props;
 return <fieldset disabled={disabled} className="playground-catalog" aria-label={t('routeSection')}>
  <Section title={t('routeSection')} className="playground-catalog-panel">
   <Field label={t('kind')}>{field => <RadioGroup {...field} aria-label={t('kind')} value={filters.kind} disabled={disabled}
    onValueChange={value => props.onFilter('kind', value as ModelKindFilter)}
    options={(['llm','image','audio'] as const).map(value => ({ value, label: t(value === 'llm' ? 'kindLlm' : value === 'image' ? 'kindImage' : 'kindAudio') + ' · ' + props.kindCounts[value] }))} />}</Field>
   <div className="playground-filter-grid">
    <Field label={t('modelId')}>{field => <Select {...field} disabled={disabled} value={filters.model} onValueChange={value => props.onFilter('model', value ?? '')}
     options={[{value:'', label:t('placeholders.allModels')},...props.modelOptions]} />}</Field>
    <Field label={t('provider')}>{field => <Select {...field} disabled={disabled} value={filters.provider} onValueChange={value => props.onFilter('provider', value ?? '')}
     options={[{value:'', label:t('placeholders.allProviders')},...props.providerOptions]} />}</Field>
    <Field label={t('protocol')}>{field => <Select {...field} disabled={disabled} value={filters.protocol} onValueChange={value => props.onFilter('protocol', value ?? '')}
     options={[{value:'', label:t('placeholders.allProtocols')},...props.protocolOptions.map(value => ({value,label:value}))]} />}</Field>
    <Field label={t('routeGroup')}>{field => <Select {...field} disabled={disabled} value={filters.group} onValueChange={value => props.onFilter('group', value ?? '')}
     options={[{value:'', label:t('placeholders.allRouteGroups')},...props.groupOptions.map(value => ({value,label:value}))]} />}</Field>
   </div>
   <Field label={t('selectRoute')} hint={t('routeCount',{total:props.total,filtered:props.routes.length})}>{field => <Select {...field} disabled={disabled || props.routes.length === 0} value={selected?.id ?? ''}
    onValueChange={value => props.onSelect(value ?? '')} options={[{value:'',label:t('selectRouteOption')},...props.routes.map(row => ({
     value:row.id, label:[row.model_name || row.model_id,row.provider_name || row.provider_id,row.provider_model_name,row.route_group,row.upstream_protocol + '.' + (row.upstream_operation ?? '*'),common(row.status === 'active' ? 'active' : 'inactive'),row.id].join(' · '),
    }))]} />}</Field>
   {props.routes.length === 0 ? <EmptyState title={t('catalog.empty')} /> : null}
   {filters.model || filters.provider || filters.protocol || filters.group ? <ControlButton variant="ghost" disabled={disabled} onClick={props.onClear}>{common('clearFilters')}</ControlButton> : null}
  </Section>
  <Section title={t('selectedRoute')} className="playground-catalog-panel">
   {selected ? <>
    <div className="playground-selected-heading"><code>{selected.id}</code><Badge tone={selected.status === 'active' ? 'success' : 'warning'}>{common(selected.status === 'active' ? 'active' : 'inactive')}</Badge></div>
    <dl className="playground-route-details">
     <Detail label={t('modelId')}>{selected.model_id}</Detail><Detail label={t('modelName')}>{selected.model_name ?? '—'}</Detail>
     <Detail label={t('providerId')}>{selected.provider_id}</Detail><Detail label={t('providerName')}>{selected.provider_name ?? '—'}</Detail>
     <Detail label={t('upstreamProtocol')}>{selected.upstream_protocol}</Detail><Detail label={t('catalog.operation')}>{selected.upstream_operation ?? '*'}</Detail>
     <Detail label={t('providerModel')}>{selected.provider_model_name}</Detail><Detail label={t('routeGroup')}>{selected.route_group}</Detail>
     <Detail label={t('catalog.pool')}>{selected.pool_name ?? selected.route_pool_id ?? t('catalog.legacyPool')}</Detail>
     <Detail label={t('priorityStatus')}>{selected.priority} / {common(selected.status === 'active' ? 'active' : 'inactive')}</Detail>
    </dl>
    <details className="playground-route-configuration"><summary>{t('catalog.configuration')}</summary><div className="playground-route-json">
     {([[t('catalog.surfaces'),selected.surfaces],['custom_params',selected.custom_params],['price_override',selected.price_override]] as const).map(([label,raw]) =>
      <div key={label}><h3>{label}</h3><pre tabIndex={0} aria-label={label}>{jsonText(raw)}</pre></div>)}
    </div></details>
   </> : <EmptyState title={t('chooseRouteHint')} />}
  </Section>
 </fieldset>;
});

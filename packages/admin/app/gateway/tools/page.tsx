'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ControlButton, Field, Input, PageHeader, Section, Select, Spinner } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { getWebSearchProviderOptions, WEB_SEARCH_PROVIDER_DOCS_URL, type WebSearchProvider } from '@/lib/web-search-options';
import { getWebFetchProviderOptions, WEB_FETCH_PROVIDER_DOCS_URL } from '@/lib/web-fetch-options';
import { getWebDeepSearchProviderOptions, WEB_DEEP_SEARCH_PROVIDER_DOCS_URL } from '@/lib/web-deep-search-options';
import { getAiDetectionProviderOptions, AI_DETECTION_PROVIDER_DOCS_URL } from '@/lib/ai-detection-options';
import { TOOL_KINDS, TOOL_CONFIG, PRICE_FIELDS, parseDraftMoney, credentialFields, hasCredentials, type ToolKind } from './tools-config';
import { useToolsState } from './use-tools-state';
import { WebSearchProviderGuideAction } from './components/web-search-provider-guide-modal';
import './tools.css';

const SAVE_KEYS = { webSearch: 'saveWebSearch', webFetch: 'saveWebFetch', webDeepSearch: 'saveWebDeepSearch', aiDetection: 'saveAiDetection' } as const;

export default function GatewayToolsConfigPage() {
    const t = useTranslations('tools'), common = useTranslations('common'), shell = useTranslations('shell');
    const state = useToolsState(), [secretsVisible, setSecretsVisible] = useState(false);
    const fieldError = (id: string) => state.feedback?.validationField === id ? state.feedback.validation : undefined;
    const options = {
        webSearch: getWebSearchProviderOptions(key => t(key)), webFetch: getWebFetchProviderOptions(key => t(key)),
        webDeepSearch: getWebDeepSearchProviderOptions(key => t(key)), aiDetection: getAiDetectionProviderOptions(key => t(key)),
    };
    const docs: Record<ToolKind, Record<string, string>> = { webSearch: WEB_SEARCH_PROVIDER_DOCS_URL, webFetch: WEB_FETCH_PROVIDER_DOCS_URL, webDeepSearch: WEB_DEEP_SEARCH_PROVIDER_DOCS_URL, aiDetection: AI_DETECTION_PROVIDER_DOCS_URL };
    const feedback = (kind: ToolKind) => {
        const result = state.feedback;
        if (!result || result.kind !== kind) return null;
        return <div className="tools-feedback">
            {result.savedKeys.length && !result.success ? <p role="status">{t('feedback.savedKeys', { keys: result.savedKeys.join(', ') })}</p> : null}
            {result.failure ? <><p className="tools-note">{t('feedback.readReplacesDrafts')}</p><ShellError title={common('saveFailed')} failure={result.failure} uncertainWrite={result.uncertain} action={<ControlButton variant="outline" onClick={() => void state.refresh()}>{shell('retry')}</ControlButton>}/></> : null}
            {result.success ? <p className="tools-success" role="status">{common('configUpdated')}</p> : null}
        </div>;
    };
    const snapshot = state.snapshot;
    return <div className="tools-page p-8">
        <PageHeader title={t('config.title')} description={t('config.subtitle')} actions={<>
            <ControlButton variant="outline" disabled={state.loading || !!state.readFailure || state.busy} aria-pressed={secretsVisible} onClick={() => setSecretsVisible(previous => !previous)}>
                {secretsVisible ? <EyeSlashIcon width={16} aria-hidden/> : <EyeIcon width={16} aria-hidden/>}{t(secretsVisible ? 'config.hideSecrets' : 'config.showSecrets')}
            </ControlButton><Link href="/gateway/tools/invocations" className="tools-link">{t('config.viewInvocations')}</Link>
        </>}/>
        {state.loading ? <Spinner label={common('loading')}/> : state.readFailure ? <ShellError title={t('feedback.readFailed')} failure={state.readFailure} action={<ControlButton variant="outline" onClick={() => void state.refresh()}>{shell('retry')}</ControlButton>}/> : snapshot ? <fieldset className="tools-fieldset" disabled={state.busy} aria-busy={state.busy}>
            {TOOL_KINDS.map(kind => {
                const definition = TOOL_CONFIG[kind], section = snapshot.sections[kind], providerOptions = options[kind];
                const enabled: readonly string[] = definition.providers.filter(provider => hasCredentials(kind, provider, section.drafts[provider]));
                return <Section key={kind} id={definition.id} title={t(kind + '.title')} className="tools-section">
                    <p className="tools-description">{t(kind + '.descriptionCatalog')}</p>
                    <form noValidate onSubmit={event => { event.preventDefault(); void state.save(kind, key => t('errors.' + key)); }}>
                        <div className="tools-section-toolbar">
                            <Field id={definition.id + '-active'} label={t(kind + '.active')} hint={enabled.length ? undefined : t(kind + '.needKeyToActivate')} error={fieldError(definition.id + '-active')}>
                                {props => <Select {...props} disabled={state.busy} value={section.active} options={providerOptions.map(option => ({ value: option.value, label: option.label + (enabled.includes(option.value) ? '' : ` (${t(kind + '.noKey')})`), disabled: !enabled.includes(option.value) }))} onValueChange={value => { if (value !== null) state.activate(kind, value); }}/>}</Field>
                            {kind === 'webSearch' ? <WebSearchProviderGuideAction activeProvider={section.active as WebSearchProvider}/> : null}
                        </div>
                        <div className="tools-provider-list">
                            {definition.providers.map(provider => {
                                const draft = section.drafts[provider], metered = parseDraftMoney(draft.metered), charged = parseDraftMoney(draft.charged), loss = metered !== null && charged !== null && charged < metered;
                                return <div key={provider} className="tools-provider" data-provider={provider} data-active={provider === section.active}>
                                    <div className="tools-provider-heading"><h3>{providerOptions.find(option => option.value === provider)!.label}</h3>
                                        <div className="tools-provider-links"><a href={docs[kind][provider]} target="_blank" rel="noopener noreferrer" className="tools-link">{t(kind + '.providerDocs')}</a><Link href={`/gateway/playground?mode=tools&tool=${definition.id}&provider=${encodeURIComponent(provider)}`} className="tools-link">{t('config.testInPlayground')}</Link></div>
                                    </div>
                                    <div className="tools-pricing" data-loss={loss}>
                                        <p className="tools-group-label">{t('unitPrices.title', { currency: snapshot.currency })}</p>
                                        <div className="tools-price-fields">{PRICE_FIELDS.map(field => <Field key={field} id={`${definition.id}-${provider}-${field}`} label={t('unitPrices.' + field)} error={fieldError(`${definition.id}-${provider}-${field}`)}>
                                            {props => <Input {...props} type="number" min={0} step="any" value={draft[field]} onChange={event => state.edit(kind, provider, field, event.target.value)}/>}</Field>)}</div>
                                        {loss ? <p className="tools-loss" role="status">{t('unitPrices.lossHint')}</p> : null}
                                    </div>
                                    <div className="tools-credentials">
                                        {credentialFields(kind).map(field => {
                                            const secret = field === 'apiKey' || field === 'secretId' || field === 'secretKey';
                                            return <Field key={field} id={`${definition.id}-${provider}-${field}`} label={kind === 'aiDetection' ? t('aiDetection.fields.' + field) : t(kind + '.apiKey')} error={fieldError(`${definition.id}-${provider}-${field}`)}>
                                                {props => <Input {...props} type={secret && !secretsVisible ? 'password' : field === 'email' ? 'email' : 'text'} value={draft[field]} autoComplete={secret ? 'new-password' : 'off'} spellCheck={false} onChange={event => state.edit(kind, provider, field, event.target.value)}/>}</Field>;
                                        })}
                                        {kind === 'aiDetection' ? <Field id={`${definition.id}-${provider}-billingUnitChars`} label={t('aiDetection.billingUnitChars')} error={fieldError(`${definition.id}-${provider}-billingUnitChars`)}>{props => <Input {...props} type="number" min={1} step={1} value={draft.billingUnitChars} onChange={event => state.edit(kind, provider, 'billingUnitChars', event.target.value)}/>}</Field> : null}
                                    </div>
                                </div>;
                            })}
                        </div>
                        <div className="tools-save"><ControlButton type="submit" loading={state.saving === kind} disabled={state.busy || state.writeBlocked || !enabled.includes(section.active)}>{state.saving === kind ? common('saving') : t('config.' + SAVE_KEYS[kind])}</ControlButton></div>
                    </form>{feedback(kind)}
                </Section>;
            })}
        </fieldset> : null}
    </div>;
}

'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ControlButton, Field, Input, PageHeader, Section, Select, Spinner, Textarea } from '@xsec/ui-react';
import { EyeIcon, EyeSlashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { ROUTE_STRATEGY_NAMES, isRouteStrategyName } from '@octafuse/core/db/model-route-policy';
import { getBusinessTimezoneOptions, BUSINESS_TIMEZONE_VALUES } from '@/lib/business-timezone-options';
import { getBillingCurrencyOptions } from '@/lib/billing-currency-options';
import { useBusinessTimezoneContext } from '@/components/BusinessTimezoneProvider';
import ShellError from '@/components/layout/ShellError';
import { CONFIG_KEYS, TOOL_KEYS, validTimezone, type ConfigDraft, type ConfigGroup } from './config-api';
import { useConfigState } from './use-config-state';
import './config.css';
const OTHER_TZ = '__other__';
function ConfigSection({ title, description, id, children }: {
    title: string;
    description: string;
    id: string;
    children: ReactNode;
}) {
    return <Section title={title} id={id} className="config-section"><p className="config-description">{description}</p><div className="config-content">{children}</div></Section>;
}
function SecretField({ id, label, hint, error, value, onChange, multiline = false }: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
}) {
    const t = useTranslations('common'), [visible, setVisible] = useState(false);
    return <Field id={id} label={label} hint={hint} error={error}>{props => <div className="config-secret">{visible && multiline ? <Textarea {...props} value={value} onChange={e => onChange(e.target.value)} rows={3} autoComplete="off" spellCheck={false}/> : <Input {...props} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete="new-password" spellCheck={false}/>}
 <ControlButton type="button" variant="outline" aria-label={`${visible ? t('hide') : t('show')} · ${label}`} aria-pressed={visible} onClick={() => setVisible(previous => !previous)}>{visible ? <EyeSlashIcon width={16} aria-hidden/> : <EyeIcon width={16} aria-hidden/>}{visible ? t('hide') : t('show')}</ControlButton></div>}</Field>;
}
export default function GatewayConfigPage() {
    const t = useTranslations('config'), common = useTranslations('common'), shell = useTranslations('shell'), brand = useTranslations('brand'), options = useTranslations('options');
    const state = useConfigState(), { refresh: refreshTimezone } = useBusinessTimezoneContext();
    const [showAdd, setShowAdd] = useState(false), [newKey, setNewKey] = useState(''), [newValue, setNewValue] = useState('');
    const addButton = useRef<HTMLButtonElement>(null), newKeyInput = useRef<HTMLInputElement>(null);
    const restoreAddFocus = useRef(false);
    useEffect(() => { if (!showAdd && restoreAddFocus.current) {
        restoreAddFocus.current = false;
        addButton.current?.focus();
    } }, [showAdd]);
    const edit = (key: keyof ConfigDraft, value: string) => state.edit(key, value);
    const error = (group: ConfigGroup) => state.feedback?.group === group ? state.feedback.validation : undefined;
    const canSave = !state.busy && !state.writeBlocked;
    const feedback = (group: ConfigGroup) => {
        const result = state.feedback;
        if (!result || result.group !== group)
            return null;
        return <div className="config-feedback">
  {result.savedKeys.length && !result.success ? <p className="config-note" role="status">{t('feedback.savedKeys', { keys: result.savedKeys.join(', ') })}</p> : null}
  {result.failure ? <><p className="config-note">{t('feedback.readReplacesDrafts')}</p><ShellError title={common('saveFailed')} failure={result.failure} uncertainWrite={result.uncertain} action={<ControlButton variant="outline" onClick={() => void state.refresh()}>{shell('retry')}</ControlButton>}/></> : null}
  {result.success ? <p className="config-success" role="status">{common('configUpdated')}</p> : null}
 </div>;
    };
    const saveLabel = (group: ConfigGroup, label: string) => state.saving === group ? common('saving') : label;
    const saveSingle = (group: Exclude<ConfigGroup, 'webhooks' | 'add'>) => {
        const value = state.draft[group].trim();
        let validation: string | undefined;
        if (group === 'master' && !value)
            validation = common('masterKeyCannotBeEmpty');
        if (group === 'timezone' && !validTimezone(value))
            validation = t('errors.invalidIanaTimezone');
        if (group === 'currency' && !['USD', 'CNY'].includes(value))
            validation = common('billingCurrencyMustBeUsdOrCny');
        if (group === 'strategy' && !isRouteStrategyName(value))
            validation = t('feedback.invalidStrategy');
        if (validation) {
            state.validate(group, validation);
            document.getElementById(group === 'timezone' ? 'business-timezone-other' : group === 'master' ? 'master-key' : group)?.focus();
            return;
        }
        void state.save(group, [{ key: CONFIG_KEYS[group], value }], group === 'timezone' ? () => void refreshTimezone() : undefined);
    };
    const handleAdd = () => {
        const key = newKey.trim();
        if (!key) {
            state.validate('add', t('feedback.keyRequired'));
            newKeyInput.current?.focus();
            return;
        }
        const reserved = Object.entries(CONFIG_KEYS).find(([, value]) => value === key);
        const messages: Record<string, string> = { master: 'useMasterKeySection', timezone: 'useBusinessTimezoneSection', currency: 'useBillingCurrencySection', strategy: 'useRouteStrategySection', wecom: 'useWebhooksSection', feishu: 'useWebhooksSection' };
        if (reserved || TOOL_KEYS.has(key)) {
            state.validate('add', t('errors.' + (reserved ? messages[reserved[0]] : 'useToolsSection')));
            newKeyInput.current?.focus();
            return;
        }
        void state.save('add', [{ key, value: newValue }], () => { setNewKey(''); setNewValue(''); restoreAddFocus.current = true; setShowAdd(false); });
    };
    const timezoneOptions = getBusinessTimezoneOptions(key => options(key)), currencyOptions = getBillingCurrencyOptions(key => options(key));
    const knownTimezone = (BUSINESS_TIMEZONE_VALUES as readonly string[]).includes(state.draft.timezone), timezoneValue = knownTimezone ? state.draft.timezone : OTHER_TZ;
    return <div className="config-page p-8"><PageHeader title={t('title')} description={t('subtitle', { product: brand('product') })} actions={<ControlButton ref={addButton} disabled={state.loading || !!state.readFailure || state.busy || state.writeBlocked || showAdd} onClick={() => { setShowAdd(true); }}><PlusIcon width={18} aria-hidden/>{t('add')}</ControlButton>}/>
 {!showAdd && state.feedback?.group === 'add' && state.feedback.success ? <p className="config-success" role="status">{common('configUpdated')}</p> : null}
 {state.loading ? <Spinner label={common('loading')}/> : state.readFailure ? <ShellError title={t('feedback.readFailed')} failure={state.readFailure} action={<ControlButton variant="outline" onClick={() => void state.refresh()}>{shell('retry')}</ControlButton>}/> : <fieldset disabled={state.busy} className="config-fieldset" aria-busy={state.busy}>
 {showAdd ? <ConfigSection id="config-add" title={t('addKey.title')} description={t('addKey.description')}><form className="config-form" onSubmit={e => { e.preventDefault(); handleAdd(); }}>
  <Field label={t('addKey.key')} error={error('add')} id="config-new-key">{props => <Input {...props} ref={newKeyInput} autoFocus value={newKey} onChange={e => { setNewKey(e.target.value); state.clearValidation(); }} placeholder={t('addKey.keyPlaceholder')} autoComplete="off"/>}</Field>
  <Field label={t('addKey.value')} id="config-new-value">{props => <Input {...props} value={newValue} onChange={e => setNewValue(e.target.value)} placeholder={t('addKey.valuePlaceholder')} autoComplete="off"/>}</Field>
  <ControlButton type="submit" disabled={!canSave}>{saveLabel('add', common('save'))}</ControlButton><ControlButton type="button" variant="outline" disabled={state.writeBlocked} onClick={() => { restoreAddFocus.current = true; setShowAdd(false); setNewKey(''); setNewValue(''); state.clearValidation(); }}>{common('cancel')}</ControlButton>
 </form>{feedback('add')}</ConfigSection> : null}
 <ConfigSection id="config-master" title={t('masterKey.title')} description={t('masterKey.description')}><form className="config-form" onSubmit={e => { e.preventDefault(); saveSingle('master'); }}>
  <SecretField id="master-key" label={t('masterKey.label')} error={error('master')} value={state.draft.master} onChange={value => edit('master', value)}/>
  <ControlButton type="submit" disabled={!canSave}>{saveLabel('master', t('saveMasterKey'))}</ControlButton>
 </form>{feedback('master')}</ConfigSection>
 <ConfigSection id="config-timezone" title={t('businessTimezone.title')} description={t('businessTimezone.description')}><form className="config-form" onSubmit={e => { e.preventDefault(); saveSingle('timezone'); }}>
  <Field id="business-timezone" label={t('businessTimezone.timezone')}>{props => <Select {...props} disabled={state.busy} value={timezoneValue} options={[...timezoneOptions, { value: OTHER_TZ, label: t('businessTimezone.otherManual') }]} onValueChange={value => { if (value !== null)
            edit('timezone', value === OTHER_TZ ? '' : value); }}/>}</Field>
  {!knownTimezone ? <Field id="business-timezone-other" label={t('businessTimezone.ianaIdentifier')} error={error('timezone')}>{props => <Input {...props} value={state.draft.timezone} onChange={e => edit('timezone', e.target.value)} placeholder={t('businessTimezone.ianaPlaceholder')}/>}</Field> : null}
  <ControlButton type="submit" disabled={!canSave}>{saveLabel('timezone', t('saveTimezone'))}</ControlButton>
 </form>{feedback('timezone')}</ConfigSection>
 <ConfigSection id="config-currency" title={t('billingCurrency.title')} description={t('billingCurrency.description')}><form className="config-form" onSubmit={e => { e.preventDefault(); saveSingle('currency'); }}>
  <Field id="currency" label={t('billingCurrency.currency')} error={error('currency')}>{props => <Select {...props} disabled={state.busy} value={state.draft.currency} options={currencyOptions} onValueChange={value => { if (value !== null)
            edit('currency', value); }}/>}</Field>
  <ControlButton type="submit" disabled={!canSave}>{saveLabel('currency', t('saveCurrency'))}</ControlButton>
 </form>{feedback('currency')}</ConfigSection>
 <ConfigSection id="config-strategy" title={t('routeStrategy.title')} description={t('routeStrategy.description')}><form className="config-form" onSubmit={e => { e.preventDefault(); saveSingle('strategy'); }}>
  <Field id="strategy" label={t('routeStrategy.strategy')} error={error('strategy')}>{props => <Select {...props} disabled={state.busy} value={state.draft.strategy} options={ROUTE_STRATEGY_NAMES.map(value => ({ value, label: value }))} onValueChange={value => { if (value !== null)
            edit('strategy', value); }}/>}</Field>
  <ControlButton type="submit" disabled={!canSave}>{saveLabel('strategy', t('saveRouteStrategy'))}</ControlButton>
 </form>{feedback('strategy')}</ConfigSection>
 <ConfigSection id="config-webhooks" title={t('errorWebhooks.title')} description={t('errorWebhooks.description')}><form className="config-webhooks" onSubmit={e => { e.preventDefault(); void state.save('webhooks', [{ key: CONFIG_KEYS.wecom, value: state.draft.wecom.trim() }, { key: CONFIG_KEYS.feishu, value: state.draft.feishu.trim() }]); }}>
  <p className="config-note">{t('errorWebhooks.urlsNote')}</p>
  <SecretField id="alert-webhook-wecom" label={t('errorWebhooks.wecomLabel')} hint={common('optional')} value={state.draft.wecom} onChange={value => edit('wecom', value)} multiline/>
  <SecretField id="alert-webhook-feishu" label={t('errorWebhooks.feishuLabel')} hint={common('optional')} value={state.draft.feishu} onChange={value => edit('feishu', value)} multiline/>
  <div><ControlButton type="submit" disabled={!canSave}>{saveLabel('webhooks', t('saveErrorWebhooks'))}</ControlButton></div>
 </form>{feedback('webhooks')}</ConfigSection>
 </fieldset>}</div>;
}

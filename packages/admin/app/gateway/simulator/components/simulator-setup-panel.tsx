'use client';
import { memo,useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge,ControlButton,EmptyState,Field,Input,RadioGroup,Section,Select,Spinner } from '@xsec/ui-react';
import type { SimulatorGeminiAction,SimulatorProtocol } from '@/lib/simulator/endpoint';
import type { ShellFailure } from '@/lib/shell-request';
import ShellError from '@/components/layout/ShellError';
import { formatKeyOptionLabel } from '../simulator-utils';
import type { AdminKeyListItem } from '../types';
type Props={
 proxyBaseUrl:string;onProxyBaseUrlChange:(v:string)=>void;
 protocol:SimulatorProtocol;onProtocolChange:(p:SimulatorProtocol)=>void;
 lockOpenaiForImage?:boolean;hideProtocolControls?:boolean;
 geminiAction:SimulatorGeminiAction;onGeminiActionChange:(a:SimulatorGeminiAction)=>void;
 filterKeyEmail:string;onFilterKeyEmailChange:(v:string)=>void;
 loadingKeys:boolean;keysError:ShellFailure|null;keys:AdminKeyListItem[];keysTotal:number;onRefreshKeys:()=>void;
 selectedKeyId:string;onSelectedKeyIdChange:(id:string)=>void;
 revealedSk:string|null;revealLoading:boolean;revealError:ShellFailure|null;onRetryReveal:()=>void;
};
export const SimulatorSetupPanel=memo(function SimulatorSetupPanel({
 proxyBaseUrl,onProxyBaseUrlChange,protocol,onProtocolChange,lockOpenaiForImage=false,hideProtocolControls=false,geminiAction,onGeminiActionChange,
 filterKeyEmail,onFilterKeyEmailChange,loadingKeys,keysError,keys,keysTotal,onRefreshKeys,selectedKeyId,onSelectedKeyIdChange,revealedSk,revealLoading,revealError,onRetryReveal,
}:Props){
 const t=useTranslations('simulator'),common=useTranslations('common'),shell=useTranslations('shell');
 const keyOptions=useMemo(()=>[{value:'',label:t('select')},...keys.map(key=>({value:key.id,label:formatKeyOptionLabel(key)}))],[keys,t]);
 return <div className="simulator-setup">
  <Section title={t('connection')} className="simulator-setup-panel">
   <Field label={t('proxyBaseUrl')} hint={t('localDevHint')}>{field=><Input {...field} type="url" placeholder="https://your-proxy.example.com" value={proxyBaseUrl} onChange={event=>onProxyBaseUrlChange(event.target.value)} autoComplete="off" />}</Field>
   {hideProtocolControls ? <p className="simulator-setup-hint">{t('toolProtocolHidden')}</p> : <>
    <Field label={t('protocol')} hint={lockOpenaiForImage ? t('protocolLockedImage') : undefined}>{field=><RadioGroup {...field} aria-label={t('protocol')} value={protocol} onValueChange={value=>onProtocolChange(value as SimulatorProtocol)} options={(['openai','anthropic','gemini'] as const).map(value=>({value,label:value,disabled:lockOpenaiForImage&&value!=='openai'}))} />}</Field>
    {protocol==='gemini'&&!lockOpenaiForImage ? <Field label={t('geminiAction')}>{field=><Select {...field} value={geminiAction} onValueChange={value=>{if(value!=='generateContent'&&value!=='streamGenerateContent')throw new Error('INVALID_SIMULATOR_ACTION');onGeminiActionChange(value);}} options={[{value:'generateContent',label:'generateContent'},{value:'streamGenerateContent',label:'streamGenerateContent'}]} />}</Field> : null}
   </>}
  </Section>
  <Section title={t('apiKey')} className="simulator-setup-panel">
   <Field label={t('emailContains')}>{field=><Input {...field} value={filterKeyEmail} onChange={event=>onFilterKeyEmailChange(event.target.value)} autoComplete="off" />}</Field>
   <div className="simulator-setup-actions"><ControlButton variant="outline" disabled={loadingKeys} onClick={onRefreshKeys}>{loadingKeys ? common('refreshing') : t('refreshList')}</ControlButton>
    <span className="simulator-setup-hint" role="status">{!loadingKeys&&!keysError ? <>{t('keysShowing',{shown:keys.length,total:keysTotal})}{keysTotal>keys.length ? t('keysLimitHint') : ''}</> : null}</span></div>
   {loadingKeys ? <Spinner label={common('loading')} /> : null}
   {keysError ? <ShellError title={common('failedToLoadApiKeys')} failure={keysError} /> : null}
   {!loadingKeys&&!keysError&&keys.length===0 ? <EmptyState title={t('setup.emptyKeys')} /> : null}
   <Field label={t('apiKeyRowId')}>{field=><Select {...field} disabled={loadingKeys||Boolean(keysError)||keys.length===0} value={selectedKeyId} onValueChange={value=>onSelectedKeyIdChange(value??'')} options={keyOptions} />}</Field>
   {revealLoading ? <Spinner label={t('loadingKey')} /> : null}
   {!revealLoading&&revealedSk ? <p role="status"><Badge tone="success">{t('setup.keyReady')}</Badge></p> : null}
   {revealError ? <ShellError title={common('failedToLoadApiKeys')} failure={revealError} action={<ControlButton variant="outline" onClick={onRetryReveal}>{shell('retry')}</ControlButton>} /> : null}
  </Section>
 </div>;
});

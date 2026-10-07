'use client';
import type { RefObject } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, EmptyState, Section, Tabs } from '@xsec/ui-react';
import { ImageGenerationsPreview } from '@/components/image-generations-preview';
import type { ImagePreviewItem } from '@/lib/image-generations';
import type { ResponseMeta, ResponseTab } from '../types';
type Props = {
 responseMeta: ResponseMeta | null; responseText: string; usageHint: string | null; imagePreviews: ImagePreviewItem[];
 responseTab: ResponseTab; onResponseTabChange: (tab: ResponseTab) => void;
 mergedReasoningDisplay: string; mergedBodyDisplay: string;
 streamEndRef: RefObject<HTMLSpanElement>; mergedStreamEndRef: RefObject<HTMLSpanElement>;
 logsHref: string | null; isToolResponse: boolean;
};
export function SimulatorResponsePanel({responseMeta, responseText, usageHint, imagePreviews, responseTab, onResponseTabChange, mergedReasoningDisplay, mergedBodyDisplay, streamEndRef, mergedStreamEndRef, logsHref, isToolResponse}: Props) {
 const t = useTranslations('simulator');
 const hasContent = Boolean(responseMeta || responseText || imagePreviews.length);
 return <Section title={t('response')} className="simulator-response-panel">
  {responseMeta ? <div className="simulator-response-meta">
   <Badge tone={responseMeta.status >= 400 ? 'danger' : 'neutral'}>HTTP {responseMeta.status}</Badge>
   {responseMeta.latencyMs != null ? <Badge>{responseMeta.latencyMs} ms</Badge> : null}
   {responseMeta.contentType ? <Badge><span className="simulator-content-type" title={responseMeta.contentType}>{responseMeta.contentType}</span></Badge> : null}
  </div> : null}
  {logsHref ? <Link href={logsHref} className="simulator-logs-link">{t(isToolResponse ? 'openToolsInvocations' : 'openRequestLogs')}</Link> : null}
  {hasContent ? <>
   {usageHint ? <p className="simulator-usage-hint"><strong>{t('usagePreview')}</strong> {usageHint}</p> : null}
   <Tabs label={t('response')} value={responseTab} onValueChange={value => { if(value !== 'merged' && value !== 'raw') throw new TypeError('Invalid response tab'); onResponseTabChange(value); }} items={[
    {value:'merged', label:t('tabMerged'), content:imagePreviews.length ? <ImageGenerationsPreview images={imagePreviews} label={t('imagePreview')} /> : <div className="simulator-merged-response">
     <div className="simulator-reasoning"><h3>{t('thinkingReasoning')}</h3><pre className="simulator-code-block">{mergedReasoningDisplay}</pre></div>
     <div><h3>{t('body')}</h3><pre className="simulator-code-block simulator-response-body">{mergedBodyDisplay}<span ref={mergedStreamEndRef} className="simulator-stream-end" aria-hidden="true" /></pre></div>
    </div>},
    {value:'raw', label:t('tabRaw'), content:<pre className="simulator-code-block simulator-raw-response">{responseText}<span ref={streamEndRef} className="simulator-stream-end" aria-hidden="true" /></pre>},
   ]} />
  </> : <EmptyState title={t('emptyResponseHint')} />}
 </Section>;
}

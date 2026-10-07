'use client';
import { Badge, EmptyState, Section, Spinner } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import type { Ref } from 'react';
import { ImageGenerationsPreview } from '@/components/image-generations-preview';
import type { ImagePreviewItem } from '@/lib/image-generations';

export type PlaygroundResponseMeta = { status: number; latencyMs: string | null; upstreamUrl: string | null; contentType: string | null };
type Props = { meta: PlaygroundResponseMeta | null; raw: string; usage: string | null; images: ImagePreviewItem[]; sending: boolean;
 reasoning: string; body: string; rawEndRef: Ref<HTMLSpanElement>; bodyEndRef: Ref<HTMLSpanElement> };
export function PlaygroundResponse({meta,raw,usage,images,sending,reasoning,body,rawEndRef,bodyEndRef}: Props) {
 const t=useTranslations('playground'),common=useTranslations('common');
 const hasResponse=meta!==null || raw.length>0 || images.length>0;
 return <Section className="playground-exchange-panel playground-response" title={t('response')}>{meta ? <div className="playground-response-badges">
  <Badge tone={meta.status>=400 ? 'danger' : 'neutral'}>HTTP {meta.status}</Badge>
  {meta.latencyMs!==null ? <Badge>{meta.latencyMs} ms</Badge> : null}
  {meta.contentType ? <Badge title={meta.contentType}>{meta.contentType}</Badge> : null}
 </div> : null}
  {sending ? <Spinner label={common('sending')} /> : null}
  {hasResponse ? <>
   {meta?.upstreamUrl ? <p className="playground-response-upstream"><strong>{t('upstream')}</strong>{meta.upstreamUrl}</p> : null}
   {usage ? <p className="playground-usage"><strong>{t('usageDisplayOnly')}</strong>{usage}</p> : null}
   {images.length ? <div className="playground-response-gallery"><ImageGenerationsPreview images={images} label={t('imagePreview')} /></div> : null}
   {images.length===0 && meta && meta.status<400 ? <div className="playground-merged-content">
    <h3>{t('mergedContent')}</h3>
    <h4>{t('thinking')}</h4><pre tabIndex={0} aria-label={t('thinking')}>{reasoning}</pre>
    <h4>{t('body')}</h4><pre tabIndex={0} aria-label={t('body')}>{body}<span ref={bodyEndRef} aria-hidden /></pre>
   </div> : null}
   <div className="playground-raw-payload"><h3>{t('rawPayload')}</h3><pre tabIndex={0} aria-label={t('rawPayload')}>{raw}<span ref={rawEndRef} aria-hidden /></pre></div>
  </> : sending ? null : <EmptyState title={t('emptyResponseHint')} />}
 </Section>;
}

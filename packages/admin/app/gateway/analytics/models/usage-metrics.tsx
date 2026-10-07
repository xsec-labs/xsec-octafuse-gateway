'use client';
import {useTranslations} from 'next-intl';
import {Badge, ControlButton} from '@xsec/ui-react';
import {buildAnalyticsTtftTooltip, resolveAnalyticsTtftPrimary, type AnalyticsTtftMetrics} from '@/components/AnalyticsTtftCell';
import {formatLatencyMs} from '@/lib/format-latency';

export function CacheBadge({rate}:{rate:number}) {
 const level=rate<=0?'none':rate>=90?'excellent':rate>=70?'good':rate>=40?'fair':rate>=20?'low':'very-low';
 return <Badge tone={rate<=0?'neutral':rate>=90?'success':rate>=20?'warning':'danger'} className={'usage-cache usage-cache-'+level}>{rate.toFixed(1)}%</Badge>;
}
export type OpenTtft = (metrics:AnalyticsTtftMetrics,anchor:HTMLElement,subject:string)=>void;
export function UsageTtftCell({metrics,noDataLabel,subject,onOpen}:{metrics:AnalyticsTtftMetrics;noDataLabel:string;subject:string;onOpen:OpenTtft}) {
 const t=useTranslations('analytics'),primary=resolveAnalyticsTtftPrimary(metrics);
 if(primary===null)return <span>{noDataLabel}</span>;
 const content=buildAnalyticsTtftTooltip(metrics,t);
 return <ControlButton variant="ghost" className="usage-ttft" title={content} aria-haspopup="dialog" aria-label={t('columns.ttft')+': '+content} onClick={event=>onOpen(metrics,event.currentTarget,subject)}>
  {primary.kind==='reasoning'||primary.kind==='content'?<Badge tone={primary.kind==='reasoning'?'warning':'neutral'}>{primary.kind==='reasoning'?'R':'C'}</Badge>:null}
  {formatLatencyMs(primary.ms)}
 </ControlButton>;
}

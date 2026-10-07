import { createRangeValue, DEFAULT_GATEWAY_TIME_RANGE_PRESET, detectRollingPreset, type GatewayTimeRangeValue } from '@/lib/analytics-range';
import { findGatewayToolById, GATEWAY_TOOLS_PROVIDER_ID } from '@/lib/gateway-tools';
import { utcApiStringToInstant, toSqlUtcDateTime } from '@/lib/business-timezone-client';

export type InvocationQuery = { tool: string; status: string; page: number; range: GatewayTimeRangeValue };
export function defaultInvocationQuery(timezone: string): InvocationQuery { return {tool:'',status:'',page:1,range:createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET,timezone)}; }
function utcDate(raw: string): string {
 if (!raw) return '';
 const match=raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/);
 if (!match || (raw.includes('T') && !/(?:Z|[+-]\d{2}:\d{2})$/.test(raw))) throw new TypeError('INVALID_QUERY');
 const wall=new Date(`${match[1]}T${match[2]}Z`), instant=utcApiStringToInstant(raw);
 if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0,19)!==`${match[1]}T${match[2]}` || !Number.isFinite(instant.getTime())) throw new TypeError('INVALID_QUERY');
 return toSqlUtcDateTime(instant);
}
export function parseInvocationQuery(params: URLSearchParams, timezone: string): InvocationQuery {
 for(const key of ['tool','status','page','start_date','end_date'])if(params.getAll(key).length>1)throw new TypeError('INVALID_QUERY');
 const query=defaultInvocationQuery(timezone), tool=params.get('tool'), status=params.get('status')??'', page=params.get('page');
 if(tool){const found=findGatewayToolById(tool);if(!found)throw new TypeError('INVALID_QUERY');query.tool=found.id;}
 if(!['','success','error'].includes(status))throw new TypeError('INVALID_QUERY');query.status=status;
 if(page!==null){if(!/^[1-9]\d*$/.test(page)||!Number.isSafeInteger(Number(page)))throw new TypeError('INVALID_QUERY');query.page=Number(page);}
 if(params.has('start_date')||params.has('end_date')){const start_date=utcDate(params.get('start_date')??''),end_date=utcDate(params.get('end_date')??'');if(start_date&&end_date&&start_date>end_date)throw new TypeError('INVALID_QUERY');query.range={preset:start_date&&end_date?detectRollingPreset(start_date,end_date)??'custom':'custom',start_date,end_date};}
 return query;
}
export function invocationUrlQuery(query: InvocationQuery): URLSearchParams {
 const p=new URLSearchParams();if(query.tool)p.set('tool',query.tool);if(query.status)p.set('status',query.status);if(query.page>1)p.set('page',String(query.page));p.set('start_date',query.range.start_date);p.set('end_date',query.range.end_date);return p;
}
export function invocationReadQuery(query: InvocationQuery): URLSearchParams {
 const p=new URLSearchParams({page:String(query.page),page_size:'50',start_date:query.range.start_date,end_date:query.range.end_date}),tool=findGatewayToolById(query.tool);
 if(tool)p.set('model_id',tool.modelId);else p.set('provider_id',GATEWAY_TOOLS_PROVIDER_ID);if(query.status)p.set('status',query.status);return p;
}

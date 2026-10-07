import { isRecord } from '@/lib/shell-request';

type StoredPayload = { raw: unknown; text: string; invalid: boolean };
/** Stored bytes stay visible when parsing or summary validation fails. */
function payload(source: string | null | undefined): StoredPayload {
 if (!source?.trim()) return {raw:null,text:'',invalid:false};
 try { const raw:unknown=JSON.parse(source);return {raw,text:JSON.stringify(raw,null,2),invalid:false}; }
 catch { return {raw:null,text:source,invalid:true}; }
}
export type ToolInvocationRequestSummary = StoredPayload & { query: string|null; provider: string|null };
export type ToolInvocationResultItem = { title?: string; url?: string; snippet?: string; siteName?: string };
export type ToolInvocationResponseSummary = StoredPayload & { resultCount: number|null; results: ToolInvocationResultItem[] };
function optionalString(record:Record<string,unknown>,key:string):boolean{return record[key]==null||typeof record[key]==='string';}
export function parseToolRequestSummary(source: string | null | undefined): ToolInvocationRequestSummary {
 const p=payload(source);if(!p.text)return {...p,query:null,provider:null};
 if(p.invalid||!isRecord(p.raw)||!['query','url','provider'].every(key=>optionalString(p.raw as Record<string,unknown>,key)))return {...p,invalid:true,query:null,provider:null};
 return {...p,query:typeof p.raw.query==='string'?p.raw.query:typeof p.raw.url==='string'?p.raw.url:null,provider:typeof p.raw.provider==='string'?p.raw.provider:null};
}
export function parseToolResponseSummary(source: string | null | undefined): ToolInvocationResponseSummary {
 const p=payload(source),invalid=():ToolInvocationResponseSummary=>({...p,invalid:true,resultCount:null,results:[]});if(!p.text)return {...p,resultCount:null,results:[]};
 if(p.invalid||!isRecord(p.raw))return invalid();const r=p.raw;
 if(r.result_count!=null&&(!Number.isSafeInteger(r.result_count)||Number(r.result_count)<0))return invalid();
 if(!['title','url','content_preview'].every(key=>optionalString(r,key)))return invalid();
 if(r.results!=null&&!Array.isArray(r.results))return invalid();
 const results:ToolInvocationResultItem[]=[];
 for(const item of (r.results??[]) as unknown[]){
  if(!isRecord(item)||!['title','url','snippet','content_preview','siteName'].every(key=>optionalString(item,key)))return invalid();
  results.push({title:typeof item.title==='string'?item.title:undefined,url:typeof item.url==='string'?item.url:undefined,snippet:typeof item.snippet==='string'?item.snippet:typeof item.content_preview==='string'?item.content_preview:undefined,siteName:typeof item.siteName==='string'?item.siteName:undefined});
 }
 if(!results.length&&(typeof r.content_preview==='string'||typeof r.url==='string'))results.push({title:typeof r.title==='string'?r.title:undefined,url:typeof r.url==='string'?r.url:undefined,snippet:typeof r.content_preview==='string'?r.content_preview:undefined});
 return {...p,resultCount:typeof r.result_count==='number'?r.result_count:results.length?results.length:null,results};
}
/** Engine columns and historical request/audit fields are the established data sources. */
export function resolveToolEngineProvider(log:{model_id?:string|null;provider_model_name?:string|null;request_body?:string|null;pricing_audit?:string|null}):string|null {
 const model=log.model_id?.trim(),column=log.provider_model_name?.trim();if(column&&column!==model&&!column.startsWith('tool:'))return column;
 const request=parseToolRequestSummary(log.request_body);if(!request.invalid&&request.provider?.trim())return request.provider.trim();
 const audit=payload(log.pricing_audit);if(!audit.invalid&&isRecord(audit.raw)&&typeof audit.raw.provider==='string'&&audit.raw.provider.trim())return audit.raw.provider.trim();return null;
}
export function toolResultHref(raw:string):string|null {
 try{const url=new URL(raw);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}
}

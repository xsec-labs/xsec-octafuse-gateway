import {BILLING_CURRENCY_KEY,DEFAULT_BILLING_CURRENCY} from '@octafuse/core/lib/billing-currency';
import {isRecord,parseShellSuccess,ShellRequestError} from '@/lib/shell-request';
import type {UserUsageRow,ModelUsageRow} from '@/lib/types';

export type UserModelUsageRow=Pick<ModelUsageRow,'model_id'|'route_group'|'request_count'|'input_tokens'|'output_tokens'|'standard_cost'|'charged_cost'|'metered_cost'|'avg_charged_per_request'|'success_rate'|'avg_latency_ms'>;
function invalid():never{throw new ShellRequestError('INVALID_RESPONSE');}
function finite(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))invalid();return value;}
function count(value:unknown):number{const result=finite(value);if(!Number.isSafeInteger(result)||result<0)invalid();return result;}
function text(value:unknown,allowEmpty=false):string{if(typeof value!=='string'||(!allowEmpty&&value.length===0))invalid();return value;}
function rate(value:unknown):number{const result=finite(value);if(result<0||result>100)invalid();return result;}
function nullableNumber(value:unknown):number|null{return value===null?null:finite(value);}
function costs(row:Record<string,unknown>){
 // Catalog valuation is optional in the published analytics response contract.
 return {standard_cost:row.standard_cost===undefined?0:finite(row.standard_cost),charged_cost:finite(row.charged_cost),metered_cost:finite(row.metered_cost)};
}
function rows(body:unknown):Record<string,unknown>[] {
 parseShellSuccess(body);if(!isRecord(body)||!Array.isArray(body.data))invalid();
 return body.data.map(row=>{if(!isRecord(row))invalid();return row;});
}
export function parseUsers(body:unknown):UserUsageRow[]{
 const result=rows(body).map(row=>{
  const request_count=count(row.request_count),error_count=count(row.error_count),distinct_models=count(row.distinct_models);
  if(error_count>request_count||distinct_models>request_count)invalid();
  const last_active_at=row.last_active_at===null?null:text(row.last_active_at);if(last_active_at!==null&&!Number.isFinite(Date.parse(last_active_at)))invalid();
  return {...costs(row),user_email:text(row.user_email),request_count,error_count,distinct_models,input_tokens:count(row.input_tokens),output_tokens:count(row.output_tokens),last_active_at,budget_max:nullableNumber(row.budget_max),budget_spent:finite(row.budget_spent),budget_usage_rate:nullableNumber(row.budget_usage_rate),success_rate:rate(row.success_rate)};
 });
 if(new Set(result.map(row=>row.user_email)).size!==result.length)invalid();return result;
}
export function parseModels(body:unknown):UserModelUsageRow[]{
 const result=rows(body).map(row=>{
  const avg_latency_ms=nullableNumber(row.avg_latency_ms);if(avg_latency_ms!==null&&avg_latency_ms<0)invalid();
  return {...costs(row),model_id:text(row.model_id),route_group:text(row.route_group,true),request_count:count(row.request_count),input_tokens:count(row.input_tokens),output_tokens:count(row.output_tokens),avg_charged_per_request:finite(row.avg_charged_per_request),success_rate:rate(row.success_rate),avg_latency_ms};
 });
 if(new Set(result.map(row=>JSON.stringify([row.model_id,row.route_group]))).size!==result.length)invalid();return result;
}
export function parseCurrency(body:unknown):string{
 let currency:string|undefined;
 for(const row of rows(body)){
  const key=text(row.key),value=text(row.value,true);if(key!==BILLING_CURRENCY_KEY)continue;
  if(currency!==undefined)invalid();currency=value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))invalid();
 }
 // A successful configuration read with no entry uses the gateway's declared USD default.
 return currency??DEFAULT_BILLING_CURRENCY;
}

import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import { parseModels } from '../models/catalog';
import { parseRoutes } from '../routes/catalog';
import { KEYS_PAGE_SIZE } from './simulator-utils';
import type { AdminKeyListItem,AdminModelRow } from './types';

function parseSimulatorModels(body:unknown):AdminModelRow[] {
 return parseModels(body).map(model=>{
  const row=model as unknown as Record<string,unknown>;
  for(const field of ['display_name','pricing_profile','input_modalities','output_modalities','released_at','description','metadata'])
   if(row[field]!==null&&typeof row[field]!=='string')throw new ShellRequestError('INVALID_RESPONSE');
  for(const field of ['context_window','max_tokens'])
   if(row[field]!==null&&(typeof row[field]!=='number'||!Number.isFinite(row[field])))throw new ShellRequestError('INVALID_RESPONSE');
  if(typeof row.created_at!=='string')throw new ShellRequestError('INVALID_RESPONSE');
  return row as unknown as AdminModelRow;
 });
}

async function request<T>(path: string, signal: AbortSignal, parse: (body: unknown) => T): Promise<T> {
 const response = await fetch(path, {signal, cache:'no-store'});
 let body: unknown;
 try { body = await response.json(); }
 catch { if(signal.aborted) throw signal.reason; throw new ShellRequestError('INVALID_RESPONSE',response.status); }
 signal.throwIfAborted();
 if(!response.ok) {
  const requestId = isRecord(body) && isRecord(body.error) && typeof body.error.requestId==='string' && /^[a-zA-Z0-9-]{1,128}$/.test(body.error.requestId) ? body.error.requestId : undefined;
  throw new ShellRequestError('HTTP_ERROR',response.status,requestId,isRecord(body)&&typeof body.message==='string' ? body.message.slice(0,300) : undefined);
 }
 return parse(body);
}

/** One atomic catalog read; failure cancels its sibling and the complete-body deadline. */
export async function readSimulatorCatalog(controller: AbortController) {
 const timer=setTimeout(()=>controller.abort(new ShellRequestError('REQUEST_TIMEOUT')),20_000);
 try {
  const [models,routes]=await Promise.all([
   request('/api/admin/models',controller.signal,parseSimulatorModels),
   request('/api/admin/routes',controller.signal,parseRoutes),
  ]);
  const modelIds=new Set(models.map(row=>row.id));
  if(routes.some(row=>!modelIds.has(row.model_id)))throw new ShellRequestError('INVALID_RESPONSE');
  return {models,routes};
 } catch(error) { const failure=controller.signal.aborted ? controller.signal.reason : error;controller.abort();throw failure; }
 finally { clearTimeout(timer); }
}

/** Simulator reads up to 200 rows; validate consumed fields and pagination before exposing selection. */
export function parseSimulatorKeys(body: unknown): { keys: AdminKeyListItem[]; total: number } {
 parseShellSuccess(body);
 if(!isRecord(body)||!Array.isArray(body.data)||!Number.isSafeInteger(body.total)||Number(body.total)<0)throw new ShellRequestError('INVALID_RESPONSE');
 const ids=new Set<string>();
 const keys=body.data.map((row: unknown)=>{
  if(!isRecord(row)||typeof row.id!=='string'||!row.id||typeof row.user_id!=='string'||!row.user_id||ids.has(row.id))throw new ShellRequestError('INVALID_RESPONSE');
  for(const name of ['name','user_email'])if(row[name]!==null&&typeof row[name]!=='string')throw new ShellRequestError('INVALID_RESPONSE');
  ids.add(row.id);
  return row as unknown as AdminKeyListItem;
 });
 if(keys.length>KEYS_PAGE_SIZE||keys.length>Number(body.total))throw new ShellRequestError('INVALID_RESPONSE');
 return {keys,total:Number(body.total)};
}
export function parseSimulatorKey(body: unknown, id: string): string {
 parseShellSuccess(body);
 if(!isRecord(body)||!isRecord(body.data)||body.data.id!==id||typeof body.data.key!=='string'||!/^sk-[A-Za-z0-9_-]+$/.test(body.data.key))throw new ShellRequestError('INVALID_RESPONSE');
 return body.data.key;
}

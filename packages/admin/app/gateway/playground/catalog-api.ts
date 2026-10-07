import { isRecord, ShellRequestError } from '@/lib/shell-request';
import { parseRoutes } from '../routes/catalog';
import { parseModels } from '../models/catalog';
import { parseProviders } from '../providers/catalog';

async function request<T>(path: string, signal: AbortSignal, parse: (body: unknown) => T) {
 const response = await fetch(path, { signal, cache: 'no-store' });
 let body: unknown;
 try { body = await response.json(); }
 catch {
  if (signal.aborted) throw signal.reason;
  throw new ShellRequestError('INVALID_RESPONSE', response.status);
 }
 if (!response.ok) {
  const requestId = isRecord(body) && isRecord(body.error) && typeof body.error.requestId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(body.error.requestId) ? body.error.requestId : undefined;
  throw new ShellRequestError('HTTP_ERROR', response.status, requestId, isRecord(body) && typeof body.message === 'string' ? body.message.slice(0, 300) : undefined);
 }
 return parse(body);
}

/** One atomic directory read; its deadline includes all three complete response bodies. */
export async function readPlaygroundCatalog(controller: AbortController) {
 const timer = setTimeout(() => controller.abort(new ShellRequestError('REQUEST_TIMEOUT')), 20_000);
 try {
  const [routes, models, providers] = await Promise.all([
   request('/api/admin/routes', controller.signal, parseRoutes),
   request('/api/admin/models', controller.signal, parseModels),
   request('/api/admin/providers', controller.signal, parseProviders),
  ]);
  const modelIds = new Set(models.map(row => row.id)), providerIds = new Set(providers.map(row => row.id));
  if (routes.some(row => !modelIds.has(row.model_id) || !providerIds.has(row.provider_id)))
   throw new ShellRequestError('INVALID_RESPONSE');
  return { routes, models, providers };
 } catch (error) {
  const failure = controller.signal.aborted ? controller.signal.reason : error;
  controller.abort();
  throw failure;
 } finally { clearTimeout(timer); }
}
export type PlaygroundCatalog = Awaited<ReturnType<typeof readPlaygroundCatalog>>;

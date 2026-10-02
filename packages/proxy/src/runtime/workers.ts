import { createD1StorageContext, resolveWorkerDatabaseConfig, type StorageContext } from '@octafuse/core';
import type { Context } from 'hono';
import { createProxyApp, type Env } from '../app';
import { guardXsecFacade } from '../middleware/xsec-facade';

async function resolveWorkersStorage(context: Context<Env>): Promise<StorageContext> {
	const config = resolveWorkerDatabaseConfig(context.env);
	return createD1StorageContext(config.db);
}

export const workerApp = createProxyApp(resolveWorkersStorage, {
	beforeAll: async (c, next) => {
		const denied = await guardXsecFacade(c);
		if (denied) return denied;
		resolveWorkerDatabaseConfig(c.env);
		return next();
	},
});

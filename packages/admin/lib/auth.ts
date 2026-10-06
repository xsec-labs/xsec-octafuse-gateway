import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createAdminSessionsRepository } from '@octafuse/core/storage/admin-sessions';
import type { StorageContext } from '@octafuse/core/storage/context';
import { resolveAdminStorageContext } from '@/lib/storage-context';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24;

type Credentials = { username: string; password: string; cookieSecure: boolean };
export type AdminAuthContext = { storage: StorageContext; credentials: Credentials };

/** Node and Cloudflare resolve their own explicit runtime bindings. */
export async function resolveAdminAuthContext(): Promise<AdminAuthContext> {
	let username: string | undefined, password: string | undefined, secure: string | undefined;
	let storage: StorageContext;
	if (process.env.DATABASE_URL !== undefined) {
		username = process.env.ADMIN_USERNAME;
		password = process.env.ADMIN_PASSWORD;
		secure = process.env.ADMIN_COOKIE_SECURE;
		storage = await resolveAdminStorageContext(undefined, 'node');
	} else {
		const { env } = getCloudflareContext();
		username = env.ADMIN_USERNAME;
		password = env.ADMIN_PASSWORD;
		secure = env.ADMIN_COOKIE_SECURE;
		storage = await resolveAdminStorageContext({ DB: env.DB, ASSETS: env.ASSETS }, 'cloudflare');
	}
	if (!username || !password) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
	return { storage, credentials: { username, password, cookieSecure: resolveCookieSecure(secure) } };
}

export function resolveCookieSecure(value: string | undefined): boolean {
	if (value === undefined) return false;
	const raw = value.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
	if (['0', 'false', 'no', 'off'].includes(raw)) return false;
	throw new Error('ADMIN_COOKIE_SECURE must be an explicit boolean');
}

export function readSessionToken(request: Request): string | null {
	const values = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(ADMIN_SESSION_COOKIE + '='));
	if (values.length !== 1) return null;
	const value = values[0].slice(ADMIN_SESSION_COOKIE.length + 1);
	return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

async function hash(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** The raw random token also salts the credential fingerprint; neither secret is persisted. */
async function credentialHash(token: string, credentials: Credentials): Promise<string> {
	return hash(JSON.stringify([token, credentials.username, credentials.password]));
}

export async function credentialsMatch(username: string, password: string, configured: Credentials): Promise<boolean> {
	const [supplied, expected] = await Promise.all([hash(JSON.stringify([username, password])), hash(JSON.stringify([configured.username, configured.password]))]);
	let difference = 0;
	for (let index = 0; index < expected.length; index++) difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
	return difference === 0;
}

export async function createSession(context: AdminAuthContext): Promise<{ token: string; expiresAt: number }> {
	const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
	const now = Math.floor(Date.now() / 1000), expiresAt = now + ADMIN_SESSION_SECONDS;
	const sessions = createAdminSessionsRepository(context.storage.client);
	await sessions.deleteExpired(now);
	await sessions.insert({ tokenHash: await hash(token), credentialHash: await credentialHash(token, context.credentials), expiresAt });
	return { token, expiresAt };
}

export async function checkAuth(request: Request, context: AdminAuthContext): Promise<boolean> {
	const token = readSessionToken(request);
	if (token === null) return false;
	const session = await createAdminSessionsRepository(context.storage.client).find(await hash(token));
	if (session === null || session.expiresAt <= Math.floor(Date.now() / 1000)) return false;
	return session.credentialHash === await credentialHash(token, context.credentials);
}

export async function revokeSession(request: Request, context: AdminAuthContext): Promise<void> {
	const token = readSessionToken(request);
	if (token !== null) await createAdminSessionsRepository(context.storage.client).delete(await hash(token));
}

import type { GatewayDatabaseClient } from './database-client';

export interface AdminSessionRecord {
	tokenHash: string;
	credentialHash: string;
	expiresAt: number;
}

/** Dedicated session storage; only hashes and an absolute Unix expiry are persisted. */
export function createAdminSessionsRepository(client: GatewayDatabaseClient) {
	return {
		async insert(session: AdminSessionRecord): Promise<void> {
			const values = [session.tokenHash, session.credentialHash, session.expiresAt];
			if (client.driver === 'd1') {
				await client.raw.prepare('INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)').bind(...values).run();
			} else if (client.driver === 'postgres') {
				await client.raw`INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (${session.tokenHash}, ${session.credentialHash}, ${session.expiresAt})`;
			} else {
				await client.raw.execute('INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)', values);
			}
		},
		async find(tokenHash: string): Promise<AdminSessionRecord | null> {
			let rows: unknown;
			if (client.driver === 'd1') {
				const result = await client.raw.prepare('SELECT token_hash, credential_hash, expires_at FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).all();
				rows = result.results;
			} else if (client.driver === 'postgres') {
				rows = await client.raw`SELECT token_hash, credential_hash, expires_at FROM admin_sessions WHERE token_hash = ${tokenHash}`;
			} else {
				[rows] = await client.raw.execute('SELECT token_hash, credential_hash, expires_at FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
			}
			if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid admin session query result');
			if (rows.length === 0) return null;
			const row = rows[0];
			if (!row || typeof row !== 'object' || !('token_hash' in row) || !('credential_hash' in row) || !('expires_at' in row)) throw new Error('Invalid admin session row');
			const expiry = typeof row.expires_at === 'string' && /^\d+$/.test(row.expires_at) ? Number(row.expires_at) : row.expires_at;
			if (typeof row.token_hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.token_hash) || typeof row.credential_hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.credential_hash) || typeof expiry !== 'number' || !Number.isSafeInteger(expiry) || expiry < 0) throw new Error('Invalid persisted admin session');
			return { tokenHash: row.token_hash, credentialHash: row.credential_hash, expiresAt: expiry };
		},
		async delete(tokenHash: string): Promise<void> {
			if (client.driver === 'd1') {
				await client.raw.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
			} else if (client.driver === 'postgres') {
				await client.raw`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
			} else {
				await client.raw.execute('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
			}
		},
		async deleteExpired(now: number): Promise<void> {
			if (client.driver === 'd1') {
				await client.raw.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
			} else if (client.driver === 'postgres') {
				await client.raw`DELETE FROM admin_sessions WHERE expires_at <= ${now}`;
			} else {
				await client.raw.execute('DELETE FROM admin_sessions WHERE expires_at <= ?', [now]);
			}
		},
	};
}

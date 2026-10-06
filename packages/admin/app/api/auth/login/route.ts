import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, createSession, credentialsMatch, resolveAdminAuthContext } from '@/lib/auth';
import { handleGatewayApiError } from '@/lib/api-error';
import { POST as logout } from '../logout/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	let body: unknown;
	try { body = await request.json(); } catch {
		return Response.json({ success: false, message: 'Invalid JSON body', errorCode: 'INVALID_LOGIN_INPUT' }, { status: 400 });
	}
	if (!body || typeof body !== 'object' || !('username' in body) || !('password' in body) || typeof body.username !== 'string' || typeof body.password !== 'string' || !body.username || !body.password || body.username.length > 256 || body.password.length > 4096) {
		return Response.json({ success: false, message: 'Invalid login input', errorCode: 'INVALID_LOGIN_INPUT' }, { status: 400 });
	}
	try {
		const context = await resolveAdminAuthContext();
		if (!await credentialsMatch(body.username, body.password, context.credentials)) {
			return Response.json({ success: false, message: 'Invalid credentials', errorCode: 'INVALID_CREDENTIALS' }, { status: 401 });
		}
		const session = await createSession(context);
		const response = NextResponse.json({ success: true, message: 'Login successful' });
		response.cookies.set(ADMIN_SESSION_COOKIE, session.token, { httpOnly: true, secure: context.credentials.cookieSecure, sameSite: 'strict', expires: new Date(session.expiresAt * 1000), path: '/' });
		response.headers.set('Cache-Control', 'no-store');
		return response;
	} catch (error) { return handleGatewayApiError({ route: 'auth.login', error }); }
}

/** Retains the documented DELETE login endpoint with the same server revocation contract. */
export const DELETE = logout;

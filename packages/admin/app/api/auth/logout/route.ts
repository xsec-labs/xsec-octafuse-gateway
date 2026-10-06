import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, readSessionToken, resolveAdminAuthContext, revokeSession } from '@/lib/auth';
import { handleGatewayApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	try {
		if (readSessionToken(request) !== null) await revokeSession(request, await resolveAdminAuthContext());
		const response = NextResponse.json({ success: true, message: 'Logout successful' });
		response.cookies.set(ADMIN_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', maxAge: 0, path: '/' });
		response.headers.set('Cache-Control', 'no-store');
		return response;
	} catch (error) { return handleGatewayApiError({ route: 'auth.logout', error }); }
}

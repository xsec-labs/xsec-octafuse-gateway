import { checkAuth, readSessionToken, resolveAdminAuthContext } from '@/lib/auth';
import { handleGatewayApiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	try {
		const authenticated = readSessionToken(request) !== null && await checkAuth(request, await resolveAdminAuthContext());
		return Response.json({ authenticated }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) { return handleGatewayApiError({ route: 'auth.check', error }); }
}

import type { Context } from 'hono';
import type { Env } from '../app';
import { GatewayErrorCode } from '../services/gateway-error-codes';
import { gatewayErrorJson } from '../services/gateway-error-response';

const textEncoder = new TextEncoder();

async function secretsEqual(expected: string, supplied: string): Promise<boolean> {
	const [left, right] = await Promise.all([
		crypto.subtle.digest('SHA-256', textEncoder.encode(expected)),
		crypto.subtle.digest('SHA-256', textEncoder.encode(supplied)),
	]);
	const a = new Uint8Array(left);
	const b = new Uint8Array(right);
	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a[index]! ^ b[index]!;
	}
	return mismatch === 0;
}

/**
 * The proxy has no public capability in the xSec topology. Service Binding
 * routing is only a network control; this application guard remains required
 * so an accidentally-added route or workers.dev URL cannot bypass the facade.
 */
export async function guardXsecFacade(c: Context<Env>): Promise<Response | null> {
	const expected = c.env.XSEC_FACADE_KEY?.trim();
	const supplied = c.req.header('X-XSec-Facade-Key')?.trim();
	if (!expected || !supplied || !(await secretsEqual(expected, supplied))) {
		return gatewayErrorJson(c, {
			status: 401,
			code: GatewayErrorCode.authFailed,
			message: 'Private facade authentication required',
		});
	}
	if (c.req.header('X-XSec-Facade-Version') !== '1') {
		return gatewayErrorJson(c, {
			status: 400,
			code: GatewayErrorCode.invalidRequest,
			message: 'Unsupported facade protocol version',
		});
	}
	const userId = c.req.header('X-XSec-User-Id')?.trim();
	const requestId = c.req.header('X-XSec-Request-Id')?.trim();
	if (!userId || !/^[A-Za-z0-9._:-]{1,160}$/u.test(userId) || !requestId || !/^[A-Za-z0-9._:-]{8,128}$/u.test(requestId)) {
		return gatewayErrorJson(c, {
			status: 400,
			code: GatewayErrorCode.invalidRequest,
			message: 'Facade identity headers are invalid',
		});
	}
	return null;
}

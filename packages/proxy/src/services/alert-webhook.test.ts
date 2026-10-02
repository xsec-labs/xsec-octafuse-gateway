import { describe, expect, it } from 'vitest';
import {
	buildGatewayErrorAlertSummary,
	classifyGatewayErrorAlert,
	type GatewayErrorAlertContext,
} from './alert-webhook';

function baseCtx(overrides: Partial<GatewayErrorAlertContext> = {}): GatewayErrorAlertContext {
	return {
		requestLogId: '00000000-0000-4000-8000-000000000001',
		apiKeyId: '00000000-0000-4000-8000-000000000002',
		userEmail: 'user@example.test',
		modelId: 'gemini-3.1-pro-preview',
		modelName: 'Gemini 3.1 Pro Preview',
		providerId: '00000000-0000-4000-8000-000000000003',
		providerName: 'Google Vertex',
		providerModelName: 'gemini-3.1-pro-preview',
		routeGroup: 'default',
		requestProtocol: 'gemini',
		upstreamProtocol: 'gemini',
		errorMessage: 'HTTP 524: error code: 524',
		latencyMs: 125733,
		providerKeyId: '00000000-0000-4000-8000-000000000004',
		providerKeyLabel: 'test-key',
		providerKeyFingerprint: '...test',
		occurredAt: '2026-03-16T12:13:21.580Z',
		...overrides,
	};
}

describe('classifyGatewayErrorAlert', () => {
	it('classifies HTTP 524 as upstream_timeout', () => {
		const meta = classifyGatewayErrorAlert(baseCtx());
		expect(meta.category).toBe('upstream_timeout');
		expect(meta.label).toBe('上游超时');
		expect(meta.priority).toBe('P1');
	});

	it('classifies stream usage timeout as upstream_timeout', () => {
		const meta = classifyGatewayErrorAlert(
			baseCtx({ errorMessage: 'Stream usage timeout (no usage within limit)', latencyMs: 5000 })
		);
		expect(meta.category).toBe('upstream_timeout');
	});

	it('classifies long latency without explicit timeout as upstream_timeout', () => {
		const meta = classifyGatewayErrorAlert(
			baseCtx({ errorMessage: 'HTTP 502: bad gateway', latencyMs: 130_000 })
		);
		expect(meta.category).toBe('upstream_timeout');
	});

	it('classifies HTTP 401/403 as provider_auth', () => {
		expect(
			classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 401: invalid api key', latencyMs: 200 })).category
		).toBe('provider_auth');
		expect(
			classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 403: permission denied', latencyMs: 200 })).category
		).toBe('provider_auth');
	});

	it('classifies HTTP 429 as provider_rate_limit', () => {
		const meta = classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 429: rate limit exceeded', latencyMs: 200 }));
		expect(meta.category).toBe('provider_rate_limit');
	});

	it('classifies HTTP 5xx (non-524) as provider_server_error', () => {
		const meta = classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 503: service unavailable', latencyMs: 800 }));
		expect(meta.category).toBe('provider_server_error');
	});

	it('classifies HTTP 400 safety blocks as sensitive_content', () => {
		expect(
			classifyGatewayErrorAlert(
				baseCtx({
					errorMessage:
						'HTTP 400: System detected potentially unsafe or sensitive content in input or generation. Please avoid using prompts that may generate sensitive content. Thank you for your cooperation.',
					latencyMs: 200,
				})
			).category
		).toBe('sensitive_content');
		expect(
			classifyGatewayErrorAlert(
				baseCtx({
					errorMessage:
						'HTTP 400: <400> InternalError.Algo.DataInspectionFailed: Input text data may contain inappropriate content.',
					latencyMs: 200,
				})
			).category
		).toBe('sensitive_content');
		expect(
			classifyGatewayErrorAlert(
				baseCtx({
					errorMessage:
						'HTTP 400: 系统检测到输入或生成内容可能包含不安全或敏感内容，请您避免输入易产生敏感内容的提示词。',
					latencyMs: 200,
				})
			).category
		).toBe('sensitive_content');
	});

	it('classifies non-HTTP sensitive signals as sensitive_content', () => {
		expect(
			classifyGatewayErrorAlert(
				baseCtx({ errorMessage: 'Blocked by safety filter', latencyMs: 200 })
			).category
		).toBe('sensitive_content');
	});

	it('classifies HTTP 400/404/422 as client_or_model_error', () => {
		expect(
			classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 400: bad request', latencyMs: 100 })).category
		).toBe('client_or_model_error');
		expect(
			classifyGatewayErrorAlert(baseCtx({ errorMessage: 'HTTP 404: model not found', latencyMs: 100 })).category
		).toBe('client_or_model_error');
	});

	it('classifies route config messages as route_config_error', () => {
		const meta = classifyGatewayErrorAlert(
			baseCtx({ errorMessage: 'No routes configured', latencyMs: 10 })
		);
		expect(meta.category).toBe('route_config_error');
	});

	it('falls back to unknown_error', () => {
		const meta = classifyGatewayErrorAlert(baseCtx({ errorMessage: 'something unexpected', latencyMs: 50 }));
		expect(meta.category).toBe('unknown_error');
	});
});

describe('buildGatewayErrorAlertSummary', () => {
	it('includes structured sections and key identifiers', () => {
		const text = buildGatewayErrorAlertSummary(baseCtx());
		expect(text).toContain('[Gateway] - [上游超时] - [P1]');
		expect(text).toContain('模型: Gemini 3.1 Pro Preview');
		expect(text).toContain('摘要: HTTP 524');
		expect(text).toContain('125.7s');
		expect(text).toContain('user@example.test');
		expect(text).toContain('route=default');
		expect(text).toContain('gemini → gemini');
		expect(text).toContain('供应商: Google Vertex · gemini-3.1-pro-preview · test-key (...test) · ');
		expect(text).toContain('建议:');
		expect(text).not.toContain('定位:');
		expect(text).not.toContain('request_log_id=');
		expect(text).toContain('原始错误: HTTP 524: error code: 524');
		expect(text).toContain('发生时间: 2026/03/16 20:13:21 (UTC+8)');

		const originalIdx = text.indexOf('原始错误:');
		const suggestionIdx = text.indexOf('建议:');
		const occurredIdx = text.indexOf('发生时间:');
		expect(originalIdx).toBeLessThan(suggestionIdx);
		expect(suggestionIdx).toBeLessThan(occurredIdx);
	});

	it('falls back to modelId and providerId when display names missing', () => {
		const text = buildGatewayErrorAlertSummary(
			baseCtx({ modelName: null, providerName: null })
		);
		expect(text).toContain('[Gateway] - [上游超时] - [P1]');
		expect(text).toContain('模型: gemini-3.1-pro-preview');
		expect(text).toContain(
			'供应商: 00000000-0000-4000-8000-000000000003 · gemini-3.1-pro-preview · test-key (...test) · '
		);
	});

	it('formats client_or_model_error alert like production example', () => {
		const text = buildGatewayErrorAlertSummary(
			baseCtx({
				modelId: 'glm-5.2',
				modelName: 'GLM-5.2',
				userEmail: 'another-user@example.test',
				providerName: 'ZAI Coding Plan - Lite',
				providerModelName: 'glm-5.2',
				requestProtocol: 'openai',
				upstreamProtocol: 'openai',
				errorMessage:
					'HTTP 400: System detected potentially unsafe or sensitive content in input or generation. Please avoid using prompts that may generate sensitive content. Thank you for your cooperation.',
				latencyMs: 5600,
				providerKeyLabel: 'default',
				providerKeyFingerprint: '…kGxz',
			})
		);
		expect(text).toContain('[Gateway] - [敏感内容拦截] - [P3]');
		expect(text).toContain('模型: GLM-5.2');
		expect(text).toContain('摘要: HTTP 400，耗时 5.6s，上游内容安全策略拦截');
		expect(text).toContain('影响: another-user@example.test · route=default · openai → openai');
		expect(text).toContain('供应商: ZAI Coding Plan - Lite · glm-5.2 · default (…kGxz) · ');
	});

	it('includes circuit measures when circuit events are present', () => {
		const text = buildGatewayErrorAlertSummary(
			baseCtx({
				errorMessage: 'HTTP 429: rate limit exceeded',
				latencyMs: 200,
				circuitEvents: [
					{
						kind: 'provider',
						providerId: 'key-1',
					providerName: 'test-key',
					keyFingerprint: '...test',
						failureKind: 'rate_limit',
						openUntil: Date.parse('2026-03-16T12:35:00.000Z'),
						cooldownMs: 60_000,
						openedOrExtended: true,
					},
				],
			})
		);
		expect(text).toContain('熔断措施:');
		expect(text).toContain(
			'provider providerId=key-1 name=test-key fingerprint=...test reason=rate_limit'
		);
		expect(text).toContain('持续 60s');
		expect(text).toContain('恢复时间');
	});

	it('includes user_model circuit measures for sensitive content breaker', () => {
		const text = buildGatewayErrorAlertSummary(
			baseCtx({
				errorMessage: 'HTTP 400: sensitive content blocked',
				latencyMs: 200,
				circuitEvents: [
					{
						kind: 'user_model',
						userId: 'user-1',
						modelId: 'glm-5.2',
						reason: 'sensitive_content',
						openUntil: Date.parse('2026-03-16T12:35:00.000Z'),
						cooldownMs: 180_000,
					},
				],
			})
		);
		expect(text).toContain('user_model user=user-1 model=glm-5.2 reason=sensitive_content');
		expect(text).toContain('持续 180s');
	});
});

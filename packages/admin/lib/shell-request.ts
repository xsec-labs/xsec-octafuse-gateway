'use client';
import { useCallback, useEffect, useRef } from 'react';

export type ShellFailureCode = 'NETWORK_ERROR' | 'REQUEST_TIMEOUT' | 'INVALID_RESPONSE' | 'HTTP_ERROR';
export class ShellRequestError extends Error {
 constructor(public code: ShellFailureCode, public status?: number, public requestId?: string, public serverMessage?: string) { super(code); this.name = 'ShellRequestError'; }
}
export type ShellFailure = { code: ShellFailureCode; status?: number; requestId?: string; serverMessage?: string };
export function shellFailure(error: unknown): ShellFailure {
 if (error instanceof ShellRequestError) return { code: error.code, status: error.status, requestId: error.requestId, serverMessage: error.serverMessage };
 return { code: 'NETWORK_ERROR' };
}
export function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** One owner per shell operation; the deadline covers headers and the entire response body. */
export function useShellRequest() {
 const active = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
 const cancel = useCallback(() => { if (!active.current) return; clearTimeout(active.current.timer); active.current.controller.abort(); active.current = null; }, []);
 useEffect(() => cancel, [cancel]);
 const run = useCallback(async <T,>(path: string, init: RequestInit, parse: (body: unknown) => T, success: (value: T) => void, failure: (error: ShellFailure) => void) => {
  cancel();
  const controller = new AbortController();
  const operation = { controller, timer: setTimeout(() => controller.abort(new ShellRequestError('REQUEST_TIMEOUT')), 20_000) };
  active.current = operation;
  try {
   const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store' });
   let body: unknown;
   try { body = await response.json(); } catch { if (controller.signal.aborted) throw controller.signal.reason; throw new ShellRequestError('INVALID_RESPONSE', response.status); }
   if (!response.ok) {
    const requestId = isRecord(body) && isRecord(body.error) && typeof body.error.requestId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(body.error.requestId) ? body.error.requestId : undefined;
    const serverMessage = isRecord(body) && typeof body.message === 'string' ? body.message.slice(0, 300) : undefined;
    throw new ShellRequestError('HTTP_ERROR', response.status, requestId, serverMessage);
   }
   const value = parse(body);
   if (active.current === operation) success(value);
  } catch (error) { if (active.current === operation) failure(shellFailure(error)); }
  finally { clearTimeout(operation.timer); if (active.current === operation) active.current = null; }
 }, [cancel]);
 return { run, cancel };
}
export function parseShellSuccess(body: unknown): void { if (!isRecord(body) || body.success !== true) throw new ShellRequestError('INVALID_RESPONSE'); }

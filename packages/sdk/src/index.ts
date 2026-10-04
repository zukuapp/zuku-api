import { operations, legacyOperations, type OperationInputs, type OperationOutputs, type OperationId } from './generated.js';
import { assertJson, validateSchema, type SchemaIssue } from './validation.js';
export type { OperationInputs, OperationOutputs, OperationId, Content, User, Creator, ErrorResponse, TokenResponse, JsonValue } from './generated.js';
export { contractSha256 } from './generated.js';
export { validateSchema } from './validation.js';
export interface ZukuClientConfig {
 baseUrl?: string;
 token?: string;
 getToken?: () => string | undefined | Promise<string | undefined>;
 apiKey?: string;
 fetch?: typeof fetch;
 headers?: HeadersInit;
 timeoutMs?: number;
 maxResponseBytes?: number;
 /** Explicit same-origin browser auth. Native OAuth routes always omit cookies. */
 credentials?: 'omit' | 'same-origin';
 readRetries?: number;
 retryDelayMs?: number;
}
export interface RequestOptions {
 signal?: AbortSignal; headers?: HeadersInit; timeoutMs?: number;
 /** Caller-owned logical deployment key. SDK never generates or replaces it. */
 idempotencyKey?: string;
}
export type ErrorKind = 'http' | 'network' | 'timeout' | 'cancelled' | 'contract' | 'input' | 'unsupported';
export class ZukuApiError extends Error {
 readonly name = 'ZukuApiError';
 constructor(public readonly kind: ErrorKind, public readonly code: string, message: string,
  public readonly status?: number, public readonly requestId?: string,
  public readonly issues: readonly SchemaIssue[] = [], public readonly outcome: 'failed' | 'unknown' = 'failed',
  public readonly retryAfterMs?: number) { super(message); }
}
type Descriptor = { method: string; path: string; input: unknown; media: string | null; retry: string; nativeCredentialsOnly: boolean; suppressAuth: boolean; responses: Record<string, { mode: 'empty' | 'binary' | 'json'; schema: unknown }> };
type Compatibility = { aliasOf: OperationId | null; queryDefaults: Record<string, unknown>; reason: string };
export type OperationMethods = { [K in OperationId]: {} extends OperationInputs[K] ? (input?: OperationInputs[K], options?: RequestOptions) => Promise<OperationOutputs[K]> : (input: OperationInputs[K], options?: RequestOptions) => Promise<OperationOutputs[K]> };
const bounded = (v: number, min: number, max: number, name: string) => { if (!Number.isFinite(v) || v < min || v > max) throw new ZukuApiError('input', 'INVALID_CONFIG', `Invalid ${name}`); return v; };
const safeMeta = (v: unknown): string | undefined => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(v) ? v : undefined;
export class ZukuClient {
 readonly operations: OperationMethods;
 readonly baseUrl: string;
 #config: ZukuClientConfig; #fetch: typeof fetch; #timeout: number; #maxBytes: number; #retries: number; #delay: number;
 constructor(config: ZukuClientConfig = {}) {
  let url: URL;
  try { url = new URL(config.baseUrl ?? 'https://www.zuzunza.com/api/v1'); } catch { throw new ZukuApiError('input', 'INVALID_BASE_URL', 'Invalid API base URL'); }
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new ZukuApiError('input', 'INVALID_BASE_URL', 'API base must use HTTPS or loopback HTTP without credentials, query or fragment');
  if (config.credentials !== undefined && !['omit','same-origin'].includes(config.credentials)) throw new ZukuApiError('input','INVALID_CONFIG','Invalid browser credentials policy');
  if (config.fetch !== undefined && typeof config.fetch !== 'function') throw new ZukuApiError('input','INVALID_CONFIG','Invalid fetch implementation');
  this.baseUrl = url.href.replace(/\/$/, ''); this.#config = { ...config }; this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  this.#timeout = bounded(config.timeoutMs ?? 30_000, 1, 600_000, 'timeoutMs');
  this.#maxBytes = bounded(config.maxResponseBytes ?? 8 * 1024 * 1024, 1, 512 * 1024 * 1024, 'maxResponseBytes');
  this.#retries = bounded(config.readRetries ?? 1, 0, 3, 'readRetries');
  if (!Number.isInteger(this.#retries)) throw new ZukuApiError('input', 'INVALID_CONFIG', 'readRetries must be an integer');
  this.#delay = bounded(config.retryDelayMs ?? 100, 0, 5_000, 'retryDelayMs');
  const methods: Record<string, unknown> = {};
  for (const id of [...Object.keys(operations), ...Object.keys(legacyOperations)]) methods[id] = (input = {}, options = {}) => this.request(id as OperationId, input as never, options);
  this.operations = Object.freeze(methods) as OperationMethods;
 }
 async request<K extends OperationId>(operation: K, input: OperationInputs[K], options: RequestOptions = {}): Promise<OperationOutputs[K]> {
  const compatibility = legacyOperations[operation] as Compatibility | undefined;
  if (compatibility) {
   if (!compatibility.aliasOf) throw new ZukuApiError('unsupported', 'CONTRACT_UNSUPPORTED', compatibility.reason);
   const v = input as Record<string, unknown>;
   const mapped = Object.keys(compatibility.queryDefaults).length ? { ...v, query: { ...compatibility.queryDefaults, ...(v.query as object ?? {}) } } : v;
   return this.request(compatibility.aliasOf, mapped as never, options) as Promise<OperationOutputs[K]>;
  }
  const d = operations[operation] as Descriptor | undefined;
  if (!d) throw new ZukuApiError('unsupported', 'CONTRACT_UNSUPPORTED', 'Unknown operation');
  if (options.signal?.aborted) throw new ZukuApiError('cancelled', 'REQUEST_CANCELLED', 'Request cancelled');
  try { assertJson(input, true, true); } catch { throw new ZukuApiError('input', 'INVALID_REQUEST', 'Request must use plain data without accessors'); }
  const issues = validateSchema(d.input, input);
  if (issues.length) throw new ZukuApiError('input', 'INVALID_REQUEST', 'Request does not match the API contract', undefined, undefined, issues);
  if (options.idempotencyKey !== undefined && !/^[A-Za-z0-9_.:-]{8,128}$/.test(options.idempotencyKey)) throw new ZukuApiError('input', 'INVALID_IDEMPOTENCY_KEY', 'Invalid logical deployment key');
  const data = input as { path?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown; header?: Record<string, unknown> };
  if (Object.values(data.path ?? {}).some(v => v === '.' || v === '..')) throw new ZukuApiError('input', 'INVALID_PATH', 'Path identifiers cannot be dot segments');
  const path = d.path.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(data.path?.[key])));
  const url = new URL(this.baseUrl + path);
  for (const [key, v] of Object.entries(data.query ?? {})) { if (v === undefined || v === null) continue; if (Array.isArray(v)) for (const item of v) url.searchParams.append(key, String(item)); else url.searchParams.set(key, String(v)); }
  let headers: Headers;
  try { headers = new Headers(this.#config.headers); new Headers(options.headers).forEach((v, k) => headers.set(k, v)); for (const [k, v] of Object.entries(data.header ?? {})) headers.set(k, String(v)); } catch { throw new ZukuApiError('input', 'INVALID_HEADERS', 'Invalid request headers'); }
  if (headers.has('cookie') || headers.has('host') || headers.has('proxy-authorization')) throw new ZukuApiError('input', 'FORBIDDEN_HEADER', 'Credential routing headers are not accepted');
  const controller = new AbortController(); const timeout = bounded(options.timeoutMs ?? this.#timeout, 1, 600_000, 'timeoutMs'); let expired = false;
  const cancel = () => controller.abort(); options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { expired = true; controller.abort(); }, timeout);
  const raceAbort = async <T>(promise: Promise<T>): Promise<T> => {
   if (controller.signal.aborted) throw new Error('aborted');
   let listener: () => void;
   const abort = new Promise<never>((_, reject) => { listener = () => reject(new Error('aborted')); controller.signal.addEventListener('abort', listener, { once: true }); });
   try { return await Promise.race([promise, abort]); } finally { controller.signal.removeEventListener('abort', listener!); }
  };
  let submitted = false; const mutating = !['GET', 'HEAD'].includes(d.method);
  try {
   const token = d.suppressAuth ? undefined : this.#config.getToken ? await raceAbort(Promise.resolve().then(this.#config.getToken)) : this.#config.token;
   if (d.suppressAuth) { headers.delete('Authorization');headers.delete('X-API-Key'); } else { if (token) headers.set('Authorization', `Bearer ${token}`); if (this.#config.apiKey) headers.set('X-API-Key', this.#config.apiKey); }
   if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
   if (!headers.has('Accept')) headers.set('Accept', Object.values(d.responses).some(r => r.mode === 'binary') ? 'application/octet-stream' : 'application/json');
   let body: BodyInit | undefined;
   if (d.media === 'multipart/form-data') {
    const form = new FormData(); for (const [k, v] of Object.entries(data.body as Record<string, unknown>)) { if (v instanceof Blob) form.append(k, v); else if (v !== undefined) form.append(k, String(v)); }
    headers.delete('Content-Type'); body = form;
   } else if (data.body !== undefined) {
    try { assertJson(data.body); body = JSON.stringify(data.body); } catch { throw new ZukuApiError('input', 'INVALID_JSON', 'Request body must be a valid JSON value'); }
    headers.set('Content-Type', 'application/json');
   }
   const retries = !mutating && d.retry === 'safe-read' ? this.#retries : 0;
   for (let attempt = 0; ; attempt++) {
    let response: Response;
    try { submitted = true; response = await raceAbort(this.#fetch(url.href, { method: d.method, headers, body, signal: controller.signal, credentials: d.nativeCredentialsOnly ? 'omit' : (this.#config.credentials ?? 'omit'), redirect: 'error', cache: 'no-store' })); }
    catch (error) { if (controller.signal.aborted) throw error; if (attempt < retries) { await raceAbort(this.#wait(this.#delay * 2 ** attempt, controller.signal)); continue; } throw new ZukuApiError('network', 'NETWORK_ERROR', 'API request could not be completed', undefined, undefined, [], mutating ? 'unknown' : 'failed'); }
    if (response.redirected || response.status >= 300 && response.status < 400) throw new ZukuApiError('contract', 'REDIRECT_REFUSED', 'API redirects are refused', response.status, undefined, [], mutating ? 'unknown' : 'failed');
    const requestId = safeMeta(response.headers.get('X-Request-ID')) ?? safeMeta(response.headers.get('X-Zuku-Request-ID'));
    const retryAfter = this.#retryAfter(response.headers.get('Retry-After'));
    if ([408, 429, 502, 503, 504].includes(response.status) && attempt < retries) { await response.body?.cancel().catch(() => {}); await raceAbort(this.#wait(Math.min(retryAfter ?? this.#delay * 2 ** attempt, 5_000), controller.signal)); continue; }
    const contract = d.responses[String(response.status)];
    if (response.status === 204 && contract?.mode === 'empty') return undefined as OperationOutputs[K];
    const bytes = await raceAbort(this.#read(response, controller.signal));
    const responseType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    const json = responseType === 'application/json' || responseType?.endsWith('+json'); let parsed: unknown;
    if (json) { try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { /* normalized below */ } }
    if (!response.ok) {
     const value = parsed as { error?: { code?: unknown } | string; meta?: { request_id?: unknown } } | undefined;
     throw new ZukuApiError('http', typeof value?.error === 'string' && ['authorization_pending','slow_down','expired_token','access_denied','invalid_request','invalid_client','invalid_grant','invalid_scope','unsupported_grant_type','temporarily_unavailable'].includes(value.error) ? value.error : typeof value?.error === 'object' && typeof value.error.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.error.code) ? value.error.code : 'HTTP_ERROR', `ZUKU API returned HTTP ${response.status}`, response.status, requestId ?? safeMeta(value?.meta?.request_id), [], mutating && (response.status >= 500 || response.status === 408) ? 'unknown' : 'failed', retryAfter);
    }
    if (!contract) throw new ZukuApiError('contract', 'UNEXPECTED_STATUS', 'Response status does not match the API contract', response.status, requestId, [], mutating ? 'unknown' : 'failed');
    if (contract.mode === 'binary') { if (json || responseType === 'text/html') throw new ZukuApiError('contract', 'UNEXPECTED_CONTENT_TYPE', 'Expected game binary', response.status, requestId); return bytes as OperationOutputs[K]; }
    if (!json || parsed === undefined) throw new ZukuApiError('contract', 'INVALID_JSON_RESPONSE', 'Expected a valid JSON API response', response.status, requestId, [], mutating ? 'unknown' : 'failed');
    const responseIssues = validateSchema(contract.schema, parsed);
    if (responseIssues.length) throw new ZukuApiError('contract', 'INVALID_RESPONSE', 'Response does not match the API contract', response.status, requestId, responseIssues, mutating ? 'unknown' : 'failed');
    return parsed as OperationOutputs[K];
   }
  } catch (error) {
   if (controller.signal.aborted) throw new ZukuApiError(expired ? 'timeout' : 'cancelled', expired ? 'REQUEST_TIMEOUT' : 'REQUEST_CANCELLED', expired ? 'API request timed out' : 'Request cancelled', undefined, undefined, [], mutating && submitted ? 'unknown' : 'failed');
   if (error instanceof ZukuApiError) { if (mutating && submitted && error.kind === 'contract' && error.outcome !== 'unknown') throw new ZukuApiError(error.kind,error.code,error.message,error.status,error.requestId,error.issues,'unknown',error.retryAfterMs); throw error; }
   throw new ZukuApiError(submitted ? 'network' : 'input', submitted ? 'NETWORK_ERROR' : 'AUTH_CONFIGURATION_ERROR', submitted ? 'API request could not be completed' : 'Unable to configure API credentials', undefined, undefined, [], mutating && submitted ? 'unknown' : 'failed');
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
 }
 async #read(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  if (Number(response.headers.get('Content-Length')) > this.#maxBytes) { await response.body?.cancel(); throw new ZukuApiError('contract', 'RESPONSE_TOO_LARGE', 'API response exceeds the size limit'); }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(); const cancel = () => { void reader.cancel().catch(() => {}); }; signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { if (signal.aborted) throw new Error('aborted'); const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > this.#maxBytes) { await reader.cancel(); throw new ZukuApiError('contract', 'RESPONSE_TOO_LARGE', 'API response exceeds the size limit'); } chunks.push(value); }
   const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
 }
 async #wait(ms: number, signal: AbortSignal): Promise<void> {
  if (!ms) return;
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms); const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('aborted')); }; if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); });
 }
 #retryAfter(value: string | null): number | undefined { if (!value) return; if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, 86_400_000); const date = Date.parse(value); return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined; }
 getContentList(cursor?: string, options?: RequestOptions) { return this.operations.getFeeds({ query: cursor ? { cursor } : {} }, options); }
 getContent(id: string, options?: RequestOptions) { return this.operations.getContent({ path: { id } }, options); }
 getCurrentUser(options?: RequestOptions) { return this.operations.getCurrentUser({}, options); }
 /** users/{id} was never a server route. Public lookup requires a creator handle. */
 async getUser(_id: string): Promise<never> { throw new ZukuApiError('unsupported', 'CONTRACT_UNSUPPORTED', 'Use operations.getCreator with a creator handle'); }
}
export default ZukuClient;

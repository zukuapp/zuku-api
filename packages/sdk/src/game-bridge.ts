import { assertJson } from './validation.js';
import type { JsonValue } from './generated.js';
export type GameAction = 'context' | 'consent-revoke' | 'scores-list' | 'scores-submit' | 'save' | 'load' | 'room-create' | 'room-join' | 'room-sync' | 'room-leave' | 'room-start';
const actions = new Set<GameAction>(['context','consent-revoke','scores-list','scores-submit','save','load','room-create','room-join','room-sync','room-leave','room-start']);
export class ZukuGameBridgeError extends Error {
 readonly name = 'ZukuGameBridgeError';
 constructor(public readonly code: string, message: string, public readonly outcome: 'failed' | 'unknown' = 'failed') { super(message); }
}
export interface GameBridgeConfig {
 /** Host-provided session nonce. Not a bearer token. */
 session: string;
 /** Explicit embedding origin, e.g. https://www.zuzunza.com. Wildcards are refused. */
 parentOrigin: string;
 window?: Window;
 timeoutMs?: number;
 maxPending?: number;
}
interface Pending { resolve(value: JsonValue): void; reject(error: ZukuGameBridgeError): void; cleanup(): void; mutating: boolean }
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function containsCredential(value: unknown): boolean {
 if (Array.isArray(value)) return value.some(containsCredential);
 if (!isObject(value)) return false;
 return Object.entries(value).some(([key,item]) => /^(authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|bearer|cookie|password)$/i.test(key) || containsCredential(item));
}
/** Sandboxed games use only the existing ZUKU host bridge. No HTTP or account token API. */
export class ZukuGameBridge {
 #window: Window; #parent: Window; #origin: string; #session: string; #timeout: number; #limit: number;
 #pending = new Map<string, Pending>(); #sequence = 0; #instance: string; #closed = false; #epoch = 0;
 constructor(config: GameBridgeConfig) {
  const win = config.window ?? globalThis.window;
  if (!win || win.parent === win) throw new ZukuGameBridgeError('HOST_REQUIRED','A ZUKU game host is required');
  let origin: URL;
  try { origin = new URL(config.parentOrigin); } catch { throw new ZukuGameBridgeError('INVALID_ORIGIN','Invalid host origin'); }
  if (origin.origin !== config.parentOrigin || origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) || origin.username || origin.password) throw new ZukuGameBridgeError('INVALID_ORIGIN','Host origin must be HTTPS or local loopback');
  if (!/^[A-Za-z0-9_.:-]{8,256}$/.test(config.session)) throw new ZukuGameBridgeError('INVALID_SESSION','Invalid game session nonce');
  const random = win.crypto ?? globalThis.crypto;
  if (!random?.getRandomValues) throw new ZukuGameBridgeError('CRYPTO_REQUIRED','Secure request identifiers are unavailable');
  this.#instance = Array.from(random.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2,'0')).join('');
  this.#window=win;this.#parent=win.parent;this.#origin=origin.origin;this.#session=config.session;
  this.#timeout=config.timeoutMs??30_500;this.#limit=config.maxPending??3;
  if (!Number.isFinite(this.#timeout)||this.#timeout<1||this.#timeout>60_000||!Number.isInteger(this.#limit)||this.#limit<1||this.#limit>3) throw new ZukuGameBridgeError('INVALID_CONFIG','Invalid bridge limits');
  win.addEventListener('message',this.#message);
 }
 #message = (event: MessageEvent): void => {
  if (this.#closed||event.source!==this.#parent||event.origin!==this.#origin||!isObject(event.data))return;
  const msg=event.data;
  if(msg.version!==1||msg.session!==this.#session)return;
  if(msg.channel==='zuku-game-cloud-auth') { this.#epoch++;this.#rejectAll('ACCOUNT_CHANGED','Game account changed');return; }
  if(msg.channel!=='zuku-game-cloud'||typeof msg.id!=='string'||!this.#pending.has(msg.id))return;
  const pending=this.#pending.get(msg.id)!;this.#pending.delete(msg.id);pending.cleanup();
  if(msg.success===true) {
   try { assertJson(msg.data);if(containsCredential(msg.data))throw new Error();pending.resolve(msg.data as JsonValue); }
   catch { pending.reject(new ZukuGameBridgeError('INVALID_RESPONSE','Invalid game bridge response',pending.mutating?'unknown':'failed')); }
  } else {
   const code=isObject(msg.error)&&typeof msg.error.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(msg.error.code)?msg.error.code:'HOST_ERROR';
   pending.reject(new ZukuGameBridgeError(code,'ZUKU game host rejected the request'));
  }
 };
 request(action: GameAction,payload: Record<string,JsonValue>={},options: {signal?:AbortSignal}={}): Promise<JsonValue> {
  if(this.#closed)return Promise.reject(new ZukuGameBridgeError('BRIDGE_CLOSED','Game bridge is closed'));
  if(!actions.has(action))return Promise.reject(new ZukuGameBridgeError('ACTION_UNSUPPORTED','Unsupported game capability'));
  if(options.signal?.aborted)return Promise.reject(new ZukuGameBridgeError('REQUEST_CANCELLED','Game request cancelled'));
  try { assertJson(payload);if(!isObject(payload)||containsCredential(payload)||Object.keys(payload).some(k=>/^(projectId|userId|playerId|accountId)$/i.test(k))||new TextEncoder().encode(JSON.stringify(payload)).byteLength>16_384)throw new Error(); }
  catch {return Promise.reject(new ZukuGameBridgeError('INVALID_PAYLOAD','Invalid game capability payload'));}
  if(this.#pending.size>=this.#limit)return Promise.reject(new ZukuGameBridgeError('BRIDGE_BUSY','Game capability concurrency limit reached'));
  const id=`sdk:${this.#instance}:${this.#epoch}:${++this.#sequence}`;const mutating=!['context','scores-list','load'].includes(action);
  return new Promise((resolve,reject)=>{
   const fail=(code:string,message:string)=>{const p=this.#pending.get(id);if(!p)return;this.#pending.delete(id);p.cleanup();reject(new ZukuGameBridgeError(code,message,mutating?'unknown':'failed'));};
   const abort=()=>fail('REQUEST_CANCELLED','Game request cancelled');
   const timer=setTimeout(()=>fail('REQUEST_TIMEOUT','Game host did not respond'),this.#timeout);
   const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);};
   this.#pending.set(id,{resolve,reject,cleanup,mutating});options.signal?.addEventListener('abort',abort,{once:true});
   try {this.#parent.postMessage({channel:'zuku-game-cloud',version:1,session:this.#session,id,action,payload},this.#origin);}
   catch {fail('HOST_UNAVAILABLE','Unable to reach the game host');}
  });
 }
 #rejectAll(code:string,message:string): void { for(const p of this.#pending.values()){p.cleanup();p.reject(new ZukuGameBridgeError(code,message,p.mutating?'unknown':'failed'));}this.#pending.clear(); }
 close():void {if(this.#closed)return;this.#closed=true;this.#window.removeEventListener('message',this.#message);this.#rejectAll('BRIDGE_CLOSED','Game bridge is closed');}
}

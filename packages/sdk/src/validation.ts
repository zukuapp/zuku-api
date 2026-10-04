import { schemas } from './generated.js';
export interface SchemaIssue { path: string; rule: string }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const own = (v: object, k: string) => Object.prototype.hasOwnProperty.call(v, k);
/** CSP-safe, bounded JSON Schema validation. Diagnostics never copy payload values. */
export function validateSchema(schema: unknown, value: unknown): SchemaIssue[] {
 const issues: SchemaIssue[] = []; let visited = 0;
 const add = (path: string, rule: string) => { if (issues.length < 20) issues.push({ path, rule }); };
 function check(raw: unknown, input: unknown, path: string, depth: number): void {
  if (++visited > 100_000 || depth > 64) { add(path, 'validation-limit'); return; }
  if (raw === true || raw === undefined) return;
  if (raw === false) { add(path, 'forbidden'); return; }
  if (!record(raw)) { add(path, 'invalid-schema'); return; }
  const s = raw;
  if (typeof s.$ref === 'string') {
   const prefix = '#/components/schemas/';
   if (!s.$ref.startsWith(prefix) || !own(schemas, s.$ref.slice(prefix.length))) { add(path, 'unresolved-reference'); return; }
   check(schemas[s.$ref.slice(prefix.length)], input, path, depth + 1);
  }
  if (Array.isArray(s.allOf)) for (const sub of s.allOf) check(sub, input, path, depth + 1);
  for (const kind of ['anyOf', 'oneOf'] as const) {
   if (!Array.isArray(s[kind])) continue;
   let matched = 0;
   for (const sub of s[kind]) { const before = issues.length; check(sub, input, path, depth + 1); if (issues.length === before) matched++; issues.splice(before); }
   if (!matched || (kind === 'oneOf' && matched !== 1)) add(path, kind);
  }
  if (own(s, 'const') && input !== s.const) add(path, 'const');
  if (Array.isArray(s.enum) && !s.enum.includes(input)) add(path, 'enum');
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  if (s.format === 'binary') { if (typeof Blob === 'undefined' || !(input instanceof Blob)) add(path, 'binary'); return; }
  if (types.length && !types.some(t => t === 'null' ? input === null : t === 'object' ? record(input) : t === 'array' ? Array.isArray(input) : t === 'integer' ? typeof input === 'number' && Number.isSafeInteger(input) : t === 'number' ? typeof input === 'number' && Number.isFinite(input) : typeof input === t)) { add(path, 'type'); return; }
  if (typeof input === 'string') {
   const length = [...input].length;
   if (typeof s['x-zuku-min-utf8-bytes'] === 'number' && new TextEncoder().encode(input).byteLength < s['x-zuku-min-utf8-bytes']) add(path,'minUtf8Bytes');
   if (typeof s.minLength === 'number' && length < s.minLength) add(path, 'minLength');
   if (typeof s.maxLength === 'number' && length > s.maxLength) add(path, 'maxLength');
   if (typeof s.pattern === 'string' && !new RegExp(s.pattern, 'u').test(input)) add(path, 'pattern');
   if (s.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) add(path, 'email');
   if (s.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT/.test(input) || Number.isNaN(Date.parse(input)))) add(path, 'date-time');
   if (s.format === 'uri') { try { new URL(input); } catch { add(path, 'uri'); } }
  }
  if (typeof input === 'number') {
   if (!Number.isFinite(input)) add(path, 'finite');
   if (typeof s.minimum === 'number' && input < s.minimum) add(path, 'minimum');
   if (typeof s.maximum === 'number' && input > s.maximum) add(path, 'maximum');
  }
  if (Array.isArray(input)) {
   if (typeof s.minItems === 'number' && input.length < s.minItems) add(path, 'minItems');
   if (typeof s.maxItems === 'number' && input.length > s.maxItems) add(path, 'maxItems');
   for (let i = 0; i < input.length && visited <= 100_000; i++) check(s.items, input[i], `${path}[${i}]`, depth + 1);
  } else if (record(input)) {
   const properties = record(s.properties) ? s.properties : {};
   if (Array.isArray(s.required)) for (const key of s.required) if (typeof key === 'string' && !own(input, key)) add(`${path}.${key}`, 'required');
   for (const [key, item] of Object.entries(input)) {
    if (own(properties, key)) { if (item === undefined && !(Array.isArray(s.required) && s.required.includes(key))) continue; check(properties[key], item, `${path}.${key}`, depth + 1); }
    else if (s.additionalProperties === false) add(`${path}.*`, 'additionalProperties');
    else if (record(s.additionalProperties)) check(s.additionalProperties, item, `${path}.*`, depth + 1);
   }
  }
 }
 check(schema, value, '$', 0); return issues;
}
/** Reject silent JSON coercion, cycles, arbitrary prototypes and executable accessors. */
export function assertJson(value: unknown, allowBlob = false, allowUndefined = false): void {
 let visited = 0; const active = new Set<object>();
 function visit(v: unknown, depth: number): void {
  if (++visited > 100_000 || depth > 64) throw new TypeError('JSON validation limit');
  if (allowUndefined && v === undefined || allowBlob && typeof Blob !== 'undefined' && v instanceof Blob) return;
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v)) return;
  if (typeof v !== 'object' || v === null || active.has(v)) throw new TypeError('Invalid JSON value');
  if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new TypeError('JSON requires plain objects');
  active.add(v);
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
   if (Array.isArray(v) && key === 'length') continue;
   if (d.get || d.set) throw new TypeError('JSON accessors are not supported');
   visit(d.value, depth + 1);
  }
  if (Array.isArray(v)) for (let i = 0; i < v.length; i++) if (!own(v, String(i))) throw new TypeError('Sparse JSON arrays are not supported');
  active.delete(v);
 }
 visit(value, 0);
}

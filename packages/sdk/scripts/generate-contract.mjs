import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
const specPath=fileURLToPath(new URL('../../../spec/zuku-api-v1.yaml',import.meta.url));
const raw=readFileSync(specPath,'utf8');
const spec=YAML.parse(raw,{uniqueKeys:true});
const schemas=spec.components.schemas;
function validateRefs(value){
 if(!value||typeof value!=='object')return;
 if(value.$ref){const parts=value.$ref.split('/');if(parts[0]!=='#'||parts[1]!=='components'||!spec.components[parts[2]]?.[parts[3]])throw Error('Unresolved canonical reference');}
 for(const child of Object.values(value))validateRefs(child);
}
validateRefs(spec);
const quote=JSON.stringify;
const resolve=(s)=>s?.$ref ? spec.components[s.$ref.split('/')[2]][s.$ref.split('/')[3]] : s;
function type(s={}) {
 if(s.$ref)return s.$ref.split('/').at(-1);
 if('const' in s)return quote(s.const);
 if(s.enum)return s.enum.map(quote).join(' | ');
 if(s.oneOf||s.anyOf){const {oneOf,anyOf,...base}=s;const union='('+(oneOf||anyOf).map(type).join(' | ')+')';return base.type||base.properties||base.required ? '('+type(base)+' & '+union+')' : union;}
 if(s.allOf){const {allOf,...base}=s;return '('+[...(base.type||base.properties||base.required?[type(base)]:[]),...allOf.map(type)].join(' & ')+')';}
 if(Array.isArray(s.type))return '('+s.type.map(t=>type({...s,type:t})).join(' | ')+')';
 if(s.format==='binary')return 'Blob';
 if(s.type==='array')return `Array<${type(s.items)}>`;
 if(s.type==='object'||s.properties||s.required){
  const props=Object.entries(s.properties||{}).map(([k,v])=>`${quote(k)}${(s.required||[]).includes(k)?'':'?'}: ${type(v)}`);
  for(const key of s.required||[])if(!Object.hasOwn(s.properties||{},key))props.push(`${quote(key)}: unknown`);
  if(s.additionalProperties!==false)props.push('[key: string]: unknown');
  return '{ '+props.join('; ')+' }';
 }
 return ({string:'string',integer:'number',number:'number',boolean:'boolean',null:'null'})[s.type]||'JsonValue';
}
const registry={};const inputs={};const outputs={};const matrix=[];
for(const [path,item] of Object.entries(spec.paths))for(const [method,op] of Object.entries(item)){
 if(!op.operationId)continue;
 if(op['x-zuku-availability']!=='implemented')throw Error('Unsupported operation in supported paths');
 const id=op.operationId;
 const placeholders=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);
 const declared=(op.parameters||[]).map(resolve).filter(p=>p.in==='path').map(p=>p.name);
 if(placeholders.some(p=>!declared.includes(p))||declared.some(p=>!placeholders.includes(p)))throw Error('Path parameter mismatch');
 matrix.push({operationId:id,method:method.toUpperCase(),path,status:'implemented',retry:op['x-zuku-retry']||'never'});
 if(registry[id])throw Error('Duplicate operation identifier');
 const groups={};
 for(let param of [...(item.parameters||[]),...(op.parameters||[])]){
  param=resolve(param);const group=groups[param.in]||={type:'object',properties:{},required:[],additionalProperties:false};
  group.properties[param.name]=param.schema;if(param.required)group.required.push(param.name);
 }
 const content=op.requestBody?.content||{};const media=Object.keys(content)[0];
 const body=media?content[media].schema:undefined;
 const responses={};const outputTypes=[];
 for(const [status,rawResponse] of Object.entries(op.responses)){
  if(!/^2\d\d$/.test(status))continue;
  const r=resolve(rawResponse);const content=r.content||{};
  const responseMedia=Object.keys(content)[0];const schema=responseMedia?content[responseMedia].schema:null;
  const mode=+status===204?'empty':responseMedia==='application/octet-stream'?'binary':'json';
  responses[status]={mode,schema};outputTypes.push(mode==='empty'?'void':mode==='binary'?'Uint8Array':type(schema));
 }
 if(!outputTypes.length)throw Error('Operation has no successful response');
 const input={type:'object',properties:{},required:[],additionalProperties:false};
 for(const [group,schema] of Object.entries(groups)){
  input.properties[group]=schema;if(schema.required.length)input.required.push(group);
 }
 if(body){input.properties.body=body;if(op.requestBody.required)input.required.push('body');}
 registry[id]={method:method.toUpperCase(),path,input,responses,media:media||null,retry:op['x-zuku-retry']||'never',nativeCredentialsOnly:!!op['x-zuku-native-credentials-only'],suppressAuth:!!op['x-zuku-suppress-auth']};
 inputs[id]=type(input);outputs[id]=[...new Set(outputTypes)].join(' | ');
}
const legacy={};
for(const item of spec['x-zuku-legacy-operations']||[]){
 const {operationId,aliasOf,queryDefaults,reason}=item;
 if(registry[operationId])throw Error('Legacy identifier collision');
 matrix.push({operationId,method:item.method,path:item.path,status:aliasOf?'alias':'unsupported',aliasOf:aliasOf||null,reason});
 legacy[operationId]={aliasOf:aliasOf||null,queryDefaults:queryDefaults||{},reason};
 if(aliasOf){if(!registry[aliasOf])throw Error('Unknown legacy target');inputs[operationId]=inputs[aliasOf];outputs[operationId]=outputs[aliasOf];}
 else {inputs[operationId]='Record<string, unknown>';outputs[operationId]='never';}
}
const hash=createHash('sha256').update(raw).digest('hex');
const lines=['// Generated from spec/zuku-api-v1.yaml. Run npm run generate; do not edit.',`export const contractSha256 = ${quote(hash)};`,'export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };'];
for(const [name,schema] of Object.entries(schemas))if(name!=='JsonValue')lines.push(`export type ${name} = ${type(schema)};`);
lines.push('export interface OperationInputs {',...Object.entries(inputs).map(([id,t])=>`  ${id}: ${t};`),'}','export interface OperationOutputs {',...Object.entries(outputs).map(([id,t])=>`  ${id}: ${t};`),'}','export type OperationId = keyof OperationInputs;',`export const schemas: Record<string, unknown> = ${JSON.stringify(schemas)};`,`export const operations: Record<string, unknown> = ${JSON.stringify(registry)};`,`export const legacyOperations: Record<string, unknown> = ${JSON.stringify(legacy)};`,'');
const output=lines.join('\n');const target=fileURLToPath(new URL('../src/generated.ts',import.meta.url));
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==output){process.stderr.write('Generated contract drift. Run npm run generate.\n');process.exitCode=1;}}
else writeFileSync(target,output);
const matrixTarget=fileURLToPath(new URL('../../../spec/operation-matrix.json',import.meta.url));
const matrixOutput=JSON.stringify({contractSha256:hash,operations:matrix},null,2)+'\n';
if(process.argv.includes('--check')){if(readFileSync(matrixTarget,'utf8')!==matrixOutput){process.stderr.write('Operation matrix drift. Run npm run generate.\n');process.exitCode=1;}}
else writeFileSync(matrixTarget,matrixOutput);
process.stdout.write(`Contract: ${Object.keys(registry).length} server operations, ${Object.keys(legacy).length} compatibility operations, SHA ${hash}\n`);

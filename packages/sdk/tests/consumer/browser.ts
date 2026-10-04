import {ZukuClient,ZukuApiError,contractSha256} from '@zuku/sdk';
import {ZukuGameBridge} from '@zuku/sdk/game-bridge';
const results:Record<string,boolean>={};
const assert=(name:string,value:unknown)=>{if(!value)throw new Error(name);results[name]=true;};
async function run(){
 const client=new ZukuClient({baseUrl:location.origin+'/api/v1',readRetries:0});
 const keys=await client.operations.listApiKeys();assert('installed package browser ESM',keys.success&&keys.data.api_keys.length===0);
 const binary=await client.operations.getGamePackage({path:{id:'fixture'}});assert('actual HTTP binary',binary instanceof Uint8Array&&binary[0]===80);
 assert('actual HTTP 204',await client.operations.deleteComment({path:{id:'fixture'}})===undefined);
 try{await client.operations.unlikeContent({});throw new Error('unsupported');}catch(e){assert('typed explicit unavailable',e instanceof ZukuApiError&&e.code==='CONTRACT_UNSUPPORTED');}
 try{await new ZukuClient({baseUrl:location.origin+'/redirect',readRetries:0}).getCurrentUser();throw new Error('redirect');}catch(e){assert('browser redirect refuses forwarding',e instanceof ZukuApiError&&e.code==='NETWORK_ERROR');}
 const slow=new ZukuClient({baseUrl:location.origin+'/slow',timeoutMs:30,readRetries:0});try{await slow.getCurrentUser();throw new Error('timeout');}catch(e){assert('browser timeout',e instanceof ZukuApiError&&e.code==='REQUEST_TIMEOUT');}
 const sent:any[]=[];const originalFetch=globalThis.fetch;const injected=new ZukuClient({credentials:'same-origin',fetch:async(url,init)=>{sent.push(init);return originalFetch(url,init);},baseUrl:location.origin+'/api/v1'});await injected.operations.getDeployQuota();assert('native OAuth forces omit',sent[0].credentials==='omit');
 assert('separate credential-free bridge export',typeof ZukuGameBridge==='function');
 const frame=document.createElement('iframe');frame.sandbox.add('allow-scripts');frame.src='/game.html';
 const actualBridge=await new Promise<boolean>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('bridge timeout')),3000);
  const message=(event:MessageEvent)=>{
   if(event.source!==frame.contentWindow||event.origin!=='null')return;
   if(event.data?.channel==='zuku-game-cloud'){
    assert('opaque game real host protocol',event.data.version===1&&event.data.session==='fixture-session-nonce'&&event.data.action==='context');
    frame.contentWindow!.postMessage({...event.data,success:true,data:{player:{signedIn:false},consent:false}},'*');
   }
   if(event.data?.channel==='fixture-done'){clearTimeout(timer);window.removeEventListener('message',message);resolve(event.data.ok===true);}
  };
  window.addEventListener('message',message);document.body.append(frame);
 });
 assert('sandboxed iframe real bridge roundtrip',actualBridge);frame.remove();
 const destination=await fetch('/fixture-state').then(r=>r.json());assert('redirect destination not requested',destination.redirectHits===0);
 (globalThis as any).__proof={pass:true,checks:results,contractSha256,network:'loopback fixtures only'};
 document.querySelector('output')!.textContent='PASS';
}
run().catch(e=>{(globalThis as any).__proof={pass:false,error:String(e),checks:results};document.querySelector('output')!.textContent='FAIL';});

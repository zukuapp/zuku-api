import {ZukuGameBridge} from '@zuku/sdk/game-bridge';
const bridge=new ZukuGameBridge({session:'fixture-session-nonce',parentOrigin:new URL(document.referrer).origin,timeoutMs:1500});
bridge.request('context').then(data=>{window.parent.postMessage({channel:'fixture-done',ok:typeof data==='object'&&data!==null&&!('access_token' in data)},new URL(document.referrer).origin);bridge.close();}).catch(()=>window.parent.postMessage({channel:'fixture-done',ok:false},new URL(document.referrer).origin));

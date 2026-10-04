import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZukuClient} from '../dist/index.js';
const ok=data=>({success:true,data,meta:{version:'v1'}});
const user={id:'usr_1',email:'fixture@example.test',handle:'tester',created_at:'2026-10-04T00:00:00Z',profile_completion_status:'complete'};
const tokens={access_token:'fixture-access',refresh_token:'fixture-refresh',token_type:'Bearer',expires_in:3600};
const pagination={page:1,per_page:20,total:0,total_pages:1,has_next:false,has_prev:false,next_cursor:null,prev_cursor:null};
const projectId='00000000-0000-0000-0000-000000000001';
// Independent route/shape table transcribed from actual public protocol, not the generated registry.
const cases=[
 ['registerUser','POST','/auth/register',{body:{email:user.email,password:'fixture-password',password_confirm:'fixture-password',handle:'tester',zcaptcha_token:'fixture-captcha'}},{user,tokens},201],
 ['loginUser','POST','/auth/login',{body:{identifier:'tester',password:'fixture-password',zcaptcha_token:'fixture-captcha'}},{user,tokens}],
 ['refreshToken','POST','/auth/refresh',{body:{refresh_token:'fixture-refresh'}},{tokens}],
 ['verifyTotpLogin','POST','/auth/totp/verify',{body:{challenge_token:'fixture-challenge',code:'123456'}},{user,tokens}],
 ['createCaptchaChallenge','POST','/captcha/challenge',{}, {algorithm:'SHA-256',challenge:'fixture',salt:'fixture',signature:'fixture',maxnumber:100000}],
 ['verifyCaptchaToken','POST','/captcha/verify',{body:{token:'fixture-captcha'}},{success:true}],
 ['getCreator','GET','/creators/tester',{path:{handle:'tester'}},{creator:{id:'usr_1',handle:'tester',display_name:'Tester'}}],
 ['getCreatorContents','GET','/creators/tester/contents',{path:{handle:'tester'},query:{page:1}},{feeds:[],pagination}],
 ['getCreatorFollowers','GET','/creators/tester/followers',{path:{handle:'tester'}},{users:[],pagination}],
 ['followCreator','POST','/creators/tester/follow',{path:{handle:'tester'}},{is_following:true,follower_count:1}],
 ['likeContent','POST','/contents/cnt_fixture/like',{path:{id:'cnt_fixture'}},{is_liked:true,like_count:1}],
 ['bookmarkContent','POST','/contents/cnt_fixture/bookmark',{path:{id:'cnt_fixture'}},{is_bookmarked:true,bookmark_count:1}],
 ['getContentComments','GET','/contents/cnt_fixture/comments',{path:{id:'cnt_fixture'}},{comments:[],pagination}],
 ['createComment','POST','/contents/cnt_fixture/comments',{path:{id:'cnt_fixture'},body:{body:'Hello'}},{comment:{id:'comment_fixture',body:'Hello',created_at:'2026-10-04T00:00:00Z'}},201],
 ['getJumpGames','GET','/jump/games',{}, {games:[],pagination}],
 ['playJumpGame','POST','/jump/games/cnt_fixture/play',{path:{id:'cnt_fixture'},body:{content_id:'cnt_fixture'}},{ok:true,sandbox:{boundary:'OS-unprivileged; syscall_filter(proprietary)',memory_cap_mb:512,pids_max:512}}],
 ['listApiKeys','GET','/developer/keys',{}, {api_keys:[]}],
 ['createApiKey','POST','/developer/keys',{body:{name:'Test',rate_limit_per_min:600}},{api_key:{id:'key_fixture'},key:'fixture-key-once'},201],
 ['listCloudProjects','GET','/cloud/projects',{}, {projects:[]}],
 ['createCloudProject','POST','/cloud/projects',{body:{name:'Game'}},{project_id:projectId},201],
 ['getCloudBalance','GET','/cloud/economy/balance',{query:{projectId}},{POINT:100,CASH_KRW:0}],
 ['getCloudVariable','POST','/cloud/vars/get',{body:{projectId,scope:'user',key:'score'}},{key:'score',scope:'user',valueNum:0,valueText:null,version:1}],
 ['mutateCloudVariable','POST','/cloud/vars/mutate',{body:{projectId,scope:'user',key:'score',op:'incr',num:1}},{ok:true,conflict:false,key:'score',valueNum:1,version:2}],
 ['saveCloudSlot','POST','/cloud/saves/save',{body:{projectId,slot:'main',data:{level:3}}},{slot:'main',version:1,byteSize:11,updatedAt:'2026-10-04T00:00:00Z'}],
 ['loadCloudSlot','POST','/cloud/saves/load',{body:{projectId,slot:'main'}},{slot:'main',version:1,byteSize:11,updatedAt:'2026-10-04T00:00:00Z',data:{level:3}}],
 ['listCloudSlots','GET','/cloud/saves/list',{query:{projectId}},{slots:[]}],
 ['listCloudProducts','GET','/cloud/pay/products',{query:{projectId}},{products:[]}],
 ['upsertCloudProduct','POST','/cloud/pay/products',{body:{projectId,sku:'coins',name:'Coins',priceKrw:100}},{id:'product-fixture',sku:'coins',name:'Coins',priceKrw:100,kind:'consumable',fulfillment:{},status:'draft',pointGrantEnabled:false}],
 ['createCloudPaymentSession','POST','/cloud/pay/session',{body:{projectId,productId:'product-fixture',idempotencyKey:'fixture-pay-01'}},{id:'session-fixture',projectId,productId:'product-fixture',amountKrw:100,grantPoints:false,status:'pending',expiresAt:'2026-10-04T00:10:00Z'},201],
 ['confirmCloudPayment','POST','/cloud/pay/confirm',{body:{sessionId:'session-fixture'}},{sessionId:'session-fixture',status:'paid',productId:'product-fixture',amountKrw:100,pointsGranted:false}],
 ['listCloudEntitlements','GET','/cloud/pay/entitlements',{query:{projectId}},{entitlements:[]}],
 ['listCloudFunctions','GET','/cloud/functions',{query:{projectId}},{functions:[]}],
 ['upsertCloudFunction','POST','/cloud/functions',{body:{projectId,name:'score',sourceCode:'export default (input) => input;'}},{id:'function-fixture',name:'score',version:1,status:'draft'}],
 ['publishCloudFunction','POST','/cloud/functions/function-fixture/publish',{path:{id:'function-fixture'},body:{projectId}},{id:'function-fixture',version:1,status:'published',scanScore:0}],
 ['invokeCloudFunction','POST','/cloud/functions/function-fixture/invoke',{path:{id:'function-fixture'},body:{projectId,input:{score:10}}},{result:{score:10},usage:{cpuMs:1,memoryMbMs:1,wallMs:1}}],
 ['createCloudVm','POST','/cloud/vm',{body:{projectId,idempotencyKey:'fixture-vm-01'}},{allocation:{id:'vm-fixture'}},201],
 ['startCloudVm','POST','/cloud/vm/start',{body:{projectId,idempotencyKey:'fixture-vm-start-01'}},{status:'running'}],
 ['setCloudSpendLimit','POST','/cloud/billing/limit',{body:{projectId,spendLimitKrw:1000}},{spend_limit_krw:1000}],
 ['revokeSession','DELETE','/auth/sessions/1',{path:{id:'1'}},null,204],
 ['revokeApiKey','DELETE','/developer/keys/key_fixture',{path:{id:'key_fixture'}},null,204],
];
for(const [id,method,path,input,data,status=200] of cases)test(`${id} uses observed method/path and wire payload`,async()=>{
 let seen;const c=new ZukuClient({fetch:async(url,init)=>{seen={url:new URL(url),init};return status===204?new Response(null,{status}):new Response(JSON.stringify(ok(data)),{status,headers:{'Content-Type':'application/json'}});}});
 const result=await c.operations[id](input);assert.equal(seen.url.pathname,'/api/v1'+path);assert.equal(seen.init.method,method);if(input.body)assert.deepEqual(JSON.parse(seen.init.body),input.body);if(input.query)for(const [key,value] of Object.entries(input.query))assert.equal(seen.url.searchParams.get(key),String(value));assert.deepEqual(result,status===204?undefined:ok(data));
});
test('login TOTP challenge is a valid alternative and exposes no imaginary tokens',async()=>{const data={requires_totp:true,challenge_token:'fixture-challenge',expires_in:300};const c=new ZukuClient({fetch:async()=>new Response(JSON.stringify(ok(data)),{headers:{'Content-Type':'application/json'}})});assert.deepEqual((await c.operations.loginUser({body:{identifier:'tester',password:'fixture-password',zcaptcha_token:'fixture-captcha'}})).data,data);});
test('payment SDK keeps exact logical body key, rejects transport loss once, and never pays live',async()=>{let calls=0,body;const c=new ZukuClient({readRetries:3,fetch:async(_,init)=>{calls++;body=JSON.parse(init.body);throw new Error('connection lost');}});await assert.rejects(c.operations.createCloudPaymentSession({body:{projectId,productId:'product-fixture',idempotencyKey:'fixture-payment-key'}}),e=>e.outcome==='unknown');assert.equal(calls,1);assert.equal(body.idempotencyKey,'fixture-payment-key');});
test('native CLI publish sends exactly YOLO intent and same logical deployment key',async()=>{let body,key;const c=new ZukuClient({fetch:async(_,init)=>{body=JSON.parse(init.body);key=init.headers.get('Idempotency-Key');return new Response(JSON.stringify(ok({content:{id:'cnt_fixture',category:'jump',type:'html5',title:'Game',creator:{id:'usr_1',handle:'tester',display_name:'Tester',avatar_url:'',is_verified:false},stats:{like_count:0,comment_count:0,view_count:0,share_count:0,bookmark_count:0},created_at:'2026-10-04',updated_at:'2026-10-04'}})),{headers:{'Content-Type':'application/json'}});}});await c.operations.publishContent({path:{id:'cnt_fixture'},body:{mode:'yolo'}},{idempotencyKey:'fixture-yolo-key'});assert.deepEqual(body,{mode:'yolo'});assert.equal(key,'fixture-yolo-key');});
test('Game OAuth device/token raw response is validated and omits unrelated credentials',async()=>{let seen,calls=0;const c=new ZukuClient({token:'fixture-unrelated',apiKey:'fixture-unrelated-key',credentials:'same-origin',getToken:()=>{calls++;return 'fixture-unrelated';},fetch:async(url,init)=>{seen=init;return new Response(JSON.stringify(url.endsWith('/authorization')?{device_code:'fixture-device',user_code:'ABCD-EFGH-IJKL',verification_uri:'https://www.zuzunza.com/oauth/device',verification_uri_complete:'https://www.zuzunza.com/oauth/device?user_code=ABCD',expires_in:600,interval:5}:{access_token:'fixture-game-access',refresh_token:'fixture-game-refresh',token_type:'Bearer',expires_in:900,scope:'games:upload games:create games:publish'}),{headers:{'Content-Type':'application/json'}});}});const auth=await c.operations.createGameDeviceAuthorization({body:{client_id:'zuku-cli',scope:'games:upload games:create games:publish'}});assert.equal(auth.interval,5);const token=await c.operations.exchangeGameOAuthToken({body:{client_id:'zuku-cli',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:'fixture-device'}});assert.equal(token.expires_in,900);assert.equal(seen.credentials,'omit');assert.equal(seen.headers.has('Authorization'),false);assert.equal(seen.headers.has('X-API-Key'),false);assert.equal(calls,0);});
test('OAuth authorization_pending/slow_down are explicit typed codes, not network retry',async()=>{for(const code of ['authorization_pending','slow_down']){let calls=0;const c=new ZukuClient({readRetries:3,fetch:async()=>{calls++;return new Response(JSON.stringify({error:code}),{status:400,headers:{'Content-Type':'application/json'}});}});await assert.rejects(c.operations.exchangeGameOAuthToken({body:{client_id:'zuku-cli',grant_type:'refresh_token',refresh_token:'fixture-refresh'}}),e=>e.code===code&&e.kind==='http');assert.equal(calls,1);}});
test('logout follows actual 204 response rather than an imaginary success JSON',async()=>{const c=new ZukuClient({fetch:async()=>new Response(null,{status:204})});assert.equal(await c.operations.logoutUser(),undefined);});

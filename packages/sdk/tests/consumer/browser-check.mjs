import {createServer} from 'node:http';import {once} from 'node:events';import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.ZUKU_TEST_PLAYWRIGHT_MODULE || 'playwright');
let redirectHits=0;const server=createServer((req,res)=>{
 const headers={'Content-Security-Policy':"default-src 'none'; script-src 'self'; connect-src 'self'; frame-src 'self'; style-src 'none'; object-src 'none'; base-uri 'none'",'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
 if(req.url==='/browser.js'||req.url==='/game.js'){res.writeHead(200,{...headers,'Content-Type':'text/javascript'});res.end(readFileSync('.'+req.url));}
 else if(req.url==='/game.html'){res.writeHead(200,{...headers,'Content-Type':'text/html'});res.end('<script type="module" src="/game.js"></script>');}
 else if(req.url==='/'){res.writeHead(200,{...headers,'Content-Type':'text/html'});res.end('<!doctype html><title>Packed SDK</title><output>Running</output><script type="module" src="/browser.js"></script>');}
 else if(req.url==='/redirect/auth/me'){res.writeHead(307,{Location:'/redirect-target'});res.end();}
 else if(req.url==='/redirect-target'){redirectHits++;res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');}
 else if(req.url==='/slow/auth/me'){}
 else if(req.url==='/fixture-state'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({redirectHits}));}
 else if(req.url==='/api/v1/jump/games/fixture/package'){res.writeHead(200,{'Content-Type':'application/zip'});res.end(Buffer.from([80,75,3,4]));}
 else if(req.url==='/api/v1/comments/fixture'&&req.method==='DELETE'){res.writeHead(204);res.end();}
 else if(req.url==='/api/v1/developer/keys'||req.url==='/api/v1/oauth/deploy-quota'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data:req.url.includes('keys')?{api_keys:[]}:{limit:3,window_seconds:21600,used:0,pending:0,remaining:3,reset_at:null,retry_after:0},meta:{version:'v1'}}));}
 else if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}
 else{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
let browser;try{
 browser=await chromium.launch({executablePath:process.env.ZUKU_TEST_BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});const context=await browser.newContext();const page=await context.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.__proof,{timeout:10000});const proof=await page.evaluate(()=>globalThis.__proof);proof.pageErrors=errors;proof.externalRequests=external;proof.userAgent=await page.evaluate(()=>navigator.userAgent);writeFileSync('BROWSER-PROOF.json',JSON.stringify(proof,null,2)+'\n');assert.equal(proof.pass,true);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({pass:proof.pass,checks:Object.keys(proof.checks).length,pageErrors:errors.length,externalRequests:external.length}));await context.close();
}finally{await browser?.close();server.closeAllConnections();server.close();}

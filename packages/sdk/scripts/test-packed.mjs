import {mkdtempSync,writeFileSync,readFileSync,readdirSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));const temp=mkdtempSync(join(tmpdir(),'zuku-sdk-consumer-'));const consumer=join(temp,'consumer');
const run=(command,args,cwd,env=process.env)=>{const result=spawnSync(command,args,{cwd,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});if(result.status!==0)throw new Error(`Consumer check failed (${command}, exit ${result.status}): ${result.stderr||result.stdout}`);return result.stdout;};
try{
 run('npm',['pack','--json','--pack-destination',temp],root);
 const archive=join(temp,readdirSync(temp).find(name=>name.endsWith('.tgz')));cpSync(join(root,'tests','consumer'),consumer,{recursive:true});
 writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'zuku-independent-sdk-consumer',private:true,type:'module'}));
 run('npm',['install','--ignore-scripts','--no-audit','--no-fund',archive],consumer);
 writeFileSync(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,lib:['ES2020','DOM']},include:['consumer.ts']}));
 run(process.execPath,[join(root,'node_modules','typescript','bin','tsc'),'-p','tsconfig.json'],consumer);
 const env={...process.env,ZUKU_TEST_PACKED_ARTIFACT:archive};const node=JSON.parse(run(process.execPath,['node-test.mjs'],consumer,env).trim());
 let browser={status:'skipped',reason:'Set ZUKU_TEST_PLAYWRIGHT_MODULE, ZUKU_TEST_BROWSER_EXECUTABLE and ZUKU_TEST_BUN for actual browser checks.'};
 if(process.env.ZUKU_TEST_PLAYWRIGHT_MODULE&&process.env.ZUKU_TEST_BROWSER_EXECUTABLE&&process.env.ZUKU_TEST_BUN){
  for(const entry of ['browser','game'])run(process.env.ZUKU_TEST_BUN,['build',entry+'.ts','--target','browser','--outfile',entry+'.js'],consumer);
  run(process.execPath,['browser-check.mjs'],consumer,env);browser=JSON.parse(readFileSync(join(consumer,'BROWSER-PROOF.json'),'utf8'));
 }
 const proof={node,browser,tarballSha256:createHash('sha256').update(readFileSync(archive)).digest('hex'),typecheck:'pass',installation:'fresh tarball consumer; no workspace source import'};
 if(process.env.ZUKU_TEST_PROOF_PATH)writeFileSync(process.env.ZUKU_TEST_PROOF_PATH,JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({pass:true,typecheck:true,node:node.pass,browser:browser.pass??browser.status,artifactSha256:proof.tarballSha256}));
}finally{rmSync(temp,{recursive:true,force:true});}

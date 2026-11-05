'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
process.env.ARCHIVE_SESSION_SECRET='test-only-secret';process.env.ARCHIVE_ADMIN_PASSWORD_SHA256=crypto.createHash('sha256').update('test-password').digest('hex');process.env.ARCHIVE_SUBMISSIONS_BUCKET='private-work-bucket';
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});process.env.SEMINAR_COMMENTS_CREDENTIALS_JSON=JSON.stringify({client_email:'test@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
const A=require('../lib/archive');const handler=require('../api/archive');
const input={name:'テスト太郎',lineName:'太郎LINE',answers:Object.fromEntries(A.config.questions.map(q=>[q.id,'自分の目的と次の行動を具体的に書きます。']))};
function req(action,{method='GET',cookie='',body,origin='https://lkit.jp'}={}){return {url:'/api/archive?action='+action,method,body,headers:{cookie,origin,'content-type':'application/json'}};}
async function run(request){const r={headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(b){this.raw=b;try{this.data=JSON.parse(b)}catch{}}};await handler(request,r);return r;}

test('期限、本人セッション、非公開保存、再提出、管理権限を検証',async()=>{
 const oldFetch=global.fetch,oldNow=Date.now;let now=A.DEADLINE-60000;Date.now=()=>now;
 const records=new Map();let generation=0,conflictOnce=false;
 global.fetch=async(url,options={})=>{const u=new URL(url);if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'test-token'});assert.equal(options.headers.Authorization,'Bearer test-token');assert.ok(u.pathname.includes('private-work-bucket'));
 if(options.method==='POST'){const key=u.searchParams.get('name');const previous=records.get(key);if(conflictOnce){conflictOnce=false;return new Response('',{status:412});}assert.equal(u.searchParams.get('ifGenerationMatch'),previous?.generation||'0');const entry={record:JSON.parse(options.body),generation:String(++generation)};records.set(key,entry);return Response.json({});}
 if(u.searchParams.has('prefix'))return Response.json({items:[...records.keys()].filter(k=>k.startsWith(u.searchParams.get('prefix'))).map(name=>({name}))});
 const key=decodeURIComponent(u.pathname.split('/o/')[1]||'');const found=records.get(key);return found?Response.json(found.record,{headers:{'x-goog-generation':found.generation}}):new Response('',{status:404});
 };
 try{
  assert.equal(A.expired(A.DEADLINE-1),false);assert.equal(A.expired(A.DEADLINE),true);
  let s=await run(req('session'));assert.equal(s.statusCode,200);assert.equal(s.data.submission,null);assert.match(s.headers['set-cookie'],/HttpOnly; SameSite=Strict; Secure/);const cookie=s.headers['set-cookie'].split(';')[0];
  assert.equal((await run(req('submit',{method:'POST',body:input}))).statusCode,401);
  assert.equal((await run(req('submit',{method:'POST',body:input,cookie,origin:'https://evil.test'}))).statusCode,403);
  assert.equal((await run(req('submit',{method:'POST',body:{},cookie}))).statusCode,400);
  assert.equal((await run(req('submit',{method:'POST',body:input,cookie}))).statusCode,200);
  s=await run(req('session',{cookie}));assert.equal(s.data.submission.name,input.name);const created=s.data.submission.createdAt;
  now+=1000;conflictOnce=true;let edited={...input,answers:{...input.answers,goal:'再提出した目標'}};
  assert.equal((await run(req('submit',{method:'POST',body:edited,cookie}))).statusCode,200);assert.equal(records.size,1);
  s=await run(req('session',{cookie}));assert.equal(s.data.submission.answers.goal,'再提出した目標');assert.equal(s.data.submission.createdAt,created);
  let stranger=await run(req('session'));assert.equal(stranger.data.submission,null);
  assert.equal((await run(req('admin-list'))).statusCode,403);assert.equal((await run(req('admin-csv',{cookie}))).statusCode,403);
  assert.equal((await run(req('admin-login',{method:'POST',body:{password:'wrong'}}))).statusCode,401);
  const login=await run(req('admin-login',{method:'POST',body:{password:'test-password'}}));assert.equal(login.statusCode,200);const admin=login.headers['set-cookie'].split(';')[0];
  let list=await run(req('admin-list',{cookie:admin}));assert.equal(list.data.rows.length,1);
  assert.equal((await run(req('submit&test=1',{method:'POST',body:input,cookie}))).statusCode,403);
  assert.equal((await run(req('submit&test=1',{method:'POST',body:input,cookie:cookie+'; '+admin}))).statusCode,200);assert.equal(records.size,2);assert.equal((await run(req('admin-list',{cookie:admin}))).data.rows.length,1);
  const csv=await run(req('admin-csv',{cookie:admin}));assert.equal(csv.raw.charCodeAt(0),0xfeff);assert.ok(csv.raw.includes('\r\n'));assert.ok(A.csv([{...input,name:'=1+1',createdAt:created,updatedAt:created}]).includes("'=1+1"));
  const fake=A.issue('admin','kudo').slice(0,-1)+'!';assert.equal((await run(req('admin-list',{cookie:'archive_admin='+fake}))).statusCode,403);
  now=A.DEADLINE;assert.equal((await run(req('session',{cookie}))).data.expired,true);assert.equal((await run(req('watch'))).statusCode,410);assert.equal((await run(req('submit',{method:'POST',cookie,body:input}))).statusCode,410);assert.equal((await run(req('admin-list',{cookie:admin}))).statusCode,200);
 }finally{global.fetch=oldFetch;Date.now=oldNow;}
});

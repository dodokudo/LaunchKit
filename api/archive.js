 'use strict';
const crypto=require('node:crypto');const A=require('../lib/archive');
function send(res,status,data){res.statusCode=status;res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}
function setCookie(res,name,value,seconds){res.setHeader('Set-Cookie',`${name}=${value}; Path=/api/archive; HttpOnly; SameSite=Strict; Secure; Max-Age=${seconds}`);}
async function body(req){if(req.body){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>32000)throw new Error('body_too_large');return JSON.parse(raw);}let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32000)throw new Error('body_too_large');}return JSON.parse(raw||'{}');}
function allowedOrigin(req){return req.headers.origin==='https://lkit.jp'||(process.env.NODE_ENV==='test'&&req.headers.origin==='http://127.0.0.1:5191');}
module.exports=async function handler(req,res){
 const url=new URL(req.url,'https://lkit.jp');const action=url.searchParams.get('action')||'session';
 try{
 if(!['GET','POST'].includes(req.method))return send(res,405,{error:'method_not_allowed'});
 if(req.method==='POST'&&(!allowedOrigin(req)||!String(req.headers['content-type']||'').startsWith('application/json')))return send(res,403,{error:'origin_denied'});
 if(action==='watch'&&req.method==='GET'){
  if(A.expired())return send(res,410,{error:'deadline_passed'});const left=A.DEADLINE-Date.now();res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-src https://drive.google.com; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'");res.statusCode=200;
  return res.end(`<!doctype html><html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}body{background:#101827;color:white;font-family:sans-serif}p{padding:30px}</style><iframe src="https://drive.google.com/file/d/${A.config.videoId}/preview" title="第1回セミナー" allow="autoplay; fullscreen" allowfullscreen></iframe><script>const end=performance.now()+${left},wall=Date.now()+${left};function check(){if(performance.now()>=end||Date.now()>=wall){document.body.innerHTML='<p>アーカイブの公開は終了しました。</p>';clearInterval(t)}}const t=setInterval(check,500);document.addEventListener('visibilitychange',check);</script></html>`);
 }
 if(action==='session'&&req.method==='GET'){
  if(A.expired())return send(res,200,{expired:true,deadline:A.DEADLINE,now:Date.now()});let user=A.session(req,'participant');if(!user){user={id:crypto.randomUUID()};setCookie(res,'archive_participant',A.issue('participant',user.id),604800);}const {record}=await A.readRecord(user.id);return send(res,200,{expired:false,deadline:A.DEADLINE,now:Date.now(),submission:record,questions:A.config.questions});
 }
 if(action==='submit'&&req.method==='POST'){
  if(A.expired())return send(res,410,{error:'deadline_passed'});const user=A.session(req,'participant');if(!user)return send(res,401,{error:'session_required'});const testMode=url.searchParams.get('test')==='1';if(testMode&&!A.session(req,'admin'))return send(res,403,{error:'forbidden'});const input=A.normalize(await body(req));const record=await A.saveRecord(user.id,input,testMode);return send(res,200,{ok:true,submittedAt:record.updatedAt});
 }
 if(action==='admin-login'&&req.method==='POST'){
  const data=await body(req);const expected=process.env.ARCHIVE_ADMIN_PASSWORD_SHA256;if(!expected)throw new Error('admin_not_configured');if(typeof data.password!=='string'||data.password.length>200||!A.constantEqual(crypto.createHash('sha256').update(data.password).digest('hex'),expected))return send(res,401,{error:'login_failed'});setCookie(res,'archive_admin',A.issue('admin','kudo'),43200);return send(res,200,{ok:true});
 }
 if(action==='logout'&&req.method==='POST'){setCookie(res,'archive_admin','',0);return send(res,200,{ok:true});}
 if(['admin-list','admin-csv'].includes(action)&&req.method==='GET'){
  if(!A.session(req,'admin'))return send(res,403,{error:'forbidden'});const rows=await A.listRecords();if(action==='admin-csv'){res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="seminar-work.csv"');res.setHeader('Cache-Control','private, no-store');return res.end(A.csv(rows));}return send(res,200,{rows,questions:A.config.questions});
 }
 return send(res,404,{error:'not_found'});
 }catch(e){const code=e.message;if(['invalid_input','invalid_identity','invalid_answers','body_too_large'].includes(code)||e instanceof SyntaxError)return send(res,400,{error:'invalid_input'});if(code==='deadline_passed')return send(res,410,{error:code});console.error('Archive operation failed:',code);return send(res,503,{error:'temporarily_unavailable'});}
};

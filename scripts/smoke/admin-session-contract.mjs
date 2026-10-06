import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

/** Run against a real Next server and its dedicated loopback PostgreSQL database. */
export async function runAdminSessionContract({origin,username,password,masterKey,sql}) {
	assert.equal(new URL(origin).hostname,'127.0.0.1','Session acceptance requires the isolated loopback server');
	const checks=[];
	async function request(name,path,init,expected) {
		const response=await fetch(origin+path,{...init,signal:AbortSignal.timeout(10000)});
		const body=await response.json();
		assert.equal(response.status,expected,name);
		checks.push({name,path,status:response.status,authenticated:body.authenticated,success:body.success});
		return {response,body};
	}
	const headers=cookie=>({cookie});
	await request('anonymous admin','/api/admin/config',{},401);
	for(const cookie of ['admin_session=arbitrary','admin_session=','xadmin_session=arbitrary','admin_session='+randomBytes(32).toString('hex'),'admin_session='+randomBytes(32).toString('hex')+'; admin_session='+randomBytes(32).toString('hex')]) {
		await request('unissued or ambiguous cookie','/api/admin/config',{headers:headers(cookie)},401);
		const check=await request('invalid session check','/api/auth/check',{headers:headers(cookie)},200);
		assert.equal(check.body.authenticated,false);
	}
	await request('invalid external bearer','/api/admin/config',{headers:{authorization:'Bearer invalid'}},401);
	await request('valid external bearer','/api/admin/config',{headers:{authorization:'Bearer '+masterKey}},200);
	for(const body of ['null','{','{"username":1,"password":"x"}'])await request('invalid login input','/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body},400);
	await request('invalid credentials','/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:'invalid'})},401);
	async function login(){
		const result=await request('actual login','/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})},200);
		assert.equal(result.body.success,true);
		const setCookie=result.response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=strict/i);assert.match(setCookie,/Path=\//i);
		const cookie=setCookie.split(';')[0],token=cookie.slice('admin_session='.length),hash=createHash('sha256').update(token).digest('hex');
		const rows=await sql`SELECT token_hash, credential_hash, expires_at FROM admin_sessions WHERE token_hash=${hash}`;
		assert.equal(rows.length,1);assert.notEqual(rows[0].token_hash,token);assert.notEqual(rows[0].credential_hash,password);assert(Number(rows[0].expires_at)>Date.now()/1000);
		return {cookie,hash};
	}
	const first=await login();
	const check=await request('valid session check','/api/auth/check',{headers:headers(first.cookie)},200);assert.equal(check.body.authenticated,true);
	await request('valid browser read','/api/admin/config',{headers:headers(first.cookie)},200);
	await request('actual logout','/api/auth/logout',{method:'POST',headers:headers(first.cookie)},200);
	const removed=await sql`SELECT token_hash FROM admin_sessions WHERE token_hash=${first.hash}`;assert.equal(removed.length,0);
	await request('revoked session read','/api/admin/config',{headers:headers(first.cookie)},401);
	const revoked=await request('revoked session check','/api/auth/check',{headers:headers(first.cookie)},200);assert.equal(revoked.body.authenticated,false);
	await request('idempotent explicit logout','/api/auth/logout',{method:'POST',headers:headers(first.cookie)},200);
	const second=await login();assert.notEqual(first.hash,second.hash);
	await sql`UPDATE admin_sessions SET expires_at=0 WHERE token_hash=${second.hash}`;
	await request('expired session read','/api/admin/config',{headers:headers(second.cookie)},401);
	const third=await login();assert.equal((await sql`SELECT token_hash FROM admin_sessions WHERE token_hash=${second.hash}`).length,0);
	await request('DELETE login revocation','/api/auth/login',{method:'DELETE',headers:headers(third.cookie)},200);
	await request('DELETE revoked read','/api/admin/config',{headers:headers(third.cookie)},401);
	return {checks,status:'PASS'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const origin=process.env.OCTAFUSE_TEST_ADMIN_ORIGIN,databaseURL=process.env.OCTAFUSE_TEST_DATABASE_URL;
	assert(origin && databaseURL,'Provide the dedicated test Admin origin and database URL');
	const target=new URL(databaseURL);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.username,'ui_validation');
	const require=createRequire(import.meta.url),postgres=require('postgres');
	const sql=postgres(databaseURL,{max:1,connection:{search_path:'octafuse_gateway, public'}});
	try {
		const username=process.env.OCTAFUSE_TEST_ADMIN_USERNAME,password=process.env.OCTAFUSE_TEST_ADMIN_PASSWORD,masterKey=process.env.OCTAFUSE_TEST_MASTER_KEY;
		assert(username && password && masterKey,'Provide the actual isolated server credentials and MASTER_KEY');
		const result=await runAdminSessionContract({origin,username,password,masterKey,sql});
		console.log(JSON.stringify(result));
	} finally {await sql.end();}
}

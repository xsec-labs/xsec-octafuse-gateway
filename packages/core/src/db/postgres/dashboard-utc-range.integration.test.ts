import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {createPostgresDatabaseClient} from '../../storage/database-client';
import {createPostgresRequestLogsRepository} from './request-logs.impl';

test('dashboard aggregates, UTC buckets and throughput are independent of the PostgreSQL session timezone',async()=>{
 const url=process.env.DATABASE_URL;assert.ok(url,'DATABASE_URL must point to an isolated migrated PostgreSQL database');
 for(const timezone of ['UTC','Asia/Shanghai','America/Los_Angeles']){
  const client=await createPostgresDatabaseClient(url,{max:1,connection:{TimeZone:timezone}}),ids=Array.from({length:4},()=>randomUUID()),email=randomUUID()+'@ui.invalid';let bodyError:unknown;const cleanupErrors:unknown[]=[];
  try{
   await client.raw`INSERT INTO api_key_request_logs(id,user_email,status,input_tokens,output_tokens,total_tokens,charged_cost,latency_ms,created_at) VALUES
    (${ids[0]},${email},'success',100,20,120,0.02,250,'2037-10-06T23:59:59Z'),
    (${ids[1]},${email},'error',100,20,120,0.02,250,'2037-10-07T00:00:00Z'),
    (${ids[2]},${email},'success',100,20,120,0.02,250,'2037-10-07T00:00:01Z'),
    (${ids[3]},${email},'success',100,20,120,0.02,250,${new Date(Date.now()-5000).toISOString()})`;
   const repo=createPostgresRequestLogsRepository(client);
   for(const [startDate,endDate] of [
    ['2037-10-06 23:59:59','2037-10-07 00:00:00'],
    ['2037-10-06T23:59:59Z','2037-10-07T00:00:00Z'],
    ['2037-10-07T07:59:59+08:00','2037-10-07T08:00:00+08:00'],
   ]){
    const bounds={startDate,endDate};const stats=await repo.getRequestStatsByRange(bounds);
    assert.equal(stats.totalRequests,2,timezone+' inclusive');assert.equal(stats.successCount,1);assert.equal(stats.errorCount,1);assert.equal(stats.totalTokens,240);assert.equal(stats.chargedCost,0.04);assert.equal(stats.avgLatencyMs,250);
    assert.equal((await repo.getRequestStatsByRange({...bounds,endExclusive:true})).totalRequests,1,timezone+' exclusive');
    assert.equal(await repo.getDistinctActiveUsersCount(bounds),1,timezone+' active');
    assert.equal(await repo.getDistinctActiveUsersCount({...bounds,startDate:endDate,endExclusive:true}),0,timezone+' empty');
    for(const granularity of ['hour','day'] as const){
     const series=await repo.queryRequestTimeseries({...bounds,granularity});
     assert.deepEqual(series.map(r=>r.bucket),granularity==='hour'?['2037-10-06 23:00:00','2037-10-07 00:00:00']:['2037-10-06','2037-10-07'],timezone+' '+granularity);
     assert.deepEqual(series.map(r=>r.requestCount),[1,1]);assert.equal(series.reduce((n,r)=>n+r.totalTokens,0),240);
     const users=await repo.queryUserTokenTimeseries({...bounds,granularity,userEmails:[email]});assert.deepEqual(users.map(r=>r.bucket),series.map(r=>r.bucket));assert.deepEqual(users.map(r=>r.totalTokens),[120,120]);
    }
   }
   assert.deepEqual(await repo.getThroughputLastMinute(),{rpm:1,tpm:120},timezone+' throughput');
  }catch(error){bodyError=error;}
  finally{try{await client.raw`DELETE FROM api_key_request_logs WHERE id IN ${client.raw(ids)}`;}catch(error){cleanupErrors.push(error);}try{await client.raw.end();}catch(error){cleanupErrors.push(error);}}
  if(cleanupErrors.length)throw new AggregateError([...(bodyError?[bodyError]:[]),...cleanupErrors],'Dashboard UTC regression or cleanup failed');
  if(bodyError)throw bodyError;
 }
});

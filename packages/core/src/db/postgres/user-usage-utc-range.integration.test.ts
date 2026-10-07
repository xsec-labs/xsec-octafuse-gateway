import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresDatabaseClient } from '../../storage/database-client';
import { createPostgresAdminAnalyticsRepository } from './admin-analytics.impl';

test('user usage preserves UTC ranges, inclusive bounds, budgets and email filters across session timezones', async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL must point to an isolated migrated PostgreSQL database');
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const client = await createPostgresDatabaseClient(connectionString, {max:1, connection:{search_path:'octafuse_gateway, public', TimeZone:timezone}});
    const userId=randomUUID(), otherId=randomUUID(), email=`usage-${randomUUID()}@ui.invalid`, otherEmail=`other-${randomUUID()}@ui.invalid`, modelId=randomUUID();
    let bodyError: unknown;
    const cleanupErrors: unknown[]=[];
    try {
      const settings=await client.raw`SELECT current_setting('TimeZone') AS timezone`;
      assert.equal(settings[0].timezone,timezone);
      await client.raw`INSERT INTO users(id,email,budget_max,budget_spent) VALUES (${userId},${email},1.23,0.6),(${otherId},${otherEmail},NULL,0)`;
      await client.raw`INSERT INTO api_key_request_logs(id,user_id,user_email,model_id,input_tokens,output_tokens,charged_cost,metered_cost,standard_cost,status,created_at) VALUES
        (${randomUUID()},${userId},${email},${modelId},100,10,0.01,0.005,0.02,'success','2026-10-06T10:00:00Z'),
        (${randomUUID()},${userId},${email},${modelId},200,20,0.02,0.01,0.04,'error','2026-10-06T10:00:01Z'),
        (${randomUUID()},${userId},${email},${modelId},900,90,0.09,0.045,0.18,'success','2026-10-06T09:59:59Z'),
        (${randomUUID()},${userId},${email},${modelId},900,90,0.09,0.045,0.18,'success','2026-10-06T10:00:02Z'),
        (${randomUUID()},${otherId},${otherEmail},${modelId},50,5,0.01,0.005,0.02,'success','2026-10-06T10:00:00Z'),
        (${randomUUID()},NULL,NULL,${modelId},50,5,0.01,0.005,0.02,'success','2026-10-06T10:00:00Z'),
        (${randomUUID()},NULL,'',${modelId},50,5,0.01,0.005,0.02,'success','2026-10-06T10:00:00Z')`;
      const repository=createPostgresAdminAnalyticsRepository(client);
      for (const [start,end] of [
        ['2026-10-06T10:00:00Z','2026-10-06T10:00:01Z'],
        ['2026-10-06T18:00:00+08:00','2026-10-06T18:00:01+08:00'],
        ['2026-10-06 10:00:00','2026-10-06 10:00:01'],
        ['2026-10-06 10:00:00.000','2026-10-06 10:00:01.000'],
      ]) {
        const all=await repository.queryUserAnalytics({start,end});
        assert.equal(all.length,2,timezone+' user UTC range');
        const filtered=await repository.queryUserAnalytics({start,end,email:email.slice(0,-11)});
        assert.equal(filtered.length,1,timezone+' email UTC range');
        const row=filtered[0];assert.equal(row.user_email,email);
        assert.equal(Number(row.request_count),2,timezone+' inclusive user count');
        assert.equal(Number(row.success_count),1);assert.equal(Number(row.error_count),1);
        assert.equal(Number(row.input_tokens),300);assert.equal(Number(row.output_tokens),30);
        assert.equal(Number(row.charged_cost),0.03);assert.equal(Number(row.metered_cost),0.015);assert.equal(Number(row.standard_cost),0.06);
        assert.equal(Number(row.distinct_models),1);assert.equal(Number(row.budget_max),1.23);assert.equal(Number(row.budget_spent),0.6);
        assert.equal(new Date(row.last_active_at!).toISOString(),'2026-10-06T10:00:01.000Z');
        assert.equal((await repository.queryUserAnalytics({start,end,email:otherEmail}))[0].budget_max,null);
        assert.equal((await repository.queryUserAnalytics({start,end,email:'missing@ui.invalid'})).length,0);
      }
    } catch(error) {bodyError=error;}
    finally {
      try{await client.raw`DELETE FROM api_key_request_logs WHERE model_id=${modelId}`;}catch(error){cleanupErrors.push(error);}
      try{await client.raw`DELETE FROM users WHERE id IN (${userId},${otherId})`;}catch(error){cleanupErrors.push(error);}
      try{await client.raw.end();}catch(error){cleanupErrors.push(error);}
    }
    if(cleanupErrors.length)throw new AggregateError([...(bodyError?[bodyError]:[]),...cleanupErrors],'User usage UTC regression or cleanup failed');
    if(bodyError)throw bodyError;
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresDatabaseClient } from '../../storage/database-client';
import { createPostgresAdminAnalyticsRepository } from './admin-analytics.impl';

test('model usage and provider drilldowns preserve UTC ranges and filters across session timezones', async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL must point to an isolated migrated PostgreSQL database');
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const client = await createPostgresDatabaseClient(connectionString, {max: 1, connection: {search_path: 'octafuse_gateway, public', TimeZone: timezone}});
    const providerId = randomUUID(), modelId = randomUUID(), email = `${randomUUID()}@ui.invalid`, tag = randomUUID();
    let bodyError: unknown;
    const cleanupErrors: unknown[] = [];
    try {
      await client.raw`INSERT INTO models(id,display_name) VALUES (${modelId},'UTC usage validation')`;
      await client.raw`INSERT INTO api_key_request_logs(id,provider_id,model_id,user_email,route_group,status,created_at) VALUES
        (${randomUUID()},${providerId},${modelId},${email},'default','success','2026-10-06T10:00:00Z'),
        (${randomUUID()},${providerId},${modelId},${email},'default','error','2026-10-06T10:00:01Z'),
        (${randomUUID()},${providerId},${modelId},${email},'other','success','2026-10-06T10:00:02Z')`;
      await client.raw`INSERT INTO model_tags(model_id,tag) VALUES (${modelId},${tag})`;
      const repository = createPostgresAdminAnalyticsRepository(client);
      for (const [start, end] of [
        ['2026-10-06 10:00:00', '2026-10-06 10:00:01'],
        ['2026-10-06T10:00:00Z', '2026-10-06T10:00:01Z'],
        ['2026-10-06T18:00:00+08:00', '2026-10-06T18:00:01+08:00'],
        ['2026-10-06 10:00:00.000', '2026-10-06 10:00:01.000'],
      ]) {
        const models = await repository.queryModelAnalytics({start,end,providerId,userEmail:email,tag});
        const providers = await repository.queryProviderAnalytics({start,end,modelId,routeGroup:'default',tag});
        assert.equal(models.length,1,timezone+' model range');
        assert.equal(providers.length,1,timezone+' provider range');
        assert.equal(Number(models[0].request_count),2,timezone+' inclusive model count');
        assert.equal(Number(models[0].success_count),1,timezone+' success count');
        assert.equal(Number(models[0].error_count),1,timezone+' error count');
        assert.equal(Number(providers[0].request_count),2,timezone+' inclusive provider count');
        assert.equal((await repository.queryModelAnalytics({start,end,userEmail:'missing@ui.invalid'})).length,0);
        assert.equal((await repository.queryProviderAnalytics({start,end,modelId,routeGroup:'other'})).length,0);
      }
    } catch(error) {bodyError=error;}
    finally {
      try {await client.raw`DELETE FROM model_tags WHERE model_id=${modelId}`;}catch(error){cleanupErrors.push(error);}
      try {await client.raw`DELETE FROM api_key_request_logs WHERE provider_id=${providerId}`;}catch(error){cleanupErrors.push(error);}
      try {await client.raw`DELETE FROM models WHERE id=${modelId}`;}catch(error){cleanupErrors.push(error);}
      try {await client.raw.end();}catch(error){cleanupErrors.push(error);}
    }
    if(cleanupErrors.length)throw new AggregateError([...(bodyError?[bodyError]:[]),...cleanupErrors],'Model usage UTC regression or cleanup failed');
    if(bodyError)throw bodyError;
  }
});

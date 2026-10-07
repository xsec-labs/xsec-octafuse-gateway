import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresDatabaseClient } from '../../storage/database-client';
import { createPostgresAdminAnalyticsRepository } from './admin-analytics.impl';

test('reliability UTC ranges retain inclusive boundaries across PostgreSQL session timezones', async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL must point to an isolated migrated PostgreSQL database');
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const client = await createPostgresDatabaseClient(connectionString, {max: 1, connection: {search_path: 'octafuse_gateway, public', TimeZone: timezone}});
    const providerId = `reliability-utc-${randomUUID()}`, modelId = randomUUID(), ids = [randomUUID(), randomUUID(), randomUUID()];
    let bodyError: unknown;
    const cleanupErrors: unknown[] = [];
    try {
      await client.raw`INSERT INTO api_key_request_logs(id,provider_id,model_id,status,created_at) VALUES
        (${ids[0]},${providerId},${modelId},'success','2026-10-06T10:00:00Z'),
        (${ids[1]},${providerId},${modelId},'error','2026-10-06T10:00:01Z'),
        (${ids[2]},${providerId},${modelId},'success','2026-10-06T10:00:02Z')`;
      const repository = createPostgresAdminAnalyticsRepository(client);
      for (const [start, end] of [
        ['2026-10-06 10:00:00', '2026-10-06 10:00:01'],
        ['2026-10-06T10:00:00Z', '2026-10-06T10:00:01Z'],
        ['2026-10-06T18:00:00+08:00', '2026-10-06T18:00:01+08:00'],
        ['2026-10-06 10:00:00.000', '2026-10-06 10:00:01.000'],
      ]) {
        const providers = (await repository.queryProviderReliability({start,end})).filter(row=>row.provider_id===providerId);
        const models = (await repository.queryModelProviderReliability({start,end})).filter(row=>row.provider_id===providerId);
        assert.equal(providers.length,1,timezone+' provider range');
        assert.equal(models.length,1,timezone+' model/provider range');
        assert.equal(Number(providers[0].request_count),2,timezone+' inclusive provider count');
        assert.equal(Number(providers[0].success_count),1,timezone+' success count');
        assert.equal(Number(providers[0].error_count),1,timezone+' error count');
        assert.equal(Number(models[0].request_count),2,timezone+' inclusive model/provider count');
      }
    } catch(error) {bodyError=error;}
    finally {
      try {await client.raw`DELETE FROM api_key_request_logs WHERE provider_id=${providerId}`;}catch(error){cleanupErrors.push(error);}
      try {await client.raw.end();}catch(error){cleanupErrors.push(error);}
    }
    if(cleanupErrors.length)throw new AggregateError([...(bodyError?[bodyError]:[]),...cleanupErrors],'Reliability UTC regression or cleanup failed');
    if(bodyError)throw bodyError;
  }
});

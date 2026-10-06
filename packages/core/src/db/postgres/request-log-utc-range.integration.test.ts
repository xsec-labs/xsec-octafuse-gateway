import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresDatabaseClient } from '../../storage/database-client';
import { createPostgresRequestLogsRepository } from './request-logs.impl';

test('UTC request-log ranges preserve inclusive boundaries across PostgreSQL session timezones', async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL must point to an isolated migrated PostgreSQL database');
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const client = await createPostgresDatabaseClient(connectionString, {
      max: 1,
      connection: { search_path: 'octafuse_gateway, public', TimeZone: timezone },
    });
    const modelId = `utc-range-${randomUUID()}`;
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    let bodyError: unknown;
    const cleanupErrors: unknown[] = [];
    try {
      await client.raw`INSERT INTO api_key_request_logs (id, model_id, created_at) VALUES
        (${ids[0]}, ${modelId}, '2026-10-06T10:00:00Z'),
        (${ids[1]}, ${modelId}, '2026-10-06T10:00:01Z'),
        (${ids[2]}, ${modelId}, '2026-10-06T10:00:02Z')`;
      const repository = createPostgresRequestLogsRepository(client);
      for (const [startDate, endDate] of [
        ['2026-10-06 10:00:00', '2026-10-06 10:00:01'],
        ['2026-10-06T10:00:00Z', '2026-10-06T10:00:01Z'],
        ['2026-10-06T18:00:00+08:00', '2026-10-06T18:00:01+08:00'],
      ]) {
        const result = await repository.getRequestLogs({modelId, startDate, endDate, page: 1, pageSize: 50});
        assert.equal(result.total, 2, timezone);
        assert.deepEqual(result.logs.map(row => row.id), [ids[1], ids[0]], timezone);
      }
      const openEnd = await repository.getRequestLogs({modelId, startDate: '2026-10-06 10:00:01'});
      assert.deepEqual(openEnd.logs.map(row => row.id), [ids[2], ids[1]], timezone);
    } catch (error) { bodyError = error; }
    finally {
      try { await client.raw`DELETE FROM api_key_request_logs WHERE model_id=${modelId}`; }
      catch (error) { cleanupErrors.push(error); }
      try { await client.raw.end(); }
      catch (error) { cleanupErrors.push(error); }
    }
    if (bodyError || cleanupErrors.length) throw new AggregateError([...(bodyError ? [bodyError] : []), ...cleanupErrors], 'UTC range regression or cleanup failed');
  }
});

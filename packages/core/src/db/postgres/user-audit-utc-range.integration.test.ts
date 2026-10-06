import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPostgresDatabaseClient } from '../../storage/database-client';
import { createPostgresUserAuditLogsRepository } from './user-audit-logs.impl';

test('UTC global audit ranges preserve inclusive boundaries across PostgreSQL session timezones', async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, 'DATABASE_URL must point to an isolated migrated PostgreSQL database');
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const client = await createPostgresDatabaseClient(connectionString, {
      max: 1,
      connection: { search_path: 'octafuse_gateway, public', TimeZone: timezone },
    });
    const correlationId = `audit-utc-${randomUUID()}`;
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    let bodyError: unknown;
    const cleanupErrors: unknown[] = [];
    try {
      await client.raw`INSERT INTO user_audit_logs (id,event_type,actor_type,correlation_id,created_at) VALUES
        (${ids[0]},'admin_adjust','admin',${correlationId},'2026-10-06T10:00:00Z'),
        (${ids[1]},'admin_adjust','admin',${correlationId},'2026-10-06T10:00:01Z'),
        (${ids[2]},'admin_adjust','admin',${correlationId},'2026-10-06T10:00:02Z')`;
      const repository = createPostgresUserAuditLogsRepository(client);
      for (const [startDate, endDate] of [
        ['2026-10-06 10:00:00', '2026-10-06 10:00:01'],
        ['2026-10-06T10:00:00Z', '2026-10-06T10:00:01Z'],
        ['2026-10-06T18:00:00+08:00', '2026-10-06T18:00:01+08:00'],
        ['2026-10-06 10:00:00.000', '2026-10-06 10:00:01.000'],
      ]) {
        const result = await repository.getGlobalUserAuditLogs({correlationId,startDate,endDate,page:1,pageSize:50});
        assert.equal(result.total,2,timezone);
        assert.deepEqual(result.logs.map(row=>row.id),[ids[1],ids[0]],timezone);
      }
      const openEnd = await repository.getGlobalUserAuditLogs({correlationId,startDate:'2026-10-06 10:00:01'});
      assert.deepEqual(openEnd.logs.map(row=>row.id),[ids[2],ids[1]],timezone);
      const openStart = await repository.getGlobalUserAuditLogs({correlationId,endDate:'2026-10-06 10:00:01'});
      assert.deepEqual(openStart.logs.map(row=>row.id),[ids[1],ids[0]],timezone);
    } catch(error){bodyError=error;}
    finally {
      try{await client.raw`DELETE FROM user_audit_logs WHERE correlation_id=${correlationId}`;}catch(error){cleanupErrors.push(error);}
      try{await client.raw.end();}catch(error){cleanupErrors.push(error);}
    }
    if(bodyError||cleanupErrors.length)throw new AggregateError([...(bodyError?[bodyError]:[]),...cleanupErrors],'Audit UTC regression or cleanup failed');
  }
});

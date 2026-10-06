import assert from 'node:assert/strict';

/** Exercise an actual database repository; callers own its isolated schema and cleanup. */
export async function runAdminSessionStorageContract(repository) {
	const first={tokenHash:'a'.repeat(64),credentialHash:'b'.repeat(64),expiresAt:2000};
	const expired={tokenHash:'c'.repeat(64),credentialHash:'d'.repeat(64),expiresAt:1000};
	assert.equal(await repository.find(first.tokenHash),null);
	await repository.insert(first);await repository.insert(expired);
	assert.deepEqual(await repository.find(first.tokenHash),first);
	await assert.rejects(repository.insert(first));
	await repository.deleteExpired(1000);
	assert.equal(await repository.find(expired.tokenHash),null);
	assert.deepEqual(await repository.find(first.tokenHash),first);
	await repository.delete(first.tokenHash);
	assert.equal(await repository.find(first.tokenHash),null);
	await repository.delete(first.tokenHash);
	return {status:'PASS',cases:['missing','insert/read','duplicate rejection','expiry boundary','live retention','delete','idempotent delete']};
}

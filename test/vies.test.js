import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVies } from '../src/vies.js';

test('checkVies parses a valid response', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ valid: true, name: 'TEST GMBH', address: 'STR 1\n12345 BERLIN', requestDate: '2026-10-26' }) });
  const r = await checkVies('DE 123 456 789', { fetchImpl });
  assert.equal(r.checked, true); assert.equal(r.valid, true); assert.equal(r.name, 'TEST GMBH'); assert.equal(r.address, 'STR 1 12345 BERLIN');
});
test('checkVies skips Swiss ids', async () => {
  const r = await checkVies('CHE-123.456.789 MWST');
  assert.equal(r.checked, false); assert.equal(r.reason, 'switzerland_not_in_vies');
});
test('checkVies handles service errors', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ valid: false, userError: 'MS_UNAVAILABLE' }) });
  const r = await checkVies('DE123456789', { fetchImpl });
  assert.equal(r.checked, false); assert.equal(r.reason, 'MS_UNAVAILABLE');
});
test('checkVies treats member-state outage as not checked', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ actionSucceed: false, errorWrappers: [{ error: 'MS_UNAVAILABLE' }] }) });
  const r = await checkVies('DE291779897', { fetchImpl });
  assert.equal(r.checked, false); assert.equal(r.valid, null); assert.equal(r.reason, 'MS_UNAVAILABLE');
});

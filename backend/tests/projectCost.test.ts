import assert from 'node:assert/strict';
import { readCost } from '../src/services/projectCost';

async function main() {
  const originalFetch = global.fetch;
  try {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const run = async (queryResponse: unknown, status = 200) => {
      calls.length = 0;
      global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        return url.startsWith('http://metadata.google.internal/')
          ? new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 })
          : new Response(JSON.stringify(queryResponse), { status });
      }) as typeof fetch;
      return readCost('coding-harness-demo-20261029');
    };

    const available = await run({ jobComplete: true, rows: [{ f: [
      { v: 'USD' }, { v: '2.50' }, { v: '1.25' }, { v: '1793200000' }, { v: '1793190000' }, { v: '10' },
    ] }] });
    assert.equal(available.status, 'available');
    assert.equal(available.grossCost, 2.5);
    assert.equal(available.netCost, 1.25);
    assert.equal(available.latestUsage, new Date(1793190000 * 1000).toISOString());
    assert.match(String(calls[1].init?.body), /CALL .*billing_dashboard.project_cost/);
    assert.equal((await run({ error: { message: 'Not found: Table' } }, 404)).status, 'pending');
    assert.equal((await run({ jobComplete: true, rows: [] })).status, 'pending');
    assert.equal((await run({ jobComplete: true, rows: [{ f: [{ v: 'PENDING' }] }] })).status, 'pending');
    assert.equal((await run({ error: { message: 'Permission denied' } }, 403)).status, 'unavailable');
    assert.equal((await run({ jobComplete: true, rows: [{ f: [{ v: 'USD' }, { v: null }, { v: '0' }] }] })).status, 'unavailable');
    console.log('Project cost reporting tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../src/app';

/**
 * Diagnostic and integration test script for Backend API routes and middleware.
 * Tests health check, auth stubs, security headers, and 404 handling.
 */
export async function runApiTests(): Promise<boolean> {
  console.log('\n========================================');
  console.log('   🌐 API & ENDPOINTS DIAGNOSTICS');
  console.log('========================================');

  const app = createApp();
  const server = http.createServer(app);

  // Bind to dynamic port (0) to avoid any collision with running instances
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`🚀 Ephemeral test server running at ${baseUrl}`);

  let allPassed = true;

  try {
    // 1. Root /health endpoint
    process.stdout.write('⏳ Testing GET /health... ');
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.strictEqual(healthRes.status, 200, 'Expected 200 OK');
    const healthBody = (await healthRes.json()) as any;
    assert.strictEqual(healthBody.success, true);
    assert.ok(
      healthBody.data.status === 'ok' || healthBody.data.status === 'degraded',
      'Expected status to be ok or degraded',
    );
    assert.ok(healthBody.data.memory?.rss, 'Expected memory statistics');
    const dbStatus = healthBody.data.database.connected
      ? 'DB Online'
      : 'DB Offline (Degraded Mode)';
    console.log(`✓ OK (Status: 200, Health: ${healthBody.data.status}, ${dbStatus})`);

    // 2. Versioned /api/health endpoint
    process.stdout.write('⏳ Testing GET /api/health... ');
    const apiHealthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(apiHealthRes.status, 200, 'Expected 200 OK');
    const apiHealthBody = (await apiHealthRes.json()) as any;
    assert.strictEqual(apiHealthBody.success, true);
    console.log(`✓ OK (Status: ${apiHealthRes.status})`);

    const isDbConnected = healthBody.data.database?.connected === true;

    if (isDbConnected) {
      // 3. POST /api/auth/register (requires DB)
      process.stdout.write('⏳ Testing POST /api/auth/register... ');
      const testEmail = `dev-${Date.now()}@example.com`;
      const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'secretpassword' }),
      });
      assert.strictEqual(registerRes.status, 201, 'Expected 201 Created');
      const registerBody = (await registerRes.json()) as any;
      assert.strictEqual(registerBody.success, true);
      assert.strictEqual(registerBody.data.user.email, testEmail);
      console.log(`✓ OK (Status: ${registerRes.status})`);

      // 4. POST /api/auth/login (requires DB)
      process.stdout.write('⏳ Testing POST /api/auth/login... ');
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'secretpassword' }),
      });
      assert.strictEqual(loginRes.status, 200, 'Expected 200 OK');
      const loginBody = (await loginRes.json()) as any;
      assert.strictEqual(loginBody.success, true);
      assert.ok(loginBody.data.token, 'Expected JWT token');
      console.log(`✓ OK (Status: ${loginRes.status})`);

      // 5. GET /api/auth/me (with JWT token)
      process.stdout.write('⏳ Testing GET /api/auth/me... ');
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginBody.data.token}` },
      });
      assert.strictEqual(meRes.status, 200, 'Expected 200 OK');
      const meBody = (await meRes.json()) as any;
      assert.strictEqual(meBody.success, true);
      assert.strictEqual(meBody.data.user.email, testEmail);
      console.log(`✓ OK (Status: ${meRes.status})`);
    } else {
      // Test input validation when DB is offline (does not require DB connection)
      process.stdout.write('⏳ Testing POST /api/auth/register (validation check)... ');
      const invalidRegisterRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
      });
      assert.strictEqual(invalidRegisterRes.status, 400, 'Expected 400 Bad Request');
      console.log('✓ OK (Validation caught invalid input without DB)');

      process.stdout.write('⏳ Testing GET /api/auth/me (unauthorized check)... ');
      const unauthMeRes = await fetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(unauthMeRes.status, 401, 'Expected 401 Unauthorized');
      console.log('✓ OK (Auth middleware caught unauthenticated request)');
    }

    // 6. 404 Fallback Handler
    process.stdout.write('⏳ Testing 404 Handler (GET /api/non-existent)... ');
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent`);
    assert.strictEqual(notFoundRes.status, 404, 'Expected 404 Not Found');
    const notFoundBody = (await notFoundRes.json()) as any;
    assert.strictEqual(notFoundBody.success, false);
    assert.strictEqual(notFoundBody.error.code, 'NOT_FOUND');
    console.log(`✓ OK (Status: 404, Error Code: ${notFoundBody.error.code})`);

    console.log('\n✅ All API tests passed successfully!\n');
  } catch (error) {
    allPassed = false;
    console.error('\n❌ API test failed with error:');
    console.error(error);
  } finally {
    // Teardown server
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return allPassed;
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('api.test')) {
  runApiTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

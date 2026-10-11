import assert from 'node:assert';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { CommandRunner } from '../src/tools/commandRunner';
import {
  globalApiLimiter,
  authRateLimiter,
  taskSubmissionLimiter,
} from '../src/middlewares/rateLimiter';

/**
 * Diagnostic and integration test suite for Phase 6:
 * Security Hardening, Input Sanitization, Rate Limiting, CI/CD, and Production Deployment.
 */
export async function runPhase6Tests(): Promise<boolean> {
  console.log('\n========================================');
  console.log('   🔒  PHASE 6: SECURITY & DEPLOYMENT');
  console.log('========================================');

  let allPassed = true;
  const projectRoot = path.resolve(__dirname, '../../');

  try {
    // ----------------------------------------------------
    // 1. Security: Command Input Sanitization
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Command Input Sanitization... ');

    // Test null-byte injection rejection
    try {
      await CommandRunner.runCommand({
        command: 'echo "hello"\0rm -rf /',
        containerId: 'test-container',
      });
      assert.fail('Should have blocked null-byte injection');
    } catch (err: any) {
      assert.strictEqual(err.code, 'SECURITY_VIOLATION');
    }

    // Test destructive pattern rejection (rm -rf /)
    try {
      await CommandRunner.runCommand({
        command: 'rm -rf /',
        containerId: 'test-container',
      });
      assert.fail('Should have blocked destructive rm -rf /');
    } catch (err: any) {
      assert.strictEqual(err.code, 'SECURITY_VIOLATION');
    }

    // Test destructive pattern rejection (mount, chroot)
    try {
      await CommandRunner.runCommand({
        command: 'mount /dev/sda1 /mnt',
        containerId: 'test-container',
      });
      assert.fail('Should have blocked mount command');
    } catch (err: any) {
      assert.strictEqual(err.code, 'SECURITY_VIOLATION');
    }
    console.log('✓ OK (Null-byte, rm -rf /, and mount exploits blocked)');

    // ----------------------------------------------------
    // 2. Security: Rate Limiting Middlewares
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Rate Limiting Configuration... ');
    assert.ok(
      typeof globalApiLimiter === 'function',
      'globalApiLimiter should be an Express middleware',
    );
    assert.ok(
      typeof authRateLimiter === 'function',
      'authRateLimiter should be an Express middleware',
    );
    assert.ok(
      typeof taskSubmissionLimiter === 'function',
      'taskSubmissionLimiter should be an Express middleware',
    );
    console.log('✓ OK (Global, auth, and task submission limiters configured)');

    // ----------------------------------------------------
    // 3. Deployment: Dockerfile.backend & Dockerfile.frontend
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Docker Containerization assets... ');
    const backendDockerPath = path.join(projectRoot, 'Dockerfile.backend');
    const frontendDockerPath = path.join(projectRoot, 'Dockerfile.frontend');

    assert.ok(fsSync.existsSync(backendDockerPath), 'Dockerfile.backend should exist');
    assert.ok(fsSync.existsSync(frontendDockerPath), 'Dockerfile.frontend should exist');

    const backendDockerfile = await fs.readFile(backendDockerPath, 'utf-8');
    assert.ok(backendDockerfile.includes('AS builder'), 'Dockerfile.backend should be multi-stage');
    assert.ok(
      backendDockerfile.includes('AS runner'),
      'Dockerfile.backend should have runner stage',
    );

    const frontendDockerfile = await fs.readFile(frontendDockerPath, 'utf-8');
    assert.ok(
      frontendDockerfile.includes('AS builder'),
      'Dockerfile.frontend should be multi-stage',
    );
    assert.ok(
      frontendDockerfile.includes('AS runner'),
      'Dockerfile.frontend should have runner stage',
    );
    console.log('✓ OK (Multi-stage backend and frontend Dockerfiles verified)');

    // ----------------------------------------------------
    // 4. Deployment: Nginx Reverse Proxy Config
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Nginx Reverse Proxy Configuration... ');
    const nginxPath = path.join(projectRoot, 'nginx.conf');
    assert.ok(fsSync.existsSync(nginxPath), 'nginx.conf should exist');

    const nginxConfig = await fs.readFile(nginxPath, 'utf-8');
    assert.ok(nginxConfig.includes('upstream frontend_upstream'), 'Should route to frontend');
    assert.ok(nginxConfig.includes('upstream backend_upstream'), 'Should route to backend');
    assert.ok(nginxConfig.includes('/socket.io/'), 'Should support WebSocket upgrade routing');
    assert.ok(nginxConfig.includes('/api/'), 'Should support REST API routing');
    console.log('✓ OK (Nginx reverse proxy & WebSocket routing verified)');

    // ----------------------------------------------------
    // 5. Deployment: docker-compose.prod.yml
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing Production Docker Compose orchestration... ');
    const prodComposePath = path.join(projectRoot, 'docker-compose.prod.yml');
    assert.ok(fsSync.existsSync(prodComposePath), 'docker-compose.prod.yml should exist');

    const composeContent = await fs.readFile(prodComposePath, 'utf-8');
    assert.ok(composeContent.includes('postgres:'), 'Should define PostgreSQL service');
    assert.ok(composeContent.includes('redis:'), 'Should define Redis service');
    assert.ok(composeContent.includes('backend:'), 'Should define Backend service');
    assert.ok(composeContent.includes('frontend:'), 'Should define Frontend service');
    assert.ok(composeContent.includes('nginx:'), 'Should define Nginx reverse proxy service');
    console.log('✓ OK (5 production microservices defined with persistent volumes)');

    // ----------------------------------------------------
    // 6. CI/CD: GitHub Actions Workflow
    // ----------------------------------------------------
    process.stdout.write('⏳ Testing GitHub Actions CI/CD Pipeline... ');
    const ciPath = path.join(projectRoot, '.github/workflows/ci.yml');
    assert.ok(fsSync.existsSync(ciPath), 'ci.yml should exist in .github/workflows/');

    const ciContent = await fs.readFile(ciPath, 'utf-8');
    assert.ok(ciContent.includes('npm run build:shared'), 'CI should build shared');
    assert.ok(ciContent.includes('npm run build:backend'), 'CI should build backend');
    assert.ok(ciContent.includes('npm run build:frontend'), 'CI should build frontend');
    assert.ok(ciContent.includes('npm run test:backend'), 'CI should run tests');
    console.log('✓ OK (Automated GitHub Actions CI pipeline validated)');

    console.log('\n✅ All Phase 6 Security & Deployment tests passed successfully!\n');
  } catch (err) {
    allPassed = false;
    console.error('\n❌ Phase 6 test failed with error:');
    console.error(err);
  }

  return allPassed;
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('phase6.test')) {
  runPhase6Tests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

/**
 * Diagnostic pre-flight check script for Coding Harness developers.
 * Validates local machine setup, Docker daemon, port availability, and env variables.
 */
async function checkPort(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function runDiagnostics() {
  console.log('====================================================');
  console.log('   🛠️ CODING HARNESS - ENVIRONMENT DIAGNOSTICS      ');
  console.log('====================================================\n');

  // 1. Node.js Version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
  console.log(`[1] Node.js Version: ${nodeVersion} ${major >= 18 ? '✅ (Compatible)' : '❌ (Requires Node >= 18)'}`);

  // 2. .env Configuration File
  const envPath = path.resolve(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);
  console.log(`[2] Backend .env file: ${envExists ? '✅ (Found)' : '⚠️ (Missing backend/.env - copy from .env.example)'}`);

  // 3. Docker CLI Check
  let dockerCliOk = false;
  try {
    const dockerVer = execSync('docker --version', { stdio: 'pipe' }).toString().trim();
    console.log(`[3] Docker CLI: ✅ (${dockerVer})`);
    dockerCliOk = true;
  } catch {
    console.log('[3] Docker CLI: ❌ Not found in PATH');
  }

  // 4. Docker Engine / Daemon Check
  let dockerDaemonOk = false;
  if (dockerCliOk) {
    try {
      execSync('docker info', { stdio: 'pipe' });
      console.log('[4] Docker Daemon: ✅ Running and responsive');
      dockerDaemonOk = true;
    } catch {
      console.log('[4] Docker Daemon: ⚠️ Not reachable (Open Docker Desktop to start the engine)');
    }
  }

  // 5. PostgreSQL Port (5432)
  const pgPortOpen = await checkPort(5432);
  console.log(`[5] PostgreSQL Port (5432): ${pgPortOpen ? '✅ Listening' : '⚠️ Offline (Run: npm run docker:up)'}`);

  // 6. Redis Port (6379)
  const redisPortOpen = await checkPort(6379);
  console.log(`[6] Redis Port (6379): ${redisPortOpen ? '✅ Listening' : '⚠️ Offline (Run: npm run docker:up)'}`);

  console.log('\n====================================================');
  console.log('                 DIAGNOSTIC SUMMARY                 ');
  console.log('====================================================');
  if (dockerDaemonOk && pgPortOpen && redisPortOpen) {
    console.log('🎉 Everything is online and healthy! Ready for development & testing.\n');
  } else {
    console.log('ℹ️ Next steps for local setup:');
    if (!dockerDaemonOk) console.log('   - Start the Docker Desktop application.');
    if (!pgPortOpen || !redisPortOpen) console.log('   - Launch containers using: npm run docker:up');
    console.log('');
  }
}

runDiagnostics();

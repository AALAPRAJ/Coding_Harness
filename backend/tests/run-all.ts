import { runDbTests } from './db.test';
import { runApiTests } from './api.test';
import { prisma } from '../src/db/client';

/**
 * Master test runner for Coding Harness Backend.
 * Executes all diagnostic and integration tests sequentially.
 */
async function main() {
  const startTime = Date.now();

  console.log('====================================================');
  console.log('   🧪 CODING HARNESS - BACKEND TEST & DIAGNOSTICS   ');
  console.log('====================================================');

  let dbOk = false;
  let apiOk = false;

  try {
    dbOk = await runDbTests();
  } catch (err) {
    console.error('Fatal error during Database tests:', err);
  }

  try {
    apiOk = await runApiTests();
  } catch (err) {
    console.error('Fatal error during API tests:', err);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore teardown disconnect errors
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('====================================================');
  console.log('               TEST EXECUTION SUMMARY               ');
  console.log('====================================================');
  console.log(` Database / Prisma:    ${dbOk ? 'PASSED ✅' : 'FAILED (or Offline) ⚠️'}`);
  console.log(` API & Middleware:     ${apiOk ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(` Duration:             ${durationSec}s`);
  console.log('====================================================\n');

  if (!apiOk) {
    process.exit(1);
  } else if (!dbOk) {
    // If API passed but DB is offline, exit with 1 to indicate DB dependency needed
    console.log('👉 To run full database tests, ensure Docker Desktop is running and run: npm run docker:up\n');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();

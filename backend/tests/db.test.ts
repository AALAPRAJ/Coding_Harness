import assert from 'node:assert';
import { prisma, checkDatabaseConnection } from '../src/db/client';
import { TaskStatus } from '@coding-harness/shared';

/**
 * Diagnostic and integration test script for PostgreSQL and Prisma ORM.
 * Tests connection latency, CRUD operations, and relational integrity.
 */
export async function runDbTests(): Promise<boolean> {
  console.log('\n========================================');
  console.log('   🔍 DATABASE & PRISMA DIAGNOSTICS');
  console.log('========================================');

  const testEmail = `test_runner_${Date.now()}@codingharness.dev`;

  try {
    // 1. Connection & Ping Latency Check
    process.stdout.write('⏳ Testing database connection ping... ');
    const dbHealth = await checkDatabaseConnection();

    if (!dbHealth.connected) {
      console.log('✗ OFFLINE');
      console.error('\n❌ PostgreSQL is not reachable at localhost:5432.');
      console.error('👉 Make sure Docker Desktop is running, then run: npm run docker:up\n');
      return false;
    }

    console.log(`✓ OK (${dbHealth.latencyMs}ms latency)`);

    // 2. Query Existing Records
    process.stdout.write('⏳ Testing prisma.user.findMany()... ');
    const initialUsers = await prisma.user.findMany();
    assert.ok(Array.isArray(initialUsers), 'Result should be an array');
    console.log(`✓ OK (Found ${initialUsers.length} user(s))`);

    // 3. Create Test User
    process.stdout.write(`⏳ Creating temporary user (${testEmail})... `);
    const createdUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'dummy_hashed_password_for_testing',
      },
    });
    assert.ok(createdUser.id, 'Created user should have an ID');
    assert.strictEqual(createdUser.email, testEmail);
    console.log(`✓ OK (ID: ${createdUser.id})`);

    // 4. Create Related Task
    process.stdout.write('⏳ Creating task linked to user... ');
    const createdTask = await prisma.task.create({
      data: {
        userId: createdUser.id,
        repoUrl: 'https://github.com/example/test-repo.git',
        prompt: 'Fix test suite issue in component',
        status: TaskStatus.PENDING,
      },
    });
    assert.strictEqual(createdTask.userId, createdUser.id);
    assert.strictEqual(createdTask.status, TaskStatus.PENDING);
    console.log(`✓ OK (Task ID: ${createdTask.id})`);

    // 5. Create Related Session
    process.stdout.write('⏳ Creating session linked to task... ');
    const createdSession = await prisma.session.create({
      data: {
        taskId: createdTask.id,
        logs: 'Session initialized for test verification.',
      },
    });
    assert.strictEqual(createdSession.taskId, createdTask.id);
    console.log(`✓ OK (Session ID: ${createdSession.id})`);

    // 6. Test Cascading Cleanup
    process.stdout.write('⏳ Testing cleanup and cascading delete... ');
    await prisma.user.delete({
      where: { id: createdUser.id },
    });

    const userAfterDelete = await prisma.user.findUnique({
      where: { id: createdUser.id },
    });
    assert.strictEqual(userAfterDelete, null, 'User should be deleted');

    // Task onDelete is SetNull for user, so cleanup the task explicitly
    await prisma.task.delete({
      where: { id: createdTask.id },
    });

    // Session onDelete is Cascade for task, so session should be automatically gone
    const sessionAfterDelete = await prisma.session.findUnique({
      where: { id: createdSession.id },
    });
    assert.strictEqual(sessionAfterDelete, null, 'Session should be cascade deleted');
    console.log('✓ OK (All test records cleaned up)');

    console.log('\n✅ All Database & Prisma tests passed successfully!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Database test failed with error:');
    console.error(error);
    return false;
  }
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('db.test')) {
  runDbTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

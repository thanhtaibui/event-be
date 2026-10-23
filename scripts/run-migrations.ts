import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from '../src/configs/database.config';

async function runMigrationsCli() {
  loadLocalEnv();

  const config = databaseConfig() as DataSourceOptions & { url?: string; host?: string; database?: string };
  const targetHost = config.url
    ? new URL(config.url).hostname
    : config.host || 'localhost';
  const targetDb = config.url
    ? new URL(config.url).pathname.replace(/^\//, '')
    : config.database || 'default';

  console.log(`[MIGRATION RUNNER] Target Host: ${targetHost}`);
  console.log(`[MIGRATION RUNNER] Target Database: ${targetDb}`);

  if (targetHost.includes('rds.amazonaws.com')) {
    throw new Error(
      `[SAFETY BLOCK] Target database is pointing to AWS RDS (${targetHost}). Running migrations against AWS RDS is strictly prohibited. Please update DATABASE_URL in .env with your Neon PostgreSQL connection string first.`,
    );
  }

  let migrationConfig = { ...config };
  if (config.url && config.url.includes('-pooler.')) {
    console.log(
      '[MIGRATION RUNNER] Detected Neon pooled connection. Auto-switching to Direct connection for safe DDL execution...',
    );
    migrationConfig.url = config.url.replace('-pooler.', '.');
    console.log(
      `[MIGRATION RUNNER] Direct Host: ${new URL(migrationConfig.url).hostname}`,
    );
  }

  console.log('[MIGRATION RUNNER] Initializing database connection...');
  const dataSource = new DataSource(migrationConfig);
  await dataSource.initialize();

  try {
    console.log('[MIGRATION RUNNER] Running pending migrations...');
    const executed = await dataSource.runMigrations({ transaction: 'all' });
    if (executed.length === 0) {
      console.log('[MIGRATION RUNNER] No pending migrations found.');
    } else {
      console.log(
        `[MIGRATION RUNNER] Successfully executed ${executed.length} migration(s):`,
      );
      for (const m of executed) {
        console.log(` - ${m.name}`);
      }
    }
  } finally {
    await dataSource.destroy();
    console.log('[MIGRATION RUNNER] Connection closed.');
  }
}

function loadLocalEnv(): void {
  const loader = process.loadEnvFile;
  if (typeof loader === 'function') {
    try {
      loader('.env');
    } catch {
      // Ignored if .env does not exist or environment variables already injected
    }
  }
}

if (require.main === module) {
  runMigrationsCli().catch((err: Error) => {
    console.error('[MIGRATION RUNNER] Error running migrations:', err.message);
    process.exit(1);
  });
}

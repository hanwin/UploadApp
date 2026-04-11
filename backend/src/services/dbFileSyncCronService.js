const cron = require('node-cron');
const { syncDbWithFilesystem } = require('../../scripts/sync-db-with-filesystem');

const DEFAULT_CRON = '17 3 * * *';
let isRunning = false;

const runSyncJob = async (trigger) => {
  if (isRunning) {
    console.log(`[db-file-sync] Skip ${trigger}: previous run still active`);
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    console.log(`[db-file-sync] Starting sync (${trigger})`);
    await syncDbWithFilesystem({ dryRun: false, logPrefix: '[db-file-sync]' });
    const elapsed = Date.now() - startedAt;
    console.log(`[db-file-sync] Completed in ${elapsed} ms`);
  } catch (error) {
    console.error(`[db-file-sync] Failed: ${error.message}`);
  } finally {
    isRunning = false;
  }
};

const startDbFileSyncCron = () => {
  const enabled = String(process.env.DB_FILE_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[db-file-sync] Cron disabled via DB_FILE_SYNC_ENABLED=false');
    return;
  }

  const cronExpr = process.env.DB_FILE_SYNC_CRON || DEFAULT_CRON;
  if (!cron.validate(cronExpr)) {
    console.error(`[db-file-sync] Invalid cron expression: "${cronExpr}"`);
    return;
  }

  const timezone = process.env.DB_FILE_SYNC_TZ || process.env.TZ || 'Europe/Stockholm';
  cron.schedule(cronExpr, () => {
    runSyncJob('cron');
  }, { timezone });

  console.log(`[db-file-sync] Cron started: "${cronExpr}" (${timezone})`);

  const runOnStartup = String(process.env.DB_FILE_SYNC_RUN_ON_STARTUP || 'false').toLowerCase() === 'true';
  if (runOnStartup) {
    runSyncJob('startup');
  }
};

module.exports = {
  startDbFileSyncCron
};

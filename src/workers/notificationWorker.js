const { pool } = require('../db/pool');
const { env } = require('../config/env');
const jobRepository = require('../repositories/jobRepository');
const notificationService = require('../services/notificationService');

async function processOneJob() {
  const job = await jobRepository.claimNextJob();

  if (!job) {
    return false;
  }

  try {
    await notificationService.sendSubmissionNotification(job.payload);
    await jobRepository.markCompleted(job.id);
    console.log('Notification job completed', { jobId: job.id, attempts: job.attempts });
  } catch (error) {
    const exhausted = await jobRepository.markFailed(job, error.message);
    if (exhausted) {
      console.error('ALERT notification job exhausted retries', {
        jobId: job.id,
        attempts: job.attempts,
        error: error.message
      });
    } else {
      console.warn('Notification job scheduled for retry', {
        jobId: job.id,
        attempts: job.attempts,
        error: error.message
      });
    }
  }

  return true;
}

async function runLoop() {
  console.log('Notification worker started');
  for (;;) {
    const processed = await processOneJob();
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

if (require.main === module) {
  runLoop().catch((error) => {
    console.error('Notification worker crashed', error.message);
    process.exitCode = 1;
  });

  process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
  });
}

module.exports = {
  processOneJob
};


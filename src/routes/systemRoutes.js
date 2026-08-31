const express = require('express');
const { AppError, asyncHandler } = require('../errors');
const { processOneJob } = require('../workers/notificationWorker');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    service: 'flyrank-capstone-widget-platform',
    status: 'ok',
    health: '/health',
    widget_bundle: '/widget.v1.js?id=tenant-a-demo-signup',
    public_config: '/widgets/tenant-a-demo-signup/config',
    dashboard: ['/api/dashboard/submissions', '/api/dashboard/stats']
  });
});

function authorizeCron(req, _res, next) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const expectedHeader = `Bearer ${secret}`;
    if (req.get('authorization') !== expectedHeader) {
      return next(new AppError(401, 'unauthorized', 'Invalid cron authorization'));
    }
    return next();
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return next(
      new AppError(
        503,
        'cron_secret_required',
        'Set CRON_SECRET before enabling hosted job processing'
      )
    );
  }

  return next();
}

router.get(
  '/api/cron/process-jobs',
  authorizeCron,
  asyncHandler(async (req, res) => {
    const requestedLimit = Number(req.query.limit || 5);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 10)
      : 5;
    let processed = 0;

    for (let index = 0; index < limit; index += 1) {
      const didProcessJob = await processOneJob();
      if (!didProcessJob) {
        break;
      }
      processed += 1;
    }

    res.json({
      ok: true,
      processed
    });
  })
);

module.exports = router;

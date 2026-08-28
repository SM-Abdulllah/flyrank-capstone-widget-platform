const express = require('express');
const { asyncHandler } = require('../errors');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { listSubmissionsQuerySchema } = require('../validation/dashboardSchemas');
const dashboardService = require('../services/dashboardService');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/submissions',
  validate(listSubmissionsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const submissions = await dashboardService.listSubmissions(req.user.tenantId, req.query);
    res.json({ submissions });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await dashboardService.getStats(req.user.tenantId);
    res.json({ stats });
  })
);

module.exports = router;


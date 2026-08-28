const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { AppError, asyncHandler } = require('../errors');
const { validate } = require('../middleware/validate');
const { submissionPayloadSchema } = require('../validation/submissionSchemas');
const widgetService = require('../services/widgetService');
const submissionService = require('../services/submissionService');

const router = express.Router();

const publicCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id'],
  credentials: false
});

const submissionRateLimitStore = new rateLimit.MemoryStore();

const submissionLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  store: submissionRateLimitStore,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many submissions; slow down.'
    }
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: {
        code: 'rate_limited',
        message: 'Too many submissions; slow down.',
        request_id: req.id
      }
    });
  }
});

router.get('/widget.v1.js', publicCors, (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, '..', 'public', 'widget.v1.js'), (error) => {
    if (error) {
      next(error);
    }
  });
});

router.get(
  '/widgets/:publicId/config',
  publicCors,
  asyncHandler(async (req, res) => {
    const config = await widgetService.getPublicConfig(req.params.publicId);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    res.json(config);
  })
);

router.options('/submissions', publicCors);

router.post(
  '/submissions',
  publicCors,
  submissionLimiter,
  validate(submissionPayloadSchema),
  asyncHandler(async (req, res) => {
    const result = await submissionService.createPublicSubmission(req.body, {
      ipAddress: req.ip
    });

    if (result.spam) {
      return res.status(202).json({
        accepted: true
      });
    }

    return res.status(result.duplicate ? 200 : 201).json(result);
  })
);

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.all('/submissions', (_req, _res, next) => {
  next(new AppError(405, 'method_not_allowed', 'Method not allowed'));
});

router.resetSubmissionRateLimit = () => submissionRateLimitStore.resetAll();

module.exports = router;

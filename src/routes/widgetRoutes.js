const express = require('express');
const { asyncHandler } = require('../errors');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { widgetPayloadSchema, widgetIdParamSchema } = require('../validation/widgetSchemas');
const widgetService = require('../services/widgetService');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  validate(widgetPayloadSchema),
  asyncHandler(async (req, res) => {
    const widget = await widgetService.createWidget(req.user.tenantId, req.body);
    res.status(201).json({ widget });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const widgets = await widgetService.listWidgets(req.user.tenantId);
    res.json({ widgets });
  })
);

router.get(
  '/:id',
  validate(widgetIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const widget = await widgetService.getWidget(req.user.tenantId, req.params.id);
    res.json({ widget });
  })
);

router.put(
  '/:id',
  validate(widgetIdParamSchema, 'params'),
  validate(widgetPayloadSchema),
  asyncHandler(async (req, res) => {
    const widget = await widgetService.updateWidget(req.user.tenantId, req.params.id, req.body);
    res.json({ widget });
  })
);

router.delete(
  '/:id',
  validate(widgetIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await widgetService.deleteWidget(req.user.tenantId, req.params.id);
    res.status(204).send();
  })
);

module.exports = router;


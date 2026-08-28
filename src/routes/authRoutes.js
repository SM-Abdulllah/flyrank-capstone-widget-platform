const express = require('express');
const { asyncHandler } = require('../errors');
const { validate } = require('../middleware/validate');
const { loginSchema } = require('../validation/authSchemas');
const authService = require('../services/authService');

const router = express.Router();

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  })
);

module.exports = router;


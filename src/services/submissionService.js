const crypto = require('crypto');
const widgetRepository = require('../repositories/widgetRepository');
const submissionRepository = require('../repositories/submissionRepository');
const jobRepository = require('../repositories/jobRepository');
const geoService = require('./geoService');
const { AppError } = require('../errors');

function normalizeValue(field, value) {
  if (value === undefined || value === null || value === '') {
    if (field.required) {
      throw new AppError(400, 'invalid_submission', `${field.name} is required`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError(400, 'invalid_submission', `${field.name} must be a string`);
  }

  const trimmed = value.trim();

  if (field.required && trimmed.length === 0) {
    throw new AppError(400, 'invalid_submission', `${field.name} is required`);
  }

  if (trimmed.length > field.maxLength) {
    throw new AppError(
      400,
      'invalid_submission',
      `${field.name} must be at most ${field.maxLength} characters`
    );
  }

  if (field.type === 'email') {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      throw new AppError(400, 'invalid_submission', `${field.name} must be a valid email`);
    }
  }

  return trimmed;
}

function validateAgainstWidgetFields(widget, submittedData) {
  const allowed = new Map(widget.fields.map((field) => [field.name, field]));
  const sanitized = {};

  for (const key of Object.keys(submittedData)) {
    if (!allowed.has(key)) {
      throw new AppError(400, 'invalid_submission', `Unknown field: ${key}`);
    }
  }

  for (const field of widget.fields) {
    const value = normalizeValue(field, submittedData[field.name]);
    if (value !== null) {
      sanitized[field.name] = value;
    }
  }

  return sanitized;
}

async function createPublicSubmission(payload, context) {
  const publicId = payload.public_id || payload.widget_id;
  const widget = await widgetRepository.findByPublicId(publicId);

  if (!widget) {
    throw new AppError(404, 'not_found', 'Widget not found');
  }

  if (payload.website && payload.website.trim().length > 0) {
    return {
      accepted: true,
      stored: false,
      spam: true
    };
  }

  const submittedData = validateAgainstWidgetFields(widget, payload.submitted_data);
  const idempotencyKey = payload.idempotency_key || crypto.randomUUID();
  const geo = await geoService.lookup(context.ipAddress);

  const { submission, created } = await submissionRepository.createSubmission({
    tenantId: widget.tenant_id,
    widgetId: widget.id,
    idempotencyKey,
    submittedData,
    ipAddress: context.ipAddress,
    country: geo.country,
    city: geo.city,
    geoProvider: geo.geo_provider
  });

  if (created) {
    await jobRepository.enqueueNotification({
      tenantId: widget.tenant_id,
      submissionId: submission.id,
      payload: {
        submission_id: submission.id,
        widget_public_id: widget.public_id,
        side_effect_mode: process.env.SIDE_EFFECT_MODE || 'success',
        submitted_data: submittedData
      }
    });
  }

  return {
    accepted: true,
    stored: true,
    duplicate: !created,
    submission: {
      id: submission.id,
      widget_id: widget.public_id,
      geo_provider: submission.geo_provider,
      country: submission.country,
      city: submission.city,
      created_at: submission.created_at
    }
  };
}

module.exports = {
  createPublicSubmission,
  validateAgainstWidgetFields
};

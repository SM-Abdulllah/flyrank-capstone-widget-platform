const crypto = require('crypto');
const { env } = require('../config/env');
const widgetRepository = require('../repositories/widgetRepository');
const { AppError } = require('../errors');

function makePublicId() {
  return crypto.randomBytes(9).toString('base64url');
}

function embedSnippet(publicId) {
  return `<script src="${env.PUBLIC_BASE_URL}/widget.v1.js?id=${publicId}"></script>`;
}

function toOwnerResponse(widget) {
  return {
    ...widget,
    embed_snippet: embedSnippet(widget.public_id)
  };
}

function toPublicConfig(widget) {
  return {
    id: widget.public_id,
    type: widget.type,
    title: widget.title,
    description: widget.description,
    fields: widget.fields,
    button_text: widget.button_text,
    display_options: widget.display_options
  };
}

async function createWidget(tenantId, payload) {
  const widget = await widgetRepository.createWidget(tenantId, {
    ...payload,
    public_id: makePublicId()
  });

  return toOwnerResponse(widget);
}

async function listWidgets(tenantId) {
  const widgets = await widgetRepository.listWidgets(tenantId);
  return widgets.map(toOwnerResponse);
}

async function getWidget(tenantId, id) {
  const widget = await widgetRepository.getWidgetById(tenantId, id);

  if (!widget) {
    throw new AppError(404, 'not_found', 'Widget not found');
  }

  return toOwnerResponse(widget);
}

async function updateWidget(tenantId, id, payload) {
  const widget = await widgetRepository.updateWidget(tenantId, id, payload);

  if (!widget) {
    throw new AppError(404, 'not_found', 'Widget not found');
  }

  return toOwnerResponse(widget);
}

async function deleteWidget(tenantId, id) {
  const deleted = await widgetRepository.deleteWidget(tenantId, id);

  if (!deleted) {
    throw new AppError(404, 'not_found', 'Widget not found');
  }
}

async function getPublicConfig(publicId) {
  const widget = await widgetRepository.findByPublicId(publicId);

  if (!widget) {
    throw new AppError(404, 'not_found', 'Widget not found');
  }

  return toPublicConfig(widget);
}

module.exports = {
  createWidget,
  listWidgets,
  getWidget,
  updateWidget,
  deleteWidget,
  getPublicConfig,
  toOwnerResponse,
  toPublicConfig,
  embedSnippet
};


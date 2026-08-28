const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { AppError } = require('../errors');

function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'unauthenticated', 'Authentication required'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub || !payload.tenant_id) {
      throw new Error('missing claims');
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tenant_id
    };

    return next();
  } catch (_error) {
    return next(new AppError(401, 'unauthenticated', 'Authentication required'));
  }
}

module.exports = {
  requireAuth
};


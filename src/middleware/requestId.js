const crypto = require('crypto');

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming || crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

module.exports = {
  requestId
};


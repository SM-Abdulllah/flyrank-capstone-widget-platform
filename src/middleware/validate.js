const { AppError } = require('../errors');
const { formatZodError } = require('./errorHandler');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new AppError(400, 'invalid_request', 'Invalid request', formatZodError(result.error))
      );
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = {
  validate
};


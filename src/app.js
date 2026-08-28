const express = require('express');
const helmet = require('helmet');
const { env } = require('./config/env');
const { requestId } = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errorHandler');
const { AppError } = require('./errors');
const authRoutes = require('./routes/authRoutes');
const widgetRoutes = require('./routes/widgetRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const publicRoutes = require('./routes/publicRoutes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: 'cross-origin'
      }
    })
  );
  app.use(express.json({ limit: env.BODY_LIMIT }));

  app.use(publicRoutes);
  app.use('/auth', authRoutes);
  app.use('/api/widgets', widgetRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use((_req, _res, next) => {
    next(new AppError(404, 'not_found', 'Route not found'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};


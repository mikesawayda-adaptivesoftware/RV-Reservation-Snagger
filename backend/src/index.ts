import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { logger } from './services/logger';

// Import routes
import authRoutes from './api/auth';
import alertRoutes from './api/alerts';
import subscriptionRoutes from './api/subscription';
import parkRoutes from './api/parks';
import webhookRoutes from './api/webhooks';

// Import scheduler
import { startScheduler } from './scheduler';

const app = express();

// Path to frontend static files (in production)
const publicPath = path.join(__dirname, '..', 'public');

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Webhook routes need raw body for Stripe signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// JSON parsing for all other routes
app.use(express.json());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/parks', parkRoutes);

// Serve static frontend files in production
if (config.nodeEnv === 'production') {
  // Serve static files from the public directory
  app.use(express.static(publicPath));
  
  // For any non-API routes, serve the Angular app (SPA routing)
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler (only for API routes in production, since frontend handles its own routing)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  } else if (config.nodeEnv !== 'production') {
    res.status(404).json({
      success: false,
      error: 'Not found',
    });
  }
  // In production, non-API routes are handled by the SPA routing above
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  
  // Start the scraper scheduler
  startScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

export default app;

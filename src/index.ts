import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { Env } from './types';
import { APIHandlers } from './handlers';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-timestamp', 'x-signature', 'x-device-token'],
  maxAge: 86400
}));

// Error handling middleware
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500);
});

// Initialize handlers
app.use('*', async (c, next) => {
  c.set('handlers', new APIHandlers(c.env));
  await next();
});

// Routes
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'FinPin API Server',
    version: c.env.API_VERSION,
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      register: '/api/v1/device/register',
      parse: '/api/v1/parse/expense',
      device: '/api/v1/device/:deviceId',
      stats: '/api/v1/stats'
    }
  });
});

// Health check
app.get('/api/v1/health', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.healthCheck(c);
});

// Device registration
app.post('/api/v1/device/register', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.registerDevice(c);
});

// Expense parsing
app.post('/api/v1/parse/expense', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.parseExpense(c);
});

// Get device information
app.get('/api/v1/device/:deviceId', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.getDeviceInfo(c);
});

// API statistics
app.get('/api/v1/stats', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.getStats(c);
});

// Handle CORS preflight
app.options('*', async (c) => {
  const handlers = c.get('handlers') as APIHandlers;
  return handlers.handleCORS(c);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  }, 404);
});

export default app;

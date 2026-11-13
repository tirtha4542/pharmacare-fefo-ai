const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /health and GET /api/health - Comprehensive System Health Check
exports.getHealth = asyncHandler(async (req, res) => {
  const dbName = process.env.DB_NAME || 'pharmacy_db';
  const startTime = Date.now();

  const [tables] = await pool.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
    [dbName]
  );

  const dbLatencyMs = Date.now() - startTime;
  const tableCount = tables.length;
  const isHealthy = tableCount === 8;

  const mem = process.memoryUsage();

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'OK' : 'DEGRADED',
    tableCount,
    expectedTables: 8,
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: 'connected',
      latencyMs: dbLatencyMs,
      tableCount,
      expectedTables: 8
    },
    system: {
      nodeVersion: process.version,
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
      rssMB: (mem.rss / 1024 / 1024).toFixed(2)
    },
    tables: tables.map((t) => t.TABLE_NAME || t.table_name),
    timestamp: new Date().toISOString()
  });
});

// GET /health/live - Container Liveness Probe
exports.getLiveness = (req, res) => {
  res.status(200).json({ status: 'live' });
};

// GET /health/ready - Container Readiness Probe (checks DB ping)
exports.getReadiness = asyncHandler(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', database: 'disconnected', error: err.message });
  }
});

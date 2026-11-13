require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/db');

const PORT = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Production Environment Sanity Check
function validateConfig() {
  const issues = [];
  if (!process.env.JWT_SECRET) {
    issues.push('JWT_SECRET environment variable is not defined.');
  } else if (process.env.JWT_SECRET.length < 16) {
    issues.push('JWT_SECRET is too short (must be at least 16 characters for production security).');
  }

  if (!process.env.DB_NAME) issues.push('DB_NAME is required.');
  if (!process.env.DB_USER) issues.push('DB_USER is required.');

  if (issues.length > 0) {
    console.error('CRITICAL CONFIGURATION ERROR(S):');
    issues.forEach(i => console.error(`  - ${i}`));
    if (NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

async function startServer() {
  validateConfig();

  try {
    // Verify database connectivity
    const connection = await pool.getConnection();
    const [dbInfo] = await connection.query('SELECT VERSION() AS version, CURRENT_USER() AS user');
    console.log(`Connected to MySQL ${dbInfo[0].version} as ${dbInfo[0].user} on DB "${process.env.DB_NAME || 'pharmacy_db'}"`);
    connection.release();

    const server = app.listen(PORT, () => {
      console.log(`PharmaCare Pro server [${NODE_ENV}] listening on port ${PORT}`);
      console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`Web application: http://localhost:${PORT}/`);
    });

    // Graceful shutdown handling
    let isShuttingDown = false;
    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Gracefully shutting down HTTP server...`);

      // Force shutdown timer after 10s if connections refuse to terminate
      const forceExitTimer = setTimeout(() => {
        console.error('Forcefully terminating process after 10s timeout.');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.close(async () => {
        try {
          await pool.end();
          console.log('MySQL connection pool cleanly drained and closed.');
          clearTimeout(forceExitTimer);
          process.exit(0);
        } catch (err) {
          console.error('Error while closing database pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Global Process Error Handlers
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception thrown:', err);
      shutdown('uncaughtException');
    });

  } catch (err) {
    console.error('Failed to initialize and start server:', err.message);
    process.exit(1);
  }
}

startServer();

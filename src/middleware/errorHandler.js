const AppError = require('../utils/AppError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;
  error.errno = err.errno;
  error.sqlState = err.sqlState;

  // Handle MySQL Foreign Key constraint failure on delete/update (e.g. category or medicine referenced elsewhere)
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
    const message = 'Conflict: Cannot delete this item because it is referenced by existing records.';
    error = new AppError(message, 409);
  }

  // Handle MySQL Foreign Key missing referenced row
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    const message = 'Bad Request: Referenced entity does not exist.';
    error = new AppError(message, 400);
  }

  // Handle MySQL Duplicate Entry (e.g. duplicate email or category name)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    const message = 'Conflict: A record with this unique identifier or value already exists.';
    error = new AppError(message, 409);
  }

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File size exceeds the 5 MB maximum limit.', 400);
  } else if (err.name === 'MulterError') {
    error = new AppError(`File upload error: ${err.message}`, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Authentication failed.', 401);
  } else if (err.name === 'TokenExpiredError') {
    error = new AppError('Token has expired. Please log in again.', 401);
  }

  // Determine response status and message
  const statusCode = error.statusCode || err.statusCode || 500;
  const isOperational = error.isOperational || err.isOperational || false;

  const response = {
    success: false,
    message: isOperational ? (error.message || err.message) : 'An unexpected internal server error occurred.'
  };

  if (error.details || err.details) {
    response.details = error.details || err.details;
  }

  // Log non-operational (unexpected) errors to console for server debugging
  if (!isOperational) {
    console.error('UNEXPECTED ERROR:', err);
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;


const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. Please provide a valid Bearer token.', 401));
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_pharmacy_jwt_key_2026_xyz');
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Authentication failed.', 401));
  }

  // Check if user still exists
  const [users] = await pool.query(
    'SELECT user_id, name, email, phone, address, role, created_at FROM users WHERE user_id = ?',
    [decoded.userId || decoded.user_id]
  );

  if (users.length === 0) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  req.user = users[0];
  next();
});

module.exports = protect;


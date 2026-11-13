const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'super_secret_pharmacy_jwt_key_2026_xyz',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// POST /api/auth/register (Role is always customer; client cannot choose role)
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone, address } = req.body;

  // Check if email already registered
  const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return next(new AppError('Email is already registered. Please login or use a different email.', 409));
  }

  // Hash password with bcrypt cost 10
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Insert user with forced role = 'customer'
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, phone || null, address || null, 'customer']
  );

  const userId = result.insertId;
  const token = generateToken(userId, 'customer');

  // Fetch created user without password_hash
  const [users] = await pool.query(
    'SELECT user_id, name, email, phone, address, role, created_at FROM users WHERE user_id = ?',
    [userId]
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token,
      user: users[0]
    }
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const [users] = await pool.query(
    'SELECT user_id, name, email, password_hash, phone, address, role, created_at FROM users WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    return next(new AppError('Invalid email or password.', 401));
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password.', 401));
  }

  const token = generateToken(user.user_id, user.role);

  // Exclude password_hash from response
  delete user.password_hash;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user
    }
  });
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
});


const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/users (admin)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const [users] = await pool.query(
    'SELECT user_id, name, email, phone, address, role, created_at FROM users ORDER BY user_id ASC'
  );

  res.status(200).json({
    success: true,
    data: {
      users,
      count: users.length
    }
  });
});

// GET /api/users/:id (admin)
exports.getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const [users] = await pool.query(
    'SELECT user_id, name, email, phone, address, role, created_at FROM users WHERE user_id = ?',
    [id]
  );

  if (users.length === 0) {
    return next(new AppError(`User with ID ${id} not found`, 404));
  }

  res.status(200).json({
    success: true,
    data: {
      user: users[0]
    }
  });
});

// PATCH /api/users/:id/role (admin)
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;

  // Check user exists
  const [existing] = await pool.query('SELECT user_id, email FROM users WHERE user_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`User with ID ${id} not found`, 404));
  }

  // Update role
  await pool.query('UPDATE users SET role = ? WHERE user_id = ?', [role, id]);

  const [updated] = await pool.query(
    'SELECT user_id, name, email, phone, address, role, created_at FROM users WHERE user_id = ?',
    [id]
  );

  res.status(200).json({
    success: true,
    message: `User role successfully updated to ${role}`,
    data: {
      user: updated[0]
    }
  });
});

// DELETE /api/users/:id (admin)
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (parseInt(id, 10) === req.user.user_id) {
    return next(new AppError('You cannot delete your own admin account.', 400));
  }

  const [existing] = await pool.query('SELECT user_id, name FROM users WHERE user_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`User with ID ${id} not found`, 404));
  }

  // Delete user - if referenced, foreign key error is caught by errorHandler (or check first)
  const [prescriptions] = await pool.query('SELECT COUNT(*) as count FROM prescriptions WHERE user_id = ? OR reviewed_by = ?', [id, id]);
  const [orders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE user_id = ?', [id]);

  if (prescriptions[0].count > 0 || orders[0].count > 0) {
    return next(new AppError('Cannot delete user: user is referenced in existing prescriptions or orders.', 409));
  }

  await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

  res.status(200).json({
    success: true,
    message: `User '${existing[0].name}' (ID: ${id}) deleted successfully`
  });
});


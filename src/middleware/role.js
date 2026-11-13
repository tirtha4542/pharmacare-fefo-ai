const AppError = require('../utils/AppError');

/**
 * Middleware to restrict route access by role
 * @param  {...string} roles Allowed roles ('customer', 'pharmacist', 'admin')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: You do not have permission to perform this action. Required role: ${roles.join(' or ')}`,
          403
        )
      );
    }
    next();
  };
};

module.exports = restrictTo;


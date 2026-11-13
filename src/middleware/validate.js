const AppError = require('../utils/AppError');

/**
 * Validates request data using a Joi schema
 * @param {import('joi').Schema} schema
 * @param {'body' | 'query' | 'params'} property
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message.replace(/['"]/g, ''),
        path: detail.path
      }));
      const message = details.map((d) => d.message).join('; ');
      return next(new AppError(`Validation error: ${message}`, 400, details));
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;


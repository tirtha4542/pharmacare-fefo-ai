const Joi = require('joi');

const createBatchSchema = Joi.object({
  medicine_id: Joi.number().integer().positive().required().messages({
    'number.base': 'medicine_id must be a valid number',
    'any.required': 'medicine_id is required'
  }),
  batch_no: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'batch_no is required',
    'string.max': 'batch_no cannot exceed 50 characters'
  }),
  quantity: Joi.number().integer().min(0).required().messages({
    'number.base': 'quantity must be an integer',
    'number.min': 'quantity cannot be negative',
    'any.required': 'quantity is required'
  }),
  expiry_date: Joi.date().iso().required().messages({
    'date.base': 'expiry_date must be a valid date (YYYY-MM-DD)',
    'any.required': 'expiry_date is required'
  })
});

const updateBatchSchema = Joi.object({
  batch_no: Joi.string().trim().min(1).max(50).optional(),
  quantity: Joi.number().integer().min(0).optional(),
  expiry_date: Joi.date().iso().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const queryExpiringSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30)
});

const queryBatchSchema = Joi.object({
  medicineId: Joi.number().integer().positive().optional()
});

module.exports = {
  createBatchSchema,
  updateBatchSchema,
  queryExpiringSchema,
  queryBatchSchema
};


const Joi = require('joi');

const createMedicineSchema = Joi.object({
  category_id: Joi.number().integer().positive().required().messages({
    'number.base': 'category_id must be a valid number',
    'any.required': 'category_id is required'
  }),
  name: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Medicine name is required',
    'string.max': 'Medicine name cannot exceed 150 characters'
  }),
  generic_name: Joi.string().trim().max(150).allow('', null).optional(),
  manufacturer: Joi.string().trim().max(120).allow('', null).optional(),
  price: Joi.number().min(0).precision(2).required().messages({
    'number.base': 'Price must be a valid number',
    'number.min': 'Price cannot be negative',
    'any.required': 'Price is required'
  }),
  requires_prescription: Joi.boolean().default(false)
});

const updateMedicineSchema = Joi.object({
  category_id: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().min(2).max(150).optional(),
  generic_name: Joi.string().trim().max(150).allow('', null).optional(),
  manufacturer: Joi.string().trim().max(120).allow('', null).optional(),
  price: Joi.number().min(0).precision(2).optional(),
  requires_prescription: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const queryMedicineSchema = Joi.object({
  search: Joi.string().trim().allow('').optional(),
  category: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).allow('').optional(),
  requiresPrescription: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

module.exports = {
  createMedicineSchema,
  updateMedicineSchema,
  queryMedicineSchema
};


const Joi = require('joi');

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('customer', 'pharmacist', 'admin').required().messages({
    'any.only': 'Role must be one of: customer, pharmacist, admin',
    'any.required': 'Role is required'
  })
});

module.exports = {
  updateRoleSchema
};


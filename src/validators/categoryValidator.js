const Joi = require('joi');

const categorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required().messages({
    'string.empty': 'Category name is required',
    'string.min': 'Category name must be at least 2 characters',
    'string.max': 'Category name cannot exceed 80 characters'
  })
});

module.exports = {
  categorySchema
};


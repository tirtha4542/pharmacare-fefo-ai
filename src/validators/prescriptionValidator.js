const Joi = require('joi');

const reviewPrescriptionSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required().messages({
    'any.only': 'Status must be either "approved" or "rejected"',
    'any.required': 'Review status is required'
  })
});

const queryPrescriptionSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected').optional()
});

module.exports = {
  reviewPrescriptionSchema,
  queryPrescriptionSchema
};


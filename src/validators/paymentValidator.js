const Joi = require('joi');

const createPaymentSchema = Joi.object({
  order_id: Joi.number().integer().positive().required().messages({
    'number.base': 'order_id must be a valid number',
    'any.required': 'order_id is required'
  }),
  method: Joi.string()
    .valid('cash_on_delivery', 'bkash', 'nagad', 'card')
    .optional()
    .messages({
      'any.only': 'method must be one of: cash_on_delivery, bkash, nagad, card'
    })
});

module.exports = {
  createPaymentSchema
};


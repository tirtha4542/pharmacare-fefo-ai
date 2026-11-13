const Joi = require('joi');

const createOrderSchema = Joi.object({
  delivery_address: Joi.string().trim().min(5).max(255).required().messages({
    'string.empty': 'delivery_address is required',
    'string.min': 'delivery_address must be at least 5 characters',
    'string.max': 'delivery_address cannot exceed 255 characters'
  }),
  prescription_id: Joi.number().integer().positive().allow(null).optional(),
  payment_method: Joi.string()
    .valid('cash_on_delivery', 'bkash', 'nagad', 'card')
    .default('cash_on_delivery')
    .messages({
      'any.only': 'payment_method must be one of: cash_on_delivery, bkash, nagad, card'
    }),
  items: Joi.array()
    .items(
      Joi.object({
        medicine_id: Joi.number().integer().positive().required().messages({
          'any.required': 'medicine_id is required for each item'
        }),
        quantity: Joi.number().integer().min(1).required().messages({
          'number.min': 'quantity must be at least 1',
          'any.required': 'quantity is required for each item'
        })
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Order must contain at least one item',
      'any.required': 'items array is required'
    })
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'shipped', 'delivered', 'cancelled')
    .required()
    .messages({
      'any.only': 'Status must be one of: confirmed, shipped, delivered, cancelled',
      'any.required': 'Order status is required'
    })
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema
};


const Joi = require('joi');

const querySalesSchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional()
});

const queryLowStockSchema = Joi.object({
  threshold: Joi.number().integer().min(1).default(10)
});

const queryTopMedicinesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(5)
});

module.exports = {
  querySalesSchema,
  queryLowStockSchema,
  queryTopMedicinesSchema
};


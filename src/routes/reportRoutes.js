const express = require('express');
const reportController = require('../controllers/reportController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const {
  querySalesSchema,
  queryLowStockSchema,
  queryTopMedicinesSchema
} = require('../validators/reportValidator');

const router = express.Router();

// All reporting endpoints require admin role
router.use(protect, restrictTo('admin'));

router.get('/sales', validate(querySalesSchema, 'query'), reportController.getSalesReport);
router.get('/low-stock', validate(queryLowStockSchema, 'query'), reportController.getLowStockReport);
router.get('/top-medicines', validate(queryTopMedicinesSchema, 'query'), reportController.getTopMedicinesReport);

module.exports = router;


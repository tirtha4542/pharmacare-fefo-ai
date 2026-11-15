const express = require('express');
const paymentController = require('../controllers/paymentController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const { createPaymentSchema } = require('../validators/paymentValidator');

const router = express.Router();

router.use(protect);

// Customer, Pharmacist, and Admin can process payment for their order
router.post('/', restrictTo('customer', 'pharmacist', 'admin'), validate(createPaymentSchema), paymentController.processPayment);

// View payment for an order (owner customer, pharmacist, admin)
router.get('/order/:orderId', paymentController.getPaymentByOrderId);

module.exports = router;


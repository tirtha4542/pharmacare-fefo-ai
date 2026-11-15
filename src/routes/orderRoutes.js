const express = require('express');
const orderController = require('../controllers/orderController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const {
  createOrderSchema,
  updateOrderStatusSchema
} = require('../validators/orderValidator');

const router = express.Router();

router.use(protect);

// Customer, Pharmacist, and Admin can place orders and check own personal orders
router.post('/', restrictTo('customer', 'pharmacist', 'admin'), validate(createOrderSchema), orderController.createOrder);
router.get('/my', restrictTo('customer', 'pharmacist', 'admin'), orderController.getMyOrders);

// Pharmacist/Admin get all orders
router.get('/', restrictTo('pharmacist', 'admin'), orderController.getAllOrders);

// View specific order (owner customer, pharmacist, admin)
router.get('/:id', orderController.getOrderById);

// Update order status (pharmacist, admin)
router.patch('/:id/status', restrictTo('pharmacist', 'admin'), validate(updateOrderStatusSchema), orderController.updateOrderStatus);

module.exports = router;


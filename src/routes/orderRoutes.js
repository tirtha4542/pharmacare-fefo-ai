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

// Customer place order and check own orders
router.post('/', restrictTo('customer'), validate(createOrderSchema), orderController.createOrder);
router.get('/my', restrictTo('customer'), orderController.getMyOrders);

// Pharmacist/Admin get all orders
router.get('/', restrictTo('pharmacist', 'admin'), orderController.getAllOrders);

// View specific order (owner customer, pharmacist, admin)
router.get('/:id', orderController.getOrderById);

// Update order status (pharmacist, admin)
router.patch('/:id/status', restrictTo('pharmacist', 'admin'), validate(updateOrderStatusSchema), orderController.updateOrderStatus);

module.exports = router;


const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/payments (customer pays own order)
// Business Rule 7: Payment cannot be marked paid twice. Paying an order sets paid_at.
// Business Rule 8: A customer can only see and act on their own prescriptions, orders, and payments.
exports.processPayment = asyncHandler(async (req, res, next) => {
  const { order_id, method } = req.body;
  const user = req.user;

  // Verify order exists
  const [orders] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
  if (orders.length === 0) {
    return next(new AppError(`Order with ID ${order_id} not found`, 404));
  }

  const order = orders[0];

  // Verify ownership
  if (user.role === 'customer' && order.user_id !== user.user_id) {
    return next(new AppError('Forbidden: You can only make payments for your own orders.', 403));
  }

  // Cannot pay for cancelled order
  if (order.status === 'cancelled') {
    return next(new AppError('Cannot pay for an order that has been cancelled.', 400));
  }

  // Check payment record
  const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order_id]);
  if (payments.length === 0) {
    return next(new AppError(`No payment record found for order ${order_id}`, 404));
  }

  const payment = payments[0];

  // Business Rule 7: Cannot be marked paid twice
  if (payment.status === 'paid') {
    return next(new AppError('Payment has already been marked as paid for this order.', 400));
  }

  const finalMethod = method || payment.method || 'cash_on_delivery';

  // Mark as paid and set paid_at
  await pool.query(
    'UPDATE payments SET status = "paid", paid_at = CURRENT_TIMESTAMP, method = ? WHERE payment_id = ?',
    [finalMethod, payment.payment_id]
  );

  const [updatedPayment] = await pool.query('SELECT * FROM payments WHERE payment_id = ?', [payment.payment_id]);

  res.status(200).json({
    success: true,
    message: 'Payment completed successfully',
    data: {
      payment: updatedPayment[0],
      order: {
        order_id: order.order_id,
        total_amount: parseFloat(order.total_amount),
        delivery_address: order.delivery_address,
        status: order.status
      }
    }
  });
});

// GET /api/payments/order/:orderId
exports.getPaymentByOrderId = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const user = req.user;

  const [orders] = await pool.query('SELECT user_id, total_amount, status FROM orders WHERE order_id = ?', [orderId]);
  if (orders.length === 0) {
    return next(new AppError(`Order with ID ${orderId} not found`, 404));
  }

  if (user.role === 'customer' && orders[0].user_id !== user.user_id) {
    return next(new AppError('Forbidden: You can only view payment details for your own orders.', 403));
  }

  const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [orderId]);
  if (payments.length === 0) {
    return next(new AppError(`No payment record found for order ${orderId}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {
      payment: payments[0],
      order_total: parseFloat(orders[0].total_amount),
      order_status: orders[0].status
    }
  });
});


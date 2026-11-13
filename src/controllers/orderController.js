const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/orders (customer)
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { delivery_address, prescription_id, payment_method = 'cash_on_delivery', items } = req.body;
  const userId = req.user.user_id;

  // Single MySQL connection for the transaction
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let requiresPrescriptionCheck = false;
    let totalAmount = 0;
    const itemsToProcess = [];

    // 1. Fetch medicine details and verify prescription requirement
    for (const item of items) {
      const [medicines] = await connection.query(
        'SELECT medicine_id, name, price, requires_prescription FROM medicines WHERE medicine_id = ?',
        [item.medicine_id]
      );

      if (medicines.length === 0) {
        throw new AppError(`Medicine with ID ${item.medicine_id} does not exist.`, 404);
      }

      const medicine = medicines[0];
      const unitPrice = parseFloat(medicine.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      if (medicine.requires_prescription) {
        requiresPrescriptionCheck = true;
      }

      itemsToProcess.push({
        medicine_id: medicine.medicine_id,
        name: medicine.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        requires_prescription: Boolean(medicine.requires_prescription)
      });
    }

    // Business Rule 2: If any medicine requires prescription, verify approved prescription
    if (requiresPrescriptionCheck) {
      if (!prescription_id) {
        throw new AppError(
          'One or more medicines in your order require a doctor prescription. Please provide a valid prescription_id.',
          403
        );
      }

      const [prescriptions] = await connection.query(
        'SELECT prescription_id, user_id, status FROM prescriptions WHERE prescription_id = ?',
        [prescription_id]
      );

      if (prescriptions.length === 0) {
        throw new AppError(`Prescription with ID ${prescription_id} not found.`, 404);
      }

      const rx = prescriptions[0];
      if (rx.user_id !== userId) {
        throw new AppError('The specified prescription does not belong to your account.', 403);
      }

      if (rx.status !== 'approved') {
        throw new AppError(
          `The prescription provided has status "${rx.status}". An order can only be placed with an "approved" prescription.`,
          403
        );
      }
    }

    // Business Rules 3 & 4: FEFO stock deduction (First Expiry, First Out) with SELECT ... FOR UPDATE
    // Never use expired batches. Reject if non-expired stock is insufficient.
    for (const item of itemsToProcess) {
      const [batches] = await connection.query(
        `SELECT batch_id, batch_no, quantity, expiry_date 
         FROM batches 
         WHERE medicine_id = ? AND expiry_date >= CURDATE() AND quantity > 0 
         ORDER BY expiry_date ASC 
         FOR UPDATE`,
        [item.medicine_id]
      );

      const totalAvailable = batches.reduce((sum, b) => sum + parseInt(b.quantity, 10), 0);

      if (totalAvailable < item.quantity) {
        throw new AppError(
          `Insufficient non-expired stock for medicine "${item.name}". Available: ${totalAvailable}, Requested: ${item.quantity}.`,
          400
        );
      }

      // Deduct stock in FEFO order (earliest expiry first)
      let remainingToDeduct = item.quantity;
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deduct = Math.min(batch.quantity, remainingToDeduct);
        await connection.query(
          'UPDATE batches SET quantity = quantity - ? WHERE batch_id = ?',
          [deduct, batch.batch_id]
        );
        remainingToDeduct -= deduct;
      }
    }

    // 2. Insert order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, prescription_id, delivery_address, status, total_amount) 
       VALUES (?, ?, ?, 'pending', ?)`,
      [userId, prescription_id || null, delivery_address, totalAmount.toFixed(2)]
    );

    const orderId = orderResult.insertId;

    // 3. Insert order items
    for (const item of itemsToProcess) {
      await connection.query(
        `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) 
         VALUES (?, ?, ?, ?)`,
        [orderId, item.medicine_id, item.quantity, item.unit_price]
      );
    }

    // 4. Create initial payment record (status pending)
    await connection.query(
      `INSERT INTO payments (order_id, method, status) 
       VALUES (?, ?, 'pending')`,
      [orderId, payment_method]
    );

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order_id: orderId,
        user_id: userId,
        prescription_id: prescription_id || null,
        delivery_address,
        status: 'pending',
        total_amount: parseFloat(totalAmount.toFixed(2)),
        payment: {
          method: payment_method,
          status: 'pending'
        },
        items: itemsToProcess.map((it) => ({
          medicine_id: it.medicine_id,
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price
        }))
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// GET /api/orders/my (customer)
exports.getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const [orders] = await pool.query(
    `SELECT 
      o.order_id,
      o.prescription_id,
      o.delivery_address,
      o.status,
      o.total_amount,
      o.created_at,
      p.method AS payment_method,
      p.status AS payment_status,
      p.paid_at
    FROM orders o
    LEFT JOIN payments p ON o.order_id = p.order_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC`,
    [userId]
  );

  // Attach items for each order
  for (const order of orders) {
    order.total_amount = parseFloat(order.total_amount);
    const [items] = await pool.query(
      `SELECT 
        oi.order_item_id,
        oi.medicine_id,
        m.name AS medicine_name,
        oi.quantity,
        oi.unit_price,
        (oi.quantity * oi.unit_price) AS subtotal
      FROM order_items oi
      JOIN medicines m ON oi.medicine_id = m.medicine_id
      WHERE oi.order_id = ?`,
      [order.order_id]
    );
    order.items = items.map((it) => ({
      ...it,
      unit_price: parseFloat(it.unit_price),
      subtotal: parseFloat(it.subtotal)
    }));
  }

  res.status(200).json({
    success: true,
    data: {
      orders,
      count: orders.length
    }
  });
});

// GET /api/orders/:id (owner customer, pharmacist, or admin)
exports.getOrderById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  const [orders] = await pool.query(
    `SELECT 
      o.order_id,
      o.user_id,
      u.name AS customer_name,
      u.email AS customer_email,
      u.phone AS customer_phone,
      o.prescription_id,
      rx.image_path AS prescription_image_path,
      rx.status AS prescription_status,
      o.delivery_address,
      o.status,
      o.total_amount,
      o.created_at,
      p.payment_id,
      p.method AS payment_method,
      p.status AS payment_status,
      p.paid_at
    FROM orders o
    JOIN users u ON o.user_id = u.user_id
    LEFT JOIN prescriptions rx ON o.prescription_id = rx.prescription_id
    LEFT JOIN payments p ON o.order_id = p.order_id
    WHERE o.order_id = ?`,
    [id]
  );

  if (orders.length === 0) {
    return next(new AppError(`Order with ID ${id} not found`, 404));
  }

  const order = orders[0];

  // Business Rule 8: Customer can only view their own order
  if (user.role === 'customer' && order.user_id !== user.user_id) {
    return next(new AppError('Forbidden: You are not authorized to view this order.', 403));
  }

  const [items] = await pool.query(
    `SELECT 
      oi.order_item_id,
      oi.medicine_id,
      m.name AS medicine_name,
      m.requires_prescription,
      oi.quantity,
      oi.unit_price,
      (oi.quantity * oi.unit_price) AS subtotal
    FROM order_items oi
    JOIN medicines m ON oi.medicine_id = m.medicine_id
    WHERE oi.order_id = ?`,
    [id]
  );

  order.total_amount = parseFloat(order.total_amount);
  order.items = items.map((it) => ({
    ...it,
    unit_price: parseFloat(it.unit_price),
    subtotal: parseFloat(it.subtotal),
    requires_prescription: Boolean(it.requires_prescription)
  }));

  res.status(200).json({
    success: true,
    data: {
      order
    }
  });
});

// GET /api/orders (pharmacist, admin)
exports.getAllOrders = asyncHandler(async (req, res) => {
  const { status, userId } = req.query;

  let sql = `
    SELECT 
      o.order_id,
      o.user_id,
      u.name AS customer_name,
      u.email AS customer_email,
      o.prescription_id,
      o.delivery_address,
      o.status,
      o.total_amount,
      o.created_at,
      p.method AS payment_method,
      p.status AS payment_status,
      p.paid_at
    FROM orders o
    JOIN users u ON o.user_id = u.user_id
    LEFT JOIN payments p ON o.order_id = p.order_id
  `;

  const where = [];
  const params = [];

  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }

  if (userId) {
    where.push('o.user_id = ?');
    params.push(parseInt(userId, 10));
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ' ORDER BY o.created_at DESC';

  const [orders] = await pool.query(sql, params);

  const formatted = orders.map((o) => ({
    ...o,
    total_amount: parseFloat(o.total_amount)
  }));

  res.status(200).json({
    success: true,
    data: {
      orders: formatted,
      count: formatted.length
    }
  });
});

// PATCH /api/orders/:id/status (pharmacist/admin)
// Business Rule 6: Flow: pending -> confirmed -> shipped -> delivered.
// Cancellation allowed from pending or confirmed only, and it restores stock.
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status: newStatus } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE order_id = ? FOR UPDATE',
      [id]
    );

    if (orders.length === 0) {
      throw new AppError(`Order with ID ${id} not found`, 404);
    }

    const currentOrder = orders[0];
    const currentStatus = currentOrder.status;

    // Check valid transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: []
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal status)'}.`,
        400
      );
    }

    // If transitioning to cancelled: restore stock!
    if (newStatus === 'cancelled') {
      const [items] = await connection.query(
        'SELECT medicine_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      for (const item of items) {
        // Find the earliest non-expired batch for this medicine to restore stock
        const [activeBatches] = await connection.query(
          `SELECT batch_id FROM batches 
           WHERE medicine_id = ? AND expiry_date >= CURDATE() 
           ORDER BY expiry_date ASC 
           LIMIT 1 FOR UPDATE`,
          [item.medicine_id]
        );

        if (activeBatches.length > 0) {
          await connection.query(
            'UPDATE batches SET quantity = quantity + ? WHERE batch_id = ?',
            [item.quantity, activeBatches[0].batch_id]
          );
        } else {
          // If no active non-expired batch exists, add to the latest batch
          const [anyBatch] = await connection.query(
            `SELECT batch_id FROM batches 
             WHERE medicine_id = ? 
             ORDER BY expiry_date DESC 
             LIMIT 1 FOR UPDATE`,
            [item.medicine_id]
          );
          if (anyBatch.length > 0) {
            await connection.query(
              'UPDATE batches SET quantity = quantity + ? WHERE batch_id = ?',
              [item.quantity, anyBatch[0].batch_id]
            );
          }
        }
      }
    }

    // Update order status
    await connection.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, id]);

    await connection.commit();

    res.status(200).json({
      success: true,
      message: `Order status successfully updated to "${newStatus}"${newStatus === 'cancelled' ? ' and inventory stock was restored' : ''}.`,
      data: {
        order_id: parseInt(id, 10),
        previous_status: currentStatus,
        status: newStatus
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});


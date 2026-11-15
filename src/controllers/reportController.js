const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/reports/sales?from=&to= (admin)
exports.getSalesReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const whereConditions = ["o.status != 'cancelled'"];
  const params = [];

  if (from) {
    whereConditions.push('o.created_at >= ?');
    params.push(from);
  }

  if (to) {
    whereConditions.push('o.created_at <= ?');
    params.push(to);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const summarySql = `
    SELECT 
      COUNT(o.order_id) AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_revenue,
      COALESCE(AVG(o.total_amount), 0) AS average_order_value
    FROM orders o
    ${whereClause}
  `;

  const [summary] = await pool.query(summarySql, params);

  // Status breakdown
  const statusSql = `
    SELECT o.status, COUNT(*) AS count, COALESCE(SUM(o.total_amount), 0) AS amount
    FROM orders o
    ${whereClause}
    GROUP BY o.status
  `;
  const [byStatus] = await pool.query(statusSql, params);

  // Payment method breakdown
  const paymentSql = `
    SELECT p.method, COUNT(p.payment_id) AS count, COALESCE(SUM(o.total_amount), 0) AS total_amount
    FROM orders o
    JOIN payments p ON o.order_id = p.order_id
    ${whereClause}
    GROUP BY p.method
  `;
  const [byPaymentMethod] = await pool.query(paymentSql, params);

  res.status(200).json({
    success: true,
    data: {
      period: {
        from: from || 'all-time',
        to: to || 'present'
      },
      summary: {
        total_orders: parseInt(summary[0].total_orders, 10),
        total_revenue: parseFloat(summary[0].total_revenue),
        average_order_value: parseFloat(summary[0].average_order_value)
      },
      orders_by_status: byStatus.map((s) => ({
        status: s.status,
        count: parseInt(s.count, 10),
        amount: parseFloat(s.amount)
      })),
      orders_by_payment_method: byPaymentMethod.map((p) => ({
        method: p.method,
        count: parseInt(p.count, 10),
        total_amount: parseFloat(p.total_amount)
      }))
    }
  });
});

// GET /api/reports/low-stock?threshold=10 (admin)
exports.getLowStockReport = asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold || 10, 10);

  const sql = `
    SELECT 
      m.medicine_id,
      m.name,
      m.generic_name,
      m.manufacturer,
      c.name AS category_name,
      m.price,
      COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity ELSE 0 END), 0) AS available_stock,
      MIN(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity ELSE NULL END) AS min_batch_qty
    FROM medicines m
    JOIN categories c ON m.category_id = c.category_id
    LEFT JOIN batches b ON m.medicine_id = b.medicine_id
    GROUP BY m.medicine_id, c.name
    HAVING available_stock <= ?
    ORDER BY available_stock ASC
  `;

  const [rows] = await pool.query(sql, [threshold]);

  const medicines = rows.map((r) => ({
    ...r,
    price: parseFloat(r.price),
    available_stock: parseInt(r.available_stock, 10),
    min_batch_qty: r.min_batch_qty !== null ? parseInt(r.min_batch_qty, 10) : 0
  }));

  // Also query individual non-expired inventory batches with low stock
  const batchSql = `
    SELECT 
      b.batch_id,
      b.batch_no,
      b.quantity,
      b.expiry_date,
      m.medicine_id,
      m.name AS medicine_name,
      m.price,
      c.name AS category_name
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
    JOIN categories c ON m.category_id = c.category_id
    WHERE b.quantity <= ? AND b.expiry_date >= CURDATE()
    ORDER BY b.quantity ASC, b.expiry_date ASC
  `;

  const [batchRows] = await pool.query(batchSql, [threshold]);

  const batches = batchRows.map((b) => ({
    ...b,
    price: parseFloat(b.price),
    quantity: parseInt(b.quantity, 10)
  }));

  res.status(200).json({
    success: true,
    data: {
      threshold,
      low_stock_medicines: medicines,
      low_stock_batches: batches,
      count: medicines.length,
      batch_count: batches.length
    }
  });
});

// GET /api/reports/top-medicines?limit=5 (admin)
exports.getTopMedicinesReport = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || 5, 10);

  const sql = `
    SELECT 
      m.medicine_id,
      m.name,
      m.generic_name,
      c.name AS category_name,
      m.price,
      COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_sales_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.order_id
    JOIN medicines m ON oi.medicine_id = m.medicine_id
    JOIN categories c ON m.category_id = c.category_id
    WHERE o.status != 'cancelled'
    GROUP BY m.medicine_id, c.name
    ORDER BY total_units_sold DESC
    LIMIT ?
  `;

  const [top] = await pool.query(sql, [limit]);

  const formatted = top.map((t) => ({
    medicine_id: t.medicine_id,
    name: t.name,
    generic_name: t.generic_name,
    category_name: t.category_name,
    price: parseFloat(t.price),
    total_units_sold: parseInt(t.total_units_sold, 10),
    total_sales_revenue: parseFloat(t.total_sales_revenue)
  }));

  res.status(200).json({
    success: true,
    data: {
      limit,
      top_medicines: formatted,
      count: formatted.length
    }
  });
});

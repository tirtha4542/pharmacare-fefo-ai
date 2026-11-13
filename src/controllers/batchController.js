const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/batches (admin, pharmacist)
exports.createBatch = asyncHandler(async (req, res, next) => {
  const { medicine_id, batch_no, quantity, expiry_date } = req.body;

  // Validate medicine exists
  const [medicines] = await pool.query('SELECT medicine_id, name FROM medicines WHERE medicine_id = ?', [medicine_id]);
  if (medicines.length === 0) {
    return next(new AppError(`Medicine with ID ${medicine_id} not found`, 404));
  }

  const [result] = await pool.query(
    'INSERT INTO batches (medicine_id, batch_no, quantity, expiry_date) VALUES (?, ?, ?, ?)',
    [medicine_id, batch_no, quantity, expiry_date]
  );

  const batchId = result.insertId;

  res.status(201).json({
    success: true,
    message: 'Batch created successfully',
    data: {
      batch: {
        batch_id: batchId,
        medicine_id,
        medicine_name: medicines[0].name,
        batch_no,
        quantity,
        expiry_date
      }
    }
  });
});

// PUT /api/batches/:id (admin, pharmacist)
exports.updateBatch = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { batch_no, quantity, expiry_date } = req.body;

  const [existing] = await pool.query('SELECT * FROM batches WHERE batch_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Batch with ID ${id} not found`, 404));
  }

  const updatedBatch = {
    batch_no: batch_no !== undefined ? batch_no : existing[0].batch_no,
    quantity: quantity !== undefined ? quantity : existing[0].quantity,
    expiry_date: expiry_date !== undefined ? expiry_date : existing[0].expiry_date
  };

  await pool.query(
    'UPDATE batches SET batch_no = ?, quantity = ?, expiry_date = ? WHERE batch_id = ?',
    [updatedBatch.batch_no, updatedBatch.quantity, updatedBatch.expiry_date, id]
  );

  res.status(200).json({
    success: true,
    message: 'Batch updated successfully',
    data: {
      batch: {
        batch_id: parseInt(id, 10),
        medicine_id: existing[0].medicine_id,
        ...updatedBatch
      }
    }
  });
});

// GET /api/batches?medicineId= (admin, pharmacist)
exports.getBatches = asyncHandler(async (req, res) => {
  const { medicineId } = req.query;

  let sql = `
    SELECT 
      b.batch_id,
      b.medicine_id,
      m.name AS medicine_name,
      b.batch_no,
      b.quantity,
      b.expiry_date,
      CASE WHEN b.expiry_date < CURDATE() THEN 1 ELSE 0 END AS is_expired
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
  `;

  const params = [];
  if (medicineId) {
    sql += ' WHERE b.medicine_id = ?';
    params.push(parseInt(medicineId, 10));
  }

  sql += ' ORDER BY b.expiry_date ASC';

  const [batches] = await pool.query(sql, params);

  const formatted = batches.map((b) => ({
    ...b,
    is_expired: Boolean(b.is_expired)
  }));

  res.status(200).json({
    success: true,
    data: {
      batches: formatted,
      count: formatted.length
    }
  });
});

// GET /api/batches/expiring?days=30 (admin, pharmacist)
exports.getExpiringBatches = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days || 30, 10);

  const [batches] = await pool.query(
    `SELECT 
      b.batch_id,
      b.medicine_id,
      m.name AS medicine_name,
      b.batch_no,
      b.quantity,
      b.expiry_date,
      DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
    WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND b.quantity > 0
    ORDER BY b.expiry_date ASC`,
    [days]
  );

  res.status(200).json({
    success: true,
    data: {
      days_threshold: days,
      expiring_batches: batches,
      count: batches.length
    }
  });
});


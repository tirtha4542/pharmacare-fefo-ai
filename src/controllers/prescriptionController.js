const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/prescriptions (customer; multipart upload)
exports.uploadPrescription = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Prescription file is required (JPG, PNG, or PDF, max 5 MB).', 400));
  }

  const imagePath = `uploads/${req.file.filename}`;
  const userId = req.user.user_id;

  const [result] = await pool.query(
    'INSERT INTO prescriptions (user_id, image_path, status) VALUES (?, ?, ?)',
    [userId, imagePath, 'pending']
  );

  const prescriptionId = result.insertId;

  res.status(201).json({
    success: true,
    message: 'Prescription uploaded successfully and is pending pharmacist review.',
    data: {
      prescription: {
        prescription_id: prescriptionId,
        user_id: userId,
        image_path: imagePath,
        status: 'pending',
        reviewed_by: null
      }
    }
  });
});

// GET /api/prescriptions/my (customer)
exports.getMyPrescriptions = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const [prescriptions] = await pool.query(
    `SELECT 
      p.prescription_id,
      p.user_id,
      p.image_path,
      p.status,
      p.reviewed_by,
      u.name AS reviewer_name,
      p.uploaded_at
    FROM prescriptions p
    LEFT JOIN users u ON p.reviewed_by = u.user_id
    WHERE p.user_id = ?
    ORDER BY p.uploaded_at DESC`,
    [userId]
  );

  res.status(200).json({
    success: true,
    data: {
      prescriptions,
      count: prescriptions.length
    }
  });
});

// GET /api/prescriptions (pharmacist/admin, optional filter by status)
exports.getAllPrescriptions = asyncHandler(async (req, res) => {
  const { status } = req.query;

  let sql = `
    SELECT 
      p.prescription_id,
      p.user_id,
      customer.name AS customer_name,
      customer.email AS customer_email,
      p.image_path,
      p.status,
      p.reviewed_by,
      reviewer.name AS reviewer_name,
      p.uploaded_at
    FROM prescriptions p
    JOIN users customer ON p.user_id = customer.user_id
    LEFT JOIN users reviewer ON p.reviewed_by = reviewer.user_id
  `;

  const params = [];
  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY p.prescription_id ASC';

  const [prescriptions] = await pool.query(sql, params);

  res.status(200).json({
    success: true,
    data: {
      prescriptions,
      count: prescriptions.length
    }
  });
});

// PATCH /api/prescriptions/:id/review (pharmacist/admin)
exports.reviewPrescription = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'
  const reviewerId = req.user.user_id;

  const [existing] = await pool.query('SELECT * FROM prescriptions WHERE prescription_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Prescription with ID ${id} not found`, 404));
  }

  await pool.query(
    'UPDATE prescriptions SET status = ?, reviewed_by = ? WHERE prescription_id = ?',
    [status, reviewerId, id]
  );

  const [updated] = await pool.query(
    `SELECT 
      p.prescription_id,
      p.user_id,
      p.image_path,
      p.status,
      p.reviewed_by,
      reviewer.name AS reviewer_name,
      p.uploaded_at
    FROM prescriptions p
    LEFT JOIN users reviewer ON p.reviewed_by = reviewer.user_id
    WHERE p.prescription_id = ?`,
    [id]
  );

  res.status(200).json({
    success: true,
    message: `Prescription has been ${status}`,
    data: {
      prescription: updated[0]
    }
  });
});


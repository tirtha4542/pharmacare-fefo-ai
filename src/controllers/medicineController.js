const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/medicines (public, paginated, with search, filters, and non-expired stock)
exports.getAllMedicines = asyncHandler(async (req, res) => {
  const { search, category, requiresPrescription, page = 1, limit = 10 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const whereConditions = [];
  const queryParams = [];

  if (search && search.trim() !== '') {
    whereConditions.push('(m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  if (category) {
    if (!isNaN(category)) {
      whereConditions.push('m.category_id = ?');
      queryParams.push(parseInt(category, 10));
    } else {
      whereConditions.push('c.name LIKE ?');
      queryParams.push(`%${category.trim()}%`);
    }
  }

  if (requiresPrescription !== undefined && requiresPrescription !== '') {
    const isRx = requiresPrescription === true || requiresPrescription === 'true' || requiresPrescription === '1';
    whereConditions.push('m.requires_prescription = ?');
    queryParams.push(isRx ? 1 : 0);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Count total matching medicines
  const countSql = `
    SELECT COUNT(DISTINCT m.medicine_id) AS total
    FROM medicines m
    JOIN categories c ON m.category_id = c.category_id
    ${whereClause}
  `;
  const [countResult] = await pool.query(countSql, queryParams);
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limitNum) || 1;

  // Query medicines with calculated available stock from non-expired batches
  const dataSql = `
    SELECT 
      m.medicine_id,
      m.category_id,
      c.name AS category_name,
      m.name,
      m.generic_name,
      m.manufacturer,
      m.price,
      m.requires_prescription,
      COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity ELSE 0 END), 0) AS available_stock
    FROM medicines m
    JOIN categories c ON m.category_id = c.category_id
    LEFT JOIN batches b ON m.medicine_id = b.medicine_id
    ${whereClause}
    GROUP BY m.medicine_id, c.name
    ORDER BY m.medicine_id ASC
    LIMIT ? OFFSET ?
  `;

  const [medicines] = await pool.query(dataSql, [...queryParams, limitNum, offset]);

  // Format boolean and number fields properly
  const formattedMedicines = medicines.map((m) => ({
    ...m,
    price: parseFloat(m.price),
    requires_prescription: Boolean(m.requires_prescription),
    available_stock: parseInt(m.available_stock, 10)
  }));

  res.status(200).json({
    success: true,
    data: {
      medicines: formattedMedicines,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    }
  });
});

// GET /api/medicines/:id (public)
exports.getMedicineById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const [medicines] = await pool.query(
    `SELECT 
      m.medicine_id,
      m.category_id,
      c.name AS category_name,
      m.name,
      m.generic_name,
      m.manufacturer,
      m.price,
      m.requires_prescription,
      COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity ELSE 0 END), 0) AS available_stock
    FROM medicines m
    JOIN categories c ON m.category_id = c.category_id
    LEFT JOIN batches b ON m.medicine_id = b.medicine_id
    WHERE m.medicine_id = ?
    GROUP BY m.medicine_id, c.name`,
    [id]
  );

  if (medicines.length === 0) {
    return next(new AppError(`Medicine with ID ${id} not found`, 404));
  }

  const med = medicines[0];

  // Also fetch non-expired batches for transparency
  const [batches] = await pool.query(
    `SELECT batch_id, batch_no, quantity, expiry_date 
     FROM batches 
     WHERE medicine_id = ? AND expiry_date >= CURDATE() AND quantity > 0
     ORDER BY expiry_date ASC`,
    [id]
  );

  res.status(200).json({
    success: true,
    data: {
      medicine: {
        ...med,
        price: parseFloat(med.price),
        requires_prescription: Boolean(med.requires_prescription),
        available_stock: parseInt(med.available_stock, 10),
        active_batches: batches
      }
    }
  });
});

// POST /api/medicines (admin)
exports.createMedicine = asyncHandler(async (req, res, next) => {
  const { category_id, name, generic_name, manufacturer, price, requires_prescription } = req.body;

  // Validate category exists
  const [categories] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [category_id]);
  if (categories.length === 0) {
    return next(new AppError(`Category with ID ${category_id} does not exist`, 400));
  }

  const [result] = await pool.query(
    `INSERT INTO medicines (category_id, name, generic_name, manufacturer, price, requires_prescription) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [category_id, name, generic_name || null, manufacturer || null, price, requires_prescription ? 1 : 0]
  );

  const newId = result.insertId;

  res.status(201).json({
    success: true,
    message: 'Medicine created successfully',
    data: {
      medicine: {
        medicine_id: newId,
        category_id,
        name,
        generic_name: generic_name || null,
        manufacturer: manufacturer || null,
        price: parseFloat(price),
        requires_prescription: Boolean(requires_prescription)
      }
    }
  });
});

// PUT /api/medicines/:id (admin)
exports.updateMedicine = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { category_id, name, generic_name, manufacturer, price, requires_prescription } = req.body;

  const [existing] = await pool.query('SELECT * FROM medicines WHERE medicine_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Medicine with ID ${id} not found`, 404));
  }

  if (category_id !== undefined) {
    const [categories] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [category_id]);
    if (categories.length === 0) {
      return next(new AppError(`Category with ID ${category_id} does not exist`, 400));
    }
  }

  const updatedMedicine = {
    category_id: category_id !== undefined ? category_id : existing[0].category_id,
    name: name !== undefined ? name : existing[0].name,
    generic_name: generic_name !== undefined ? generic_name : existing[0].generic_name,
    manufacturer: manufacturer !== undefined ? manufacturer : existing[0].manufacturer,
    price: price !== undefined ? price : existing[0].price,
    requires_prescription: requires_prescription !== undefined ? (requires_prescription ? 1 : 0) : existing[0].requires_prescription
  };

  await pool.query(
    `UPDATE medicines 
     SET category_id = ?, name = ?, generic_name = ?, manufacturer = ?, price = ?, requires_prescription = ? 
     WHERE medicine_id = ?`,
    [
      updatedMedicine.category_id,
      updatedMedicine.name,
      updatedMedicine.generic_name,
      updatedMedicine.manufacturer,
      updatedMedicine.price,
      updatedMedicine.requires_prescription,
      id
    ]
  );

  res.status(200).json({
    success: true,
    message: 'Medicine updated successfully',
    data: {
      medicine: {
        medicine_id: parseInt(id, 10),
        ...updatedMedicine,
        price: parseFloat(updatedMedicine.price),
        requires_prescription: Boolean(updatedMedicine.requires_prescription)
      }
    }
  });
});

// DELETE /api/medicines/:id (admin)
exports.deleteMedicine = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT medicine_id, name FROM medicines WHERE medicine_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Medicine with ID ${id} not found`, 404));
  }

  // Business Rule 9: Check if referenced in batches or order_items
  const [batches] = await pool.query('SELECT COUNT(*) as count FROM batches WHERE medicine_id = ?', [id]);
  const [orderItems] = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE medicine_id = ?', [id]);

  if (batches[0].count > 0 || orderItems[0].count > 0) {
    return next(
      new AppError(
        `Cannot delete medicine '${existing[0].name}': it is referenced by ${batches[0].count} batch(es) and ${orderItems[0].count} order item(s).`,
        409
      )
    );
  }

  await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [id]);

  res.status(200).json({
    success: true,
    message: `Medicine '${existing[0].name}' (ID: ${id}) deleted successfully`
  });
});


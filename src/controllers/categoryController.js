const pool = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/categories (public)
exports.getAllCategories = asyncHandler(async (req, res) => {
  const [categories] = await pool.query(
    'SELECT category_id, name FROM categories ORDER BY category_id ASC'
  );

  res.status(200).json({
    success: true,
    data: {
      categories,
      count: categories.length
    }
  });
});

// POST /api/categories (admin)
exports.createCategory = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  // Check unique name
  const [existing] = await pool.query('SELECT category_id FROM categories WHERE name = ?', [name]);
  if (existing.length > 0) {
    return next(new AppError(`Category '${name}' already exists.`, 409));
  }

  const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
  const newCategoryId = result.insertId;

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: {
      category: {
        category_id: newCategoryId,
        name
      }
    }
  });
});

// PUT /api/categories/:id (admin)
exports.updateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  const [existing] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Category with ID ${id} not found`, 404));
  }

  // Check unique name for another category
  const [nameConflict] = await pool.query(
    'SELECT category_id FROM categories WHERE name = ? AND category_id != ?',
    [name, id]
  );
  if (nameConflict.length > 0) {
    return next(new AppError(`Category name '${name}' is already used by another category.`, 409));
  }

  await pool.query('UPDATE categories SET name = ? WHERE category_id = ?', [name, id]);

  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: {
      category: {
        category_id: parseInt(id, 10),
        name
      }
    }
  });
});

// DELETE /api/categories/:id (admin)
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const [existing] = await pool.query('SELECT category_id, name FROM categories WHERE category_id = ?', [id]);
  if (existing.length === 0) {
    return next(new AppError(`Category with ID ${id} not found`, 404));
  }

  // Business Rule 9: Check if category is referenced in medicines table
  const [medicines] = await pool.query('SELECT COUNT(*) as count FROM medicines WHERE category_id = ?', [id]);
  if (medicines[0].count > 0) {
    return next(
      new AppError(
        `Cannot delete category '${existing[0].name}': it is referenced by ${medicines[0].count} existing medicine(s).`,
        409
      )
    );
  }

  await pool.query('DELETE FROM categories WHERE category_id = ?', [id]);

  res.status(200).json({
    success: true,
    message: `Category '${existing[0].name}' (ID: ${id}) deleted successfully`
  });
});


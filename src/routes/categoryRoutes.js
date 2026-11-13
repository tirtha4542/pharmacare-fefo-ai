const express = require('express');
const categoryController = require('../controllers/categoryController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const { categorySchema } = require('../validators/categoryValidator');

const router = express.Router();

// GET /api/categories (public)
router.get('/', categoryController.getAllCategories);

// Admin-only management endpoints
router.post('/', protect, restrictTo('admin'), validate(categorySchema), categoryController.createCategory);
router.put('/:id', protect, restrictTo('admin'), validate(categorySchema), categoryController.updateCategory);
router.delete('/:id', protect, restrictTo('admin'), categoryController.deleteCategory);

module.exports = router;


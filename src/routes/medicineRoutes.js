const express = require('express');
const medicineController = require('../controllers/medicineController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const {
  createMedicineSchema,
  updateMedicineSchema,
  queryMedicineSchema
} = require('../validators/medicineValidator');

const router = express.Router();

// Public medicine browsing
router.get('/', validate(queryMedicineSchema, 'query'), medicineController.getAllMedicines);
router.get('/:id', medicineController.getMedicineById);

// Admin-only medicine management
router.post('/', protect, restrictTo('admin'), validate(createMedicineSchema), medicineController.createMedicine);
router.put('/:id', protect, restrictTo('admin'), validate(updateMedicineSchema), medicineController.updateMedicine);
router.delete('/:id', protect, restrictTo('admin'), medicineController.deleteMedicine);

module.exports = router;


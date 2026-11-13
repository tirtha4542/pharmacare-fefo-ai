const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  reviewPrescriptionSchema,
  queryPrescriptionSchema
} = require('../validators/prescriptionValidator');

const router = express.Router();

router.use(protect);

// Customer endpoints
router.post(
  '/',
  restrictTo('customer'),
  upload.single('prescription'),
  prescriptionController.uploadPrescription
);

router.get('/my', restrictTo('customer'), prescriptionController.getMyPrescriptions);

// Pharmacist & Admin endpoints
router.get(
  '/',
  restrictTo('pharmacist', 'admin'),
  validate(queryPrescriptionSchema, 'query'),
  prescriptionController.getAllPrescriptions
);

router.patch(
  '/:id/review',
  restrictTo('pharmacist', 'admin'),
  validate(reviewPrescriptionSchema),
  prescriptionController.reviewPrescription
);

module.exports = router;


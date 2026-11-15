const express = require('express');
const batchController = require('../controllers/batchController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const {
  createBatchSchema,
  updateBatchSchema,
  queryExpiringSchema,
  queryBatchSchema
} = require('../validators/batchValidator');

const router = express.Router();

// All batch management requires pharmacist or admin role
router.use(protect, restrictTo('pharmacist', 'admin'));

router.get('/expiring', validate(queryExpiringSchema, 'query'), batchController.getExpiringBatches);
router.get('/', validate(queryBatchSchema, 'query'), batchController.getBatches);
router.post('/', validate(createBatchSchema), batchController.createBatch);
router.put('/:id', validate(updateBatchSchema), batchController.updateBatch);
router.delete('/:id', batchController.deleteBatch);

module.exports = router;


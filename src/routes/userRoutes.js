const express = require('express');
const userController = require('../controllers/userController');
const protect = require('../middleware/auth');
const restrictTo = require('../middleware/role');
const validate = require('../middleware/validate');
const { updateRoleSchema } = require('../validators/userValidator');

const router = express.Router();

// All user management routes require admin role
router.use(protect, restrictTo('admin'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.patch('/:id/role', validate(updateRoleSchema), userController.updateUserRole);
router.delete('/:id', userController.deleteUser);

module.exports = router;


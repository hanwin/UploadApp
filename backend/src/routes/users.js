const express = require('express');
const {
  getAllUsers,
  createUser,
  deleteUser,
  updateUserRole,
  updateOwnProfile,
  updateUserProfile
} = require('../controllers/userController');
const { authMiddleware, superadminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, superadminMiddleware, getAllUsers);
router.post('/', authMiddleware, superadminMiddleware, createUser);
router.delete('/:id', authMiddleware, superadminMiddleware, deleteUser);
router.patch('/:id/role', authMiddleware, superadminMiddleware, updateUserRole);
router.put('/:id', authMiddleware, superadminMiddleware, updateUserRole);

// Profile update routes
router.patch('/profile/me', authMiddleware, updateOwnProfile);
router.patch('/:userId/profile', authMiddleware, superadminMiddleware, updateUserProfile);

module.exports = router;

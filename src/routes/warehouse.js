const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Warehouse module - Coming soon',
      features: [
        'Inventory Management',
        'Stock Tracking',
        'Warehouse Operations',
        'Quality Control'
      ]
    }
  });
}));

module.exports = router;

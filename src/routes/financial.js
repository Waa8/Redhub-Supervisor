const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Financial module - Coming soon',
      features: [
        'Billing Management',
        'Payment Processing',
        'Financial Reporting',
        'Tax Management'
      ]
    }
  });
}));

module.exports = router;

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Reports module - Coming soon',
      features: [
        'Performance Reports',
        'Financial Analytics',
        'Operational Metrics',
        'Custom Dashboards'
      ]
    }
  });
}));

module.exports = router;

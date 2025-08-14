const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Representatives module - Coming soon',
      features: [
        'Representative Profiles',
        'Performance Tracking',
        'Schedule Management',
        'Incentive System'
      ]
    }
  });
}));

module.exports = router;

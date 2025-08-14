const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Customer Service module - Coming soon',
      features: [
        'Contact Center',
        'Ticket Management',
        'Live Chat',
        'Knowledge Base'
      ]
    }
  });
}));

module.exports = router;

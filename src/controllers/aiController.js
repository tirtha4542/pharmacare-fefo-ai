/**
 * aiController.js
 * Express controller for the Role-Based AI Subsystem.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { generateAiResponse } = require('../services/aiService');

// POST /api/ai/chat (authenticated)
exports.chatWithAi = asyncHandler(async (req, res, next) => {
  const { message, conversationHistory } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return next(new AppError('Please provide a valid message string.', 400));
  }

  // Extract bearer token from incoming request
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';

  if (!token) {
    return next(new AppError('Authentication required to access AI Assistant.', 401));
  }

  const result = await generateAiResponse({
    message: message.trim(),
    conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
    user: req.user,
    token
  });

  res.status(200).json({
    success: true,
    data: result
  });
});


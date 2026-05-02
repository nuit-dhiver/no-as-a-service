const express = require('express');
const cors = require("cors");
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { getAiProvider, normalizeTone } = require('./ai-provider');

const PORT = process.env.PORT || 3000;

// Load reasons from JSON
const reasons = JSON.parse(fs.readFileSync(path.join(__dirname, 'reasons.json'), 'utf-8'));

function getRandomReason() {
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function createApp({ aiProvider = getAiProvider() } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10kb' }));
  app.set('trust proxy', true);

  // Rate limiter: 120 requests per minute per IP
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    keyGenerator: (req, res) => {
      return req.headers['cf-connecting-ip'] || req.ip; // Fallback if header missing (or for non-CF)
    },
    message: { error: "Too many requests, please try again later. (120 reqs/min/IP)" }
  });

  app.use(limiter);

  // Random rejection reason endpoint
  app.get('/no', (req, res) => {
    res.json({ reason: getRandomReason() });
  });

  // Contextual AI rejection endpoint
  app.post('/no/ai', async (req, res) => {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'message must be 1000 characters or fewer' });
    }

    const tone = normalizeTone(req.body.tone);

    if (!aiProvider) {
      return res.json({
        reason: getRandomReason(),
        ai: false,
        fallback: 'random'
      });
    }

    try {
      const reason = await aiProvider.generateRejection({ message, tone });
      return res.json({ reason, ai: true, tone });
    } catch (error) {
      return res.json({
        reason: getRandomReason(),
        ai: false,
        fallback: 'random'
      });
    }
  });

  return app;
}

// Start server
if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`No-as-a-Service is running on port ${PORT}`);
  });
}

module.exports = {
  createApp,
  getRandomReason
};

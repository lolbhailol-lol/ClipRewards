const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const { requireAuth, requireRole } = require('../middleware/auth');

// Carried over from the original starter. Now admin-only so the API key
// can't be used by the public. P2: becomes the AI caption pre-check.
const router = Router();
const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { message, model = 'claude-3-haiku-20240307' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }],
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Minimal local proxy + static server for testing the chatbot locally.
// Usage:
//   OPENAI_API_KEY=sk-... node server.js
// The server serves the current workspace static files and exposes POST /api/chat
// which proxies to the OpenAI Chat Completions API.

// Optionally load environment variables from a local .env file during development.
// This is non-fatal if dotenv is not installed; in production prefer real env vars
// (for example, set OPENAI_API_KEY in Cloudflare Worker or your host).
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed — that's fine, expect env vars to be set externally
}

const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.MODEL || 'gpt-3.5-turbo';

// Serve static files from project root so you can open http://localhost:3000
app.use(express.static(path.join(__dirname)));

// Simple health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/chat', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: { message: 'Server missing OPENAI_API_KEY environment variable.' } });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: { message: 'Bad request: `messages` must be an array.' } });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 300,
      }),
    });

    const data = await openaiRes.json();

    // Forward the exact OpenAI response so the frontend can handle it.
    if (!openaiRes.ok) {
      // Preserve status from OpenAI where possible
      return res.status(openaiRes.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({ error: { message: 'Proxy error contacting OpenAI.', details: String(err) } });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} (MODEL=${MODEL})`);
});

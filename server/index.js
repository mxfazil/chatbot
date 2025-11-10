const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const { fetch } = require('undici');
const path = require('path');
const fs = require('fs');

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;
const OPENAI_TTS_ENDPOINT = process.env.OPENAI_TTS_ENDPOINT || 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';

if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. Add it to .env before using the app.');
}

const app = express();

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Simple health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Simple TTS test endpoint
app.get('/api/tts-test', async (req, res) => {
  try {
    console.log('TTS test endpoint called');
    res.json({ 
      status: 'ok', 
      model: OPENAI_TTS_MODEL,
      endpoint: OPENAI_TTS_ENDPOINT
    });
  } catch (err) {
    console.error('TTS test error', err);
    res.status(500).json({ error: String(err) });
  }
});

// If you build the client and put the dist in client/dist, serve static files
const staticPath = path.join(__dirname, '..', 'client', 'dist');
console.log(`Checking for static files at: ${staticPath}`);

// Check if the static path exists
fs.access(staticPath, fs.constants.F_OK, (err) => {
  if (err) {
    console.warn(`Static files directory not found at: ${staticPath}`);
    console.warn(`Frontend may not have been built. Please run 'npm run client:build' during deployment.`);
    
    // Let's also check what directories do exist
    const projectRoot = path.join(__dirname, '..');
    fs.readdir(projectRoot, (readdirErr, files) => {
      if (!readdirErr) {
        console.log(`Files and directories in project root (${projectRoot}):`, files);
        
        // Check if client directory exists
        const clientPath = path.join(projectRoot, 'client');
        fs.access(clientPath, fs.constants.F_OK, (clientErr) => {
          if (clientErr) {
            console.log(`Client directory not found at: ${clientPath}`);
          } else {
            console.log(`Client directory exists at: ${clientPath}`);
            fs.readdir(clientPath, (clientReaddirErr, clientFiles) => {
              if (!clientReaddirErr) {
                console.log(`Files and directories in client directory:`, clientFiles);
              }
            });
          }
        });
      }
    });
  } else {
    console.log(`Serving static files from: ${staticPath}`);
  }
});

app.use(express.static(staticPath));

// Add fallback for client-side routing
app.get('*', (req, res) => {
  // Use path relative to project root instead of server directory
  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  
  console.log(`Attempting to serve index.html from: ${indexPath}`);
  
  // Check if file exists before sending
  fs.access(indexPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`Frontend build file not found at: ${indexPath}`);
      console.error(`Current directory: ${__dirname}`);
      console.error(`Project root directory: ${path.join(__dirname, '..')}`);
      
      // Let's also check what directories do exist
      const projectRoot = path.join(__dirname, '..');
      fs.readdir(projectRoot, (readdirErr, files) => {
        if (!readdirErr) {
          console.log(`Files and directories in project root (${projectRoot}):`, files);
        }
      });
      
      // Send a more informative error response
      res.status(404).send(`
        <h1>Frontend Build Not Found</h1>
        <p>The frontend build files were not found at: ${indexPath}</p>
        <p>Please ensure you've run 'npm run client:build' during deployment.</p>
        <p>Check your deployment configuration to make sure the build step is included.</p>
        <p><small>Debug info: ${new Date().toISOString()}</small></p>
      `);
    } else {
      console.log(`Successfully found index.html at: ${indexPath}`);
      res.sendFile(indexPath);
    }
  });
});

// TTS proxy endpoint: accepts { text, format } and forwards to OpenAI TTS endpoint
// Returns audio stream (audio/mpeg by default)
app.post('/api/tts', async (req, res) => {
  try {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    const { text, format = 'mp3' } = req.body;
    console.log('TTS request received:', { text, format }); // Debug log
    if (!text) return res.status(400).json({ error: 'Missing text in request body' });

    // Build OpenAI TTS request body with correct parameters
    const ttsBody = JSON.stringify({ 
      model: OPENAI_TTS_MODEL, 
      input: text, 
      voice: 'nova', // Adding default voice
      response_format: format 
    });

    console.log('Sending request to OpenAI TTS API:', {
      url: OPENAI_TTS_ENDPOINT,
      model: OPENAI_TTS_MODEL,
      textLength: text.length
    }); // Debug log

    const openaiRes = await fetch(OPENAI_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        Accept: 'audio/mpeg',
      },
      body: ttsBody,
    });

    console.log('OpenAI TTS API response status:', openaiRes.status); // Debug log

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI TTS API error:', errText); // Debug log
      return res.status(openaiRes.status).type('text').send(errText);
    }

    // Stream audio back to client
    res.setHeader('Content-Type', 'audio/mpeg');
    const reader = openaiRes.body.getReader();
    let totalBytes = 0; // Debug log
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('TTS streaming completed, total bytes:', totalBytes); // Debug log
        break;
      }
      totalBytes += value.length; // Debug log
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('TTS proxy error', err);
    res.status(500).json({ error: String(err) });
  }
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });

// Helper: stream OpenAI chat completion and forward tokens via WebSocket messages
async function streamOpenAI(ws, messages) {
  try {
    console.log('Streaming OpenAI request for messages:', messages); // Debug log
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
      }),
      signal: undefined,
    });

    console.log('OpenAI Chat API response status:', res.status); // Debug log

    if (!res.ok) {
      const text = await res.text();
      console.error('OpenAI Chat API error:', text); // Debug log
      ws.send(JSON.stringify({ type: 'error', error: text }));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('OpenAI streaming completed'); // Debug log
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // OpenAI streams SSE-like chunks separated by \n\n
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // last is partial

      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        // Each line starts with `data: `
        const m = line.match(/^data: (.*)$/s);
        if (!m) continue;
        const data = m[1].trim();
        if (data === '[DONE]') {
          console.log('OpenAI stream done, sending done message'); // Debug log
          ws.send(JSON.stringify({ type: 'done' }));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            console.log('Sending chunk:', delta); // Debug log
            ws.send(JSON.stringify({ type: 'chunk', text: delta }));
          }
        } catch (err) {
          // ignore parse errors for non-json lines
          console.error('parse error', err);
        }
      }
    }

    console.log('Sending final done message'); // Debug log
    ws.send(JSON.stringify({ type: 'done' }));
  } catch (err) {
    console.error('streamOpenAI error', err);
    try {
      ws.send(JSON.stringify({ type: 'error', error: String(err) }));
    } catch (e) {}
  }
}

wss.on('connection', (ws, req) => {
  console.log('ws connected');

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString());
      console.log('WebSocket message received:', payload); // Debug log
      if (payload.type === 'ask') {
        // payload.messages should be an array of {role, content}
        // Echo an ack and then stream
        ws.send(JSON.stringify({ type: 'ack' }));
        await streamOpenAI(ws, payload.messages);
      }
    } catch (err) {
      console.error('ws message error', err);
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('ws disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

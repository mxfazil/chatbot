const WebSocket = require('ws');

const url = 'ws://localhost:3000/ws';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('connected to', url);
  const payload = {
    type: 'ask',
    messages: [{ role: 'user', content: 'Hello, can you reply briefly?' }],
  };
  ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('recv:', msg);
  } catch (e) {
    console.log('recv raw:', data.toString());
  }
});

ws.on('error', (err) => console.error('ws error', err));
ws.on('close', () => console.log('ws closed'));

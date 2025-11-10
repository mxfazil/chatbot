# Chat UI (OpenAI-like) — Fullstack example

This project is a minimal full-stack chat app that emulates OpenAI Chat UI and streams responses in real time.

Overview
- Backend: Express + WebSocket. The server proxies to the OpenAI Chat Completions API with streaming and forwards incremental tokens to clients over WebSocket.
- Frontend: React + Vite. Clean UI, message bubbles, streaming partial responses.

Before you start
1. Copy `.env.example` to `.env` and add your OpenAI API key:

   OPENAI_API_KEY=sk-...

2. Install dependencies:

   npm install
   npm install --prefix client

Run (development)

Start the backend server in one terminal:

```powershell
npm run start
```

Start the frontend dev server in another terminal:

```powershell
npm run client:dev
```

Then open http://localhost:5173 (Vite default) and test the chat. The backend listens on the port set in `.env` (default 3000) and accepts WebSocket connections at `ws://localhost:3000/ws`.

Build for production

```powershell
npm run client:build
# then serve the `client/dist` folder with your preferred static host
```

Notes
- Add your OpenAI API key only to `.env`. Do not commit it.
- This example uses streaming to provide token-by-token updates. It's a starting point — you can adjust models and UI as needed.

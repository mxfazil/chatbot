import React, { useEffect, useRef, useState } from 'react'

function Message({ m }) {
  return (
    <div className={`message ${m.role}`}>
      {m.role === 'assistant' && <div className="avatar">🤖</div>}
      <div className="bubble">{m.content}</div>
      {m.role === 'user' && <div className="avatar user">You</div>}
    </div>
  )
}

export default function Chat({ voiceEnabled = false }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello — start the conversation.' },
  ])
  const [input, setInput] = useState('')
  const wsRef = useRef(null)
  const pendingRef = useRef(null)
  const messagesRef = useRef(messages)
  const voiceEnabledRef = useRef(voiceEnabled)
  const currentAudioRef = useRef(null) // To track current audio playback
  const sentenceBufferRef = useRef('') // To accumulate text for sentence detection
  const audioQueueRef = useRef([]) // Queue for audio playback
  const isPlayingRef = useRef(false) // Track if audio is currently playing

  // Keep refs in sync with props and state
  useEffect(() => {
    console.log('Voice enabled prop updated:', voiceEnabled);
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // keep ref in sync with state so closures can read latest
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    // Connect to backend WebSocket
    const url = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + (location.hostname || 'localhost') + ':3000/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.addEventListener('open', () => {
      console.log('ws open')
    })

    ws.addEventListener('message', (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        console.log('WebSocket message received:', payload); // Debug log
        if (payload.type === 'chunk') {
          // append to pending message
          setMessages((prev) => {
            if (pendingRef.current == null) {
              // create a pending assistant message and append to messages
              pendingRef.current = { role: 'assistant', content: '' }
              const next = [...prev, pendingRef.current]
              return next
            }
            // mutate the pending content and return a new array object to trigger update
            pendingRef.current.content += payload.text
            return prev.slice()
          })
          
          // Handle sentence-by-sentence speaking when voice is enabled
          if (voiceEnabledRef.current) {
            handleSentenceSpeaking(payload.text);
          }
        } else if (payload.type === 'done') {
          console.log('Message stream done, voiceEnabled (prop):', voiceEnabled, 'voiceEnabled (ref):', voiceEnabledRef.current); // Debug log
          console.log('Current messages:', messagesRef.current); // Debug log
          // finished streaming for this assistant reply
          pendingRef.current = null
          // Speak any remaining text in the buffer
          if (voiceEnabledRef.current && sentenceBufferRef.current.trim()) {
            addToAudioQueue(sentenceBufferRef.current);
            sentenceBufferRef.current = '';
          }
        } else if (payload.type === 'ack') {
          // optional: show typing indicator
        } else if (payload.type === 'error') {
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + payload.error }])
        }
      } catch (err) {
        console.error(err)
      }
    })

    ws.addEventListener('close', () => console.log('ws closed'))

    return () => {
      ws.close();
      // Stop any ongoing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    }
  }, []) // Only run once on mount

  // Handle sentence-by-sentence speaking
  function handleSentenceSpeaking(newText) {
    sentenceBufferRef.current += newText;
    
    // Check if we have a complete sentence (ending with ., !, or ?)
    const sentences = sentenceBufferRef.current.split(/(?<=[.!?])\s+/);
    
    // If we have at least one complete sentence
    if (sentences.length > 1) {
      // Speak all complete sentences
      for (let i = 0; i < sentences.length - 1; i++) {
        const sentence = sentences[i].trim();
        if (sentence) {
          addToAudioQueue(sentence);
        }
      }
      
      // Keep the last (potentially incomplete) part in the buffer
      sentenceBufferRef.current = sentences[sentences.length - 1];
    }
    // If no complete sentence yet, we keep accumulating in the buffer
  }

  // Add text to audio queue instead of playing immediately
  function addToAudioQueue(text) {
    if (!voiceEnabledRef.current || !text.trim()) {
      return;
    }
    
    audioQueueRef.current.push(text);
    processAudioQueue();
  }

  // Process the audio queue sequentially
  async function processAudioQueue() {
    // If already playing or queue is empty, do nothing
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }
    
    isPlayingRef.current = true;
    
    while (audioQueueRef.current.length > 0) {
      const text = audioQueueRef.current.shift();
      await speakText(text);
    }
    
    isPlayingRef.current = false;
  }

  // Speak text with proper queue management
  async function speakText(text) {
    if (!voiceEnabledRef.current || !text.trim()) {
      return Promise.resolve();
    }

    try {
      // Use the backend server for TTS requests (port 3000)
      const protocol = location.protocol;
      const hostname = location.hostname;
      const backendOrigin = `${protocol}//${hostname}:3000`;
      
      console.log('Sending TTS request to:', `${backendOrigin}/api/tts`); // Debug log
      console.log('Text to speak:', text); // Debug log
      
      const resp = await fetch(`${backendOrigin}/api/tts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, format: 'mp3' }),
      })

      console.log('TTS response status:', resp.status); // Debug log
      if (!resp.ok) {
        const t = await resp.text()
        console.error('TTS server error', resp.status, t)
        return Promise.resolve();
      }

      const arrayBuffer = await resp.arrayBuffer()
      console.log('Received audio data of', arrayBuffer.byteLength, 'bytes'); // Debug log
      if (arrayBuffer.byteLength === 0) {
        console.error('Received empty audio data');
        return Promise.resolve();
      }
      
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      
      // Handle browser autoplay restrictions
      audio.muted = false;
      console.log('Attempting to play audio'); // Debug log
      
      // Store current audio reference
      currentAudioRef.current = audio;
      
      // Return a promise that resolves when audio playback completes
      return new Promise((resolve) => {
        // Try to play the audio
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio playback started successfully'); // Debug log
            })
            .catch((e) => {
              console.error('Audio play failed:', e);
              // Try to play muted as a fallback
              audio.muted = true;
              audio.play().catch((e2) => {
                console.error('Audio play failed even when muted:', e2);
              });
            });
        }
        
        // Resolve promise when playback ends
        audio.addEventListener('ended', () => {
          console.log('Audio playback ended'); // Debug log
          URL.revokeObjectURL(url)
          currentAudioRef.current = null;
          resolve();
        });
        
        // Also resolve if there's an error
        audio.addEventListener('error', () => {
          console.error('Audio playback error');
          URL.revokeObjectURL(url)
          currentAudioRef.current = null;
          resolve();
        });
      });
    } catch (err) {
      console.error('speakText error', err)
      return Promise.resolve();
    }
  }

  function sendMessage() {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    // append the user message to UI immediately
    setMessages((prev) => [...prev, userMsg])
    // prepare pending assistant message in UI
    pendingRef.current = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, pendingRef.current])
    // build messages array to send using latest messagesRef to avoid stale closures
    const toSend = [...messagesRef.current, userMsg]
    try {
      wsRef.current.send(JSON.stringify({ type: 'ask', messages: toSend }))
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to send message' }])
    }
    setInput('')
  }

  return (
    <div className="chat-root">
      <div className="messages">
        {messages.map((m, i) => (
          <Message key={i} m={m} />
        ))}
      </div>

      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything... Press Enter to send (Shift+Enter new line)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
        />
        <button onClick={sendMessage} className="send">Send</button>
      </div>
    </div>
  )
}
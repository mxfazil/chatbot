import React, { useState, useEffect, useCallback } from 'react'
import Chat from './components/Chat'

export default function App() {
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [userInteracted, setUserInteracted] = useState(false)

  // Handle user interaction for audio autoplay
  useEffect(() => {
    const handleUserInteraction = () => {
      console.log('User interaction detected, enabling voice');
      setUserInteracted(true)
      // Remove event listeners after first interaction
      window.removeEventListener('click', handleUserInteraction)
      window.removeEventListener('keydown', handleUserInteraction)
      window.removeEventListener('touchstart', handleUserInteraction)
    }

    // Add multiple event listeners to catch different types of interaction
    window.addEventListener('click', handleUserInteraction)
    window.addEventListener('keydown', handleUserInteraction)
    window.addEventListener('touchstart', handleUserInteraction)

    return () => {
      window.removeEventListener('click', handleUserInteraction)
      window.removeEventListener('keydown', handleUserInteraction)
      window.removeEventListener('touchstart', handleUserInteraction)
    }
  }, [])

  const handleEnableVoice = useCallback(() => {
    console.log('Voice manually enabled');
    setUserInteracted(true)
  }, [])

  // Log state changes for debugging
  useEffect(() => {
    console.log('App state changed - voiceEnabled:', voiceEnabled, 'userInteracted:', userInteracted);
  }, [voiceEnabled, userInteracted])

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Chat Bot</h2>
          <span className="status">● Online</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>Voice replies (OpenAI TTS)</span>
          </label>
          {!userInteracted && voiceEnabled && (
            <div style={{ 
              marginTop: 8, 
              padding: 8, 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: 4,
              fontSize: 12
            }}>
              <div>Click anywhere or click the button below to enable voice replies</div>
              <button 
                onClick={handleEnableVoice}
                style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  fontSize: 11,
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Enable Voice
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <Chat voiceEnabled={voiceEnabled && userInteracted} />
      </main>
    </div>
  )
}
const fs = require('fs');

async function testTTS() {
  try {
    console.log('Testing TTS functionality...');
    
    const response = await fetch('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, this is a test of the text to speech functionality.',
        format: 'mp3'
      }),
    });

    console.log('TTS response status:', response.status);
    
    if (response.ok) {
      console.log('TTS request successful');
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Received audio data of ${arrayBuffer.byteLength} bytes`);
      
      // Save to file for verification
      fs.writeFileSync('test_audio.mp3', Buffer.from(arrayBuffer));
      console.log('Audio saved to test_audio.mp3');
    } else {
      const errorText = await response.text();
      console.error('TTS request failed:', response.status, errorText);
    }
  } catch (error) {
    console.error('Error testing TTS:', error);
  }
}

testTTS();
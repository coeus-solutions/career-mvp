const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Create WebSocket server for proxying to OpenAI
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (clientWs, request) => {
    console.log('Client connected to proxy WebSocket');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('No OpenAI API key found');
      clientWs.close(1008, 'No API key configured');
      return;
    }

    // Connect to OpenAI RealTime API
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    openaiWs.on('open', () => {
      console.log('Connected to OpenAI RealTime API');
      
      // Send initial session configuration
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: `You are CASEY, a helpful and encouraging career advisor for students. 
            Your role is to:
            - Help students explore career paths based on their interests and skills
            - Provide information about different careers and industries
            - Assist with job searching and application strategies
            - Offer interview preparation and practice
            - Guide resume and cover letter creation
            - Give advice on professional development and networking
            - Be supportive, encouraging, and empathetic
            - Use simple, clear language appropriate for students
            - Ask clarifying questions to better understand student needs
            - Provide actionable advice and next steps
            
            Language capability:
            - You can communicate fluently in multiple languages
            - If a user asks you to speak in a different language (e.g., "Can you speak in Urdu?", "Talk to me in Spanish", "Switch to French"), immediately switch to that language
            - Continue the conversation in the requested language until asked to switch again
            - Maintain the same helpful, encouraging tone regardless of language
            - If you don't know a requested language well, politely explain this in the current language`,
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200
          },
          temperature: 0.8,
          max_response_output_tokens: 'inf'
        }
      }));
    });

    openaiWs.on('message', (data) => {
      // Forward messages from OpenAI to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    openaiWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: {
            message: 'Connection to OpenAI failed',
            details: error.message
          }
        }));
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log('OpenAI WebSocket closed:', code, reason);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason);
      }
    });

    // Forward messages from client to OpenAI
    clientWs.on('message', (message) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(message.toString());
      }
    });

    clientWs.on('close', () => {
      console.log('Client disconnected');
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });

    clientWs.on('error', (error) => {
      console.error('Client WebSocket error:', error);
    });
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url);
    
    if (pathname === '/api/realtime/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> WebSocket proxy ready at /api/realtime/ws');
  });
});
'use client';

import { useState, useEffect } from 'react';
import { SimpleRealtimeClient } from '@/app/lib/openai/simple-realtime-client';

export default function TestSimple() {
  const [status, setStatus] = useState('Initializing...');
  const [apiKey, setApiKey] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [client, setClient] = useState<SimpleRealtimeClient | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/api/realtime/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch API key');
        }
        
        const data = await response.json();
        setApiKey(data.apiKey);
        addEvent('API key fetched');
      } catch (error) {
        console.error('Failed to fetch API key:', error);
        setStatus('Failed to fetch API key');
      }
    };
    
    fetchApiKey();
  }, []);


  const testConnection = async () => {
    if (!apiKey) {
      alert('No API key available');
      return;
    }

    try {
      setStatus('Connecting...');
      addEvent('Creating client...');
      
      const newClient = new SimpleRealtimeClient(apiKey, { debug: true });
      
      // Set up event listeners
      newClient.on('connected', () => {
        setStatus('Connected! ✅');
        addEvent('Connected successfully');
        
        // Send initial session configuration
        newClient.updateSession({
          modalities: ['text', 'audio'],
          instructions: 'You are CASEY, a helpful career advisor. Say hello!',
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
          temperature: 0.8
        });
        
        addEvent('Session configuration sent');
      });
      
      newClient.on('session.created', (data: { session?: { id?: string } }) => {
        addEvent(`Session created: ${data.session?.id || 'unknown'}`);
      });
      
      newClient.on('session.updated', () => {
        addEvent('Session updated');
      });
      
      newClient.on('error', (data: unknown) => {
        console.error('Error event:', data);
        addEvent(`Error: ${JSON.stringify(data)}`);
        setStatus('Error occurred ❌');
      });
      
      newClient.on('disconnected', (data: { code?: number; reason?: string }) => {
        addEvent(`Disconnected: code=${data.code}, reason=${data.reason}`);
        setStatus('Disconnected');
      });
      
      // Connect
      await newClient.connect();
      setClient(newClient);
      
    } catch (error) {
      console.error('Connection error:', error);
      setStatus('Connection failed ❌');
      addEvent(`Error: ${error}`);
    }
  };

  const sendTestMessage = () => {
    if (!client || !client.isConnected()) {
      alert('Not connected');
      return;
    }
    
    client.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: 'Hello CASEY, can you help me with my career?'
        }]
      }
    });
    
    client.createResponse();
    addEvent('Test message sent');
  };

  const disconnect = () => {
    if (client) {
      client.disconnect();
      setClient(null);
      setStatus('Disconnected');
      addEvent('Manually disconnected');
    }
  };

  const addEvent = (event: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [...prev, `[${timestamp}] ${event}`]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Simple RealTime Client Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status: {status}</h2>
          
          <div className="space-x-4">
            <button
              onClick={testConnection}
              disabled={!apiKey || client?.isConnected()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Connect
            </button>
            
            <button
              onClick={sendTestMessage}
              disabled={!client?.isConnected()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              Send Test Message
            </button>
            
            <button
              onClick={disconnect}
              disabled={!client?.isConnected()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              Disconnect
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Event Log</h2>
          <div className="bg-gray-50 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {events.map((event, i) => (
              <div key={i} className="mb-1">{event}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
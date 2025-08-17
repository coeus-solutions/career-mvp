'use client';

import { useState } from 'react';
import { ProxyRealtimeClient } from '@/app/lib/openai/proxy-realtime-client';

export default function TestProxyPage() {
  const [status, setStatus] = useState<string>('Not connected');
  const [logs, setLogs] = useState<string[]>([]);
  const [client, setClient] = useState<ProxyRealtimeClient | null>(null);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testConnection = async () => {
    try {
      addLog('Creating proxy client...');
      
      const newClient = new ProxyRealtimeClient();
      
      // Set up event handlers
      newClient.on('connected', () => {
        addLog('Connected to proxy successfully');
        setStatus('Connected via proxy!');
      });
      
      newClient.on('session.created', (event: Record<string, unknown>) => {
        const session = event.session as { id?: string } | undefined;
        addLog(`Session created: ${session?.id || 'unknown'}`);
      });
      
      newClient.on('session.updated', () => {
        addLog('Session updated');
      });
      
      newClient.on('error', (event: unknown) => {
        addLog(`Error: ${JSON.stringify(event)}`);
        setStatus('Error occurred');
      });
      
      newClient.on('disconnected', (event: Record<string, unknown>) => {
        const code = event.code as number | undefined;
        const reason = event.reason as string | undefined;
        addLog(`Disconnected: code=${code}, reason=${reason}`);
        setStatus('Disconnected');
      });
      
      newClient.on('*', (event: Record<string, unknown>) => {
        const eventType = event.type as string | undefined;
        if (eventType && !['error', 'connected', 'disconnected'].includes(eventType)) {
          addLog(`Event: ${eventType}`);
        }
      });
      
      addLog('Connecting to proxy WebSocket...');
      await newClient.connect();
      
      setClient(newClient);
      
      // Send initial session configuration after connection
      setTimeout(() => {
        addLog('Sending session configuration...');
        newClient.updateSession({
          modalities: ['text', 'audio'],
          instructions: 'You are CASEY, a helpful career advisor for students. Please introduce yourself briefly.',
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          temperature: 0.8
        });
      }, 500);
      
    } catch (error) {
      setStatus('Connection failed');
      addLog(`Error: ${error}`);
      console.error('Full error:', error);
    }
  };

  const sendTestMessage = () => {
    if (!client || !client.isConnected()) {
      alert('Not connected');
      return;
    }
    
    addLog('Sending test message...');
    client.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: 'Hello CASEY! Can you help me explore career options?'
        }]
      }
    });
    
    setTimeout(() => {
      client.createResponse();
      addLog('Response requested');
    }, 100);
  };

  const disconnect = () => {
    if (client) {
      client.disconnect();
      setClient(null);
      setStatus('Disconnected');
      addLog('Manually disconnected');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Proxy WebSocket Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-lg mb-4">
            Status: <span className="font-semibold text-blue-600">{status}</span>
          </p>
          
          <div className="space-x-4">
            <button 
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={client?.isConnected()}
            >
              Connect via Proxy
            </button>
            
            <button 
              onClick={sendTestMessage}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              disabled={!client?.isConnected()}
            >
              Send Test Message
            </button>
            
            <button 
              onClick={disconnect}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              disabled={!client?.isConnected()}
            >
              Disconnect
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Connection Logs</h2>
          <div className="bg-gray-50 rounded p-4 font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 text-gray-700">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">✅ How This Works</h2>
          <p className="text-blue-800 mb-2">
            This page connects to our local WebSocket proxy at <code className="bg-blue-100 px-1 rounded">/api/realtime/ws</code>
          </p>
          <p className="text-blue-800 mb-2">
            The proxy server handles the authentication with OpenAI&apos;s RealTime API using proper headers.
          </p>
          <p className="text-blue-800">
            This approach works around browser WebSocket limitations and provides a secure connection.
          </p>
        </div>
      </div>
    </div>
  );
}
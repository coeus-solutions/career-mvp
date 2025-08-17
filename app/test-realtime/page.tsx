'use client';

import { useState, useEffect } from 'react';
import { RealtimeClient } from '@/app/lib/openai/realtime-client';

export default function TestRealtime() {
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const addEvent = (event: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [...prev, `[${timestamp}] ${event}`]);
    };
    
    const testConnection = async () => {
      try {
        setStatus('Fetching API key...');
        
        // Get API key from server
        const response = await fetch('/api/realtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: {} })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch API configuration');
        }
        
        const data = await response.json();
        
        setStatus('Connecting to OpenAI RealTime API...');
        
        // Create client
        const client = new RealtimeClient({
          apiKey: data.apiKey,
          debug: true
        });
        
        // Set up event listeners
        client.on('connected', () => {
          setStatus('Connected successfully! ✅');
          addEvent('Connected to OpenAI RealTime API');
        });
        
        client.on('session.created', (session: { id?: string }) => {
          addEvent(`Session created: ${session.id}`);
        });
        
        client.on('error', (error: unknown) => {
          console.error('RealTime error:', error);
          setError(JSON.stringify(error, null, 2));
          const errorObj = error as { message?: string; type?: string } | null;
          addEvent(`Error: ${errorObj?.message || errorObj?.type || 'Unknown error'}`);
        });
        
        client.on('disconnected', (info: { reason?: string }) => {
          setStatus('Disconnected');
          addEvent(`Disconnected: ${info.reason || 'Unknown reason'}`);
        });
        
        // Connect
        await client.connect();
        
        // Send test session update
        client.updateSession({
          modalities: ['text', 'audio'],
          instructions: 'You are CASEY, a helpful career advisor.',
          voice: 'alloy',
          temperature: 0.8
        });
        
        addEvent('Session configuration sent');
        
      } catch (err) {
        console.error('Test error:', err);
        setStatus('Connection failed ❌');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    
    testConnection();
  }, []);


  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OpenAI RealTime API Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <p className="text-lg">
            Status: <span className={error ? 'text-red-600' : 'text-blue-600'}>{status}</span>
          </p>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">Error Details:</h3>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Event Log</h2>
          <div className="bg-gray-50 rounded p-4 h-64 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              events.map((event, index) => (
                <div key={index} className="text-sm font-mono mb-1">
                  {event}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}
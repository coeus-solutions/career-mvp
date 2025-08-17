'use client'

import { useState } from 'react'
import { CaseyRealtimeClient } from '@/app/lib/openai/casey-realtime-client'

export default function TestCaseyPage() {
  const [status, setStatus] = useState<string>('Not connected')
  const [logs, setLogs] = useState<string[]>([])
  const [client, setClient] = useState<CaseyRealtimeClient | null>(null)
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testConnection = async () => {
    try {
      addLog('Fetching API key...')
      
      // Get API key from server
      const response = await fetch('/api/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: {} })
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch API key')
      }
      
      const data = await response.json()
      const apiKey = data.apiKey
      
      addLog(`Got API key: ${apiKey.substring(0, 10)}...`)
      addLog('Creating client...')
      
      const newClient = new CaseyRealtimeClient(apiKey)
      
      // Set up event handlers
      newClient.on('session.created', (event: { session?: { id?: string } }) => {
        addLog(`Session created: ${event.session?.id || 'unknown'}`)
      })
      
      newClient.on('session.updated', () => {
        addLog('Session updated')
      })
      
      newClient.on('error', (event: unknown) => {
        addLog(`Error: ${JSON.stringify(event)}`)
        setStatus('Error occurred')
      })
      
      newClient.on('*', (event: Record<string, unknown>) => {
        addLog(`Event: ${event.type as string}`)
      })
      
      addLog('Connecting to OpenAI Realtime API...')
      await newClient.connect()
      
      setStatus('Connected!')
      addLog('Connected successfully')
      setClient(newClient)
      
      // Send initial session configuration
      setTimeout(() => {
        addLog('Sending session update...')
        newClient.updateSession({
          modalities: ['text', 'audio'],
          instructions: 'You are CASEY, a helpful career advisor for students. Say hello!',
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
        })
        addLog('Session configuration sent')
      }, 1000)
      
    } catch (error) {
      setStatus('Connection failed')
      addLog(`Error: ${error}`)
      console.error('Full error:', error)
    }
  }

  const sendTestMessage = () => {
    if (!client || !client.isConnected()) {
      alert('Not connected')
      return
    }
    
    addLog('Sending test message...')
    client.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: 'Hello CASEY!'
        }]
      }
    })
    
    setTimeout(() => {
      client.createResponse()
      addLog('Response requested')
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">CASEY Realtime API Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-lg mb-4">Status: <span className="font-semibold">{status}</span></p>
          
          <div className="space-x-4">
            <button 
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={client?.isConnected()}
            >
              Test Connection
            </button>
            
            <button 
              onClick={sendTestMessage}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={!client?.isConnected()}
            >
              Send Test Message
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
                <div key={i} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Check browser console for detailed WebSocket logs</li>
            <li>• Ensure API key starts with &quot;sk-&quot;</li>
            <li>• Verify you have access to gpt-4o-realtime-preview model</li>
            <li>• The connection uses WebSocket subprotocols for authentication</li>
            <li>• If connection fails, check if your API key has RealTime API access</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
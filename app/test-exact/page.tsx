'use client'

import { useState, useEffect } from 'react'
import { ExactRealtimeClient } from '@/app/lib/openai/exact-realtime-client'

export default function TestExactPage() {
  const [status, setStatus] = useState<string>('Not connected')
  const [logs, setLogs] = useState<string[]>([])
  const [apiKey, setApiKey] = useState<string>('')
  
  useEffect(() => {
    // Get API key from environment
    const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
    if (key) {
      setApiKey(key)
      addLog('Using public API key from environment')
    } else {
      // Fetch from server
      fetch('/api/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: {} })
      })
      .then(res => res.json())
      .then(data => {
        setApiKey(data.apiKey)
        addLog('API key fetched from server')
      })
      .catch(err => {
        addLog(`Failed to fetch API key: ${err}`)
      })
    }
  }, [])
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const testConnection = async () => {
    if (!apiKey) {
      addLog('No API key available')
      return
    }

    try {
      addLog(`Using API key: ${apiKey.substring(0, 10)}...`)
      addLog('Creating ExactRealtimeClient...')
      const client = new ExactRealtimeClient(apiKey)
      
      // Log all events
      client.on('*', (event: Record<string, unknown>) => {
        addLog(`Event: ${event.type as string}`)
      })

      client.on('error', (error: unknown) => {
        addLog(`Error: ${JSON.stringify(error)}`)
      })

      addLog('Connecting...')
      await client.connect()
      
      setStatus('Connected!')
      addLog('Connected successfully')
      
      // Test sending a message
      setTimeout(() => {
        addLog('Sending session update...')
        client.send({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'Say hello and introduce yourself.',
            voice: 'alloy'
          }
        })
        
        setTimeout(() => {
          addLog('Creating response...')
          client.createResponse()
        }, 1000)
      }, 1000)

    } catch (error) {
      setStatus('Connection failed')
      addLog(`Error: ${error}`)
      console.error('Full error details:', error)
    }
  }

  const testDirectWebSocket = () => {
    addLog('Testing direct WebSocket connection...')
    
    const testWs = new WebSocket('wss://echo.websocket.org/')
    
    testWs.onopen = () => {
      addLog('✅ WebSocket test successful - browser can connect to WebSocket servers')
      testWs.close()
    }
    
    testWs.onerror = (error) => {
      addLog('❌ WebSocket test failed - browser cannot connect to WebSocket servers')
      console.error('WebSocket test error:', error)
    }
  }

  const testOpenAIEndpoint = async () => {
    addLog('Testing OpenAI API endpoint...')
    
    try {
      const response = await fetch('/api/test-openai')
      const data = await response.json()
      
      if (data.success) {
        addLog(`✅ API key is valid, found ${data.realtimeModels.length} realtime models`)
        data.realtimeModels.forEach((model: string) => {
          if (model.includes('realtime')) {
            addLog(`  - ${model}`)
          }
        })
      } else {
        addLog('❌ API key test failed')
      }
    } catch (error) {
      addLog(`❌ Failed to test API: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          Exact Copy of Edubites Realtime Test
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <p className="mb-4">Status: <span className="font-bold">{status}</span></p>
          <p className="mb-4 text-sm text-gray-600">
            API Key: {apiKey ? `${apiKey.substring(0, 10)}...` : 'Not loaded'}
          </p>
          
          <div className="space-x-2">
            <button 
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!apiKey}
            >
              Test Connection
            </button>
            
            <button 
              onClick={testDirectWebSocket}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test WebSocket
            </button>
            
            <button 
              onClick={testOpenAIEndpoint}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Test API Key
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Connection Logs</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs h-96 overflow-y-auto">
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Debugging Info</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Check browser console for detailed errors</li>
            <li>• WebSocket URL: wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17</li>
            <li>• Subprotocols: openai-beta.realtime-v1, openai-insecure-api-key.[YOUR_KEY]</li>
            <li>• This exact code works in the edubites project</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
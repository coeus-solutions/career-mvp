'use client'

import { useState, useEffect } from 'react'
import { RealtimeWebRTCClient } from '@/app/lib/openai/realtime-webrtc-client'

export default function TestWebRTCPage() {
  const [status, setStatus] = useState<string>('Not connected')
  const [logs, setLogs] = useState<string[]>([])
  const [client, setClient] = useState<RealtimeWebRTCClient | null>(null)
  const [apiKey, setApiKey] = useState<string>('')
  const [transcripts, setTranscripts] = useState<{user: string[], assistant: string[]}>({
    user: [],
    assistant: []
  })
  
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

  const testWebRTCConnection = async () => {
    if (!apiKey) {
      addLog('No API key available')
      return
    }

    try {
      addLog(`Using API key: ${apiKey.substring(0, 10)}...`)
      addLog('Creating WebRTC client...')
      const newClient = new RealtimeWebRTCClient(apiKey)
      
      // Set up event handlers
      newClient.on('*', (event: Record<string, unknown>) => {
        const eventType = event.type as string;
        addLog(`Event: ${eventType}`)
        
        // Track conversation items
        if (eventType === 'conversation.item.created') {
          const item = event.item as { role?: string } | undefined;
          if (item?.role === 'user') {
            addLog(`User message created`)
          } else if (item?.role === 'assistant') {
            addLog(`Assistant message created`)
          }
        }
        
        // Track transcriptions
        if (eventType === 'conversation.item.input_audio_transcription.completed') {
          const transcript = event.transcript as string | undefined;
          addLog(`User said: "${transcript}"`)
          setTranscripts(prev => ({
            ...prev,
            user: [...prev.user, transcript || '']
          }))
        }
        
        if (eventType === 'response.audio_transcript.delta') {
          const delta = event.delta as string | undefined;
          addLog(`Assistant says: "${delta}"`)
        }
      })

      newClient.on('error', (error: unknown) => {
        addLog(`Error: ${JSON.stringify(error)}`)
        setStatus('Error occurred')
      })

      addLog('Connecting via WebRTC...')
      await newClient.connect()
      
      setClient(newClient)
      setStatus('Connected via WebRTC!')
      addLog('WebRTC connection established successfully')
      
      // Configure session after connection
      setTimeout(() => {
        addLog('Configuring session...')
        newClient.updateSession({
          modalities: ['text', 'audio'],
          instructions: 'You are CASEY, a helpful AI career advisor for students. Introduce yourself briefly and ask how you can help with their career journey.',
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
            silence_duration_ms: 500
          },
          temperature: 0.8
        })
        
        // Create initial response
        setTimeout(() => {
          addLog('Requesting initial greeting...')
          newClient.createResponse()
        }, 500)
      }, 1000)

    } catch (error) {
      setStatus('Connection failed')
      addLog(`Error: ${error}`)
      console.error('Full error details:', error)
    }
  }
  
  const sendTextMessage = () => {
    if (!client || !client.isConnected()) {
      alert('Not connected')
      return
    }
    
    const message = "I'm a computer science student interested in AI. What career paths would you recommend?"
    addLog(`Sending text message: "${message}"`)
    
    client.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: message
        }]
      }
    })
    
    setTimeout(() => {
      client.createResponse()
      addLog('Response requested')
    }, 100)
  }
  
  const disconnect = () => {
    if (client) {
      client.disconnect()
      setClient(null)
      setStatus('Disconnected')
      addLog('Disconnected from WebRTC')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          WebRTC RealTime API Test
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <p className="mb-4">
            Status: <span className="font-bold text-blue-600">{status}</span>
          </p>
          <p className="mb-4 text-sm text-gray-600">
            API Key: {apiKey ? `${apiKey.substring(0, 10)}...` : 'Not loaded'}
          </p>
          
          <div className="space-x-2">
            <button 
              onClick={testWebRTCConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={!apiKey || client?.isConnected()}
            >
              Connect via WebRTC
            </button>
            
            <button 
              onClick={sendTextMessage}
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

        {/* Transcripts Display */}
        {(transcripts.user.length > 0 || transcripts.assistant.length > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <h2 className="text-lg font-semibold mb-3">Conversation</h2>
            <div className="space-y-2">
              {transcripts.user.map((text, i) => (
                <div key={`user-${i}`} className="flex">
                  <span className="font-semibold text-blue-600 mr-2">You:</span>
                  <span>{text}</span>
                </div>
              ))}
              {transcripts.assistant.map((text, i) => (
                <div key={`assistant-${i}`} className="flex">
                  <span className="font-semibold text-green-600 mr-2">CASEY:</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
          <h3 className="font-semibold text-green-800 mb-2">WebRTC Implementation</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Uses RTCPeerConnection for real-time audio/video</li>
            <li>• Data channel for bidirectional event communication</li>
            <li>• Direct browser-to-OpenAI connection</li>
            <li>• No CORS issues like with WebSocket</li>
            <li>• Following the exact edubites implementation pattern</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
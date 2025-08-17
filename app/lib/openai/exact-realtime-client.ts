type EventHandler = (event: Record<string, unknown>) => void

export class ExactRealtimeClient {
  private ws: WebSocket | null = null
  private eventHandlers: Map<string, EventHandler> = new Map()
  private connected = false
  
  constructor(private apiKey: string) {}

  async connect(model: string = 'gpt-4o-realtime-preview-2024-12-17') {
    return new Promise((resolve, reject) => {
      try {
        // OpenAI Realtime API WebSocket URL with authentication
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`
        
        // Create WebSocket with proper headers through subprotocol
        this.ws = new WebSocket(wsUrl, [
          'openai-beta.realtime-v1',
          `openai-insecure-api-key.${this.apiKey}`
        ])

        this.ws.onopen = () => {
          this.connected = true
          console.log('Connected to OpenAI Realtime API')
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('Received event:', data.type)
            
            // Handle all event types
            const handler = this.eventHandlers.get(data.type)
            if (handler) {
              handler(data)
            }
            
            // Also check for wildcard handler
            const wildcardHandler = this.eventHandlers.get('*')
            if (wildcardHandler) {
              wildcardHandler(data)
            }
          } catch (err) {
            console.error('Failed to parse message:', err)
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          const handler = this.eventHandlers.get('error')
          if (handler) {
            handler({ type: 'error', error })
          }
          reject(error)
        }

        this.ws.onclose = () => {
          this.connected = false
          console.log('Disconnected from OpenAI Realtime API')
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  on(event: string, handler: EventHandler) {
    this.eventHandlers.set(event, handler)
  }

  send(event: Record<string, unknown>) {
    if (this.ws && this.connected) {
      console.log('Sending event:', event.type)
      this.ws.send(JSON.stringify(event))
    } else {
      console.error('Cannot send event - not connected')
    }
  }

  sendAudio(audio: ArrayBuffer) {
    if (this.ws && this.connected) {
      // Convert ArrayBuffer to base64
      const uint8Array = new Uint8Array(audio)
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64Audio = btoa(binary)
      
      this.send({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      })
    }
  }

  createResponse() {
    this.send({
      type: 'response.create',
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected() {
    return this.connected
  }
}
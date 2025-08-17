export class RealtimeWebRTCClient {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private eventHandlers: Map<string, (event: Record<string, unknown>) => void> = new Map()
  private connected = false
  private audioElement: HTMLAudioElement | null = null

  constructor(private apiKey: string) {}

  async connect(model: string = 'gpt-4o-realtime-preview-2024-12-17') {
    return new Promise<void>((resolve, reject) => {
      const setupConnection = async () => {
        try {
          // Create a peer connection
          this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          })

          // Set up to play remote audio from the model
          this.audioElement = document.createElement('audio')
          this.audioElement.autoplay = true
          
          this.pc.ontrack = (e) => {
            console.log('Received remote track:', e.track.kind)
            if (this.audioElement && e.streams[0]) {
              this.audioElement.srcObject = e.streams[0]
            }
          }

          // Add local audio track for microphone input
          try {
            const ms = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              } 
            })
            
            ms.getTracks().forEach(track => {
              console.log('Adding local track:', track.kind)
              this.pc!.addTrack(track, ms)
            })
          } catch (err) {
            console.error('Failed to get user media:', err)
            reject(new Error('Failed to access microphone'))
            return
          }

        // Set up data channel for sending and receiving events
        this.dc = this.pc.createDataChannel('oai-events', {
          ordered: true
        })
        
        this.dc.addEventListener('open', () => {
          console.log('Data channel opened')
          this.connected = true
          resolve()
        })

        this.dc.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data)
            console.log('Received event:', data.type)
            
            // Handle specific event types
            const handler = this.eventHandlers.get(data.type)
            if (handler) {
              handler(data)
            }
            
            // Also trigger wildcard handler
            const wildcardHandler = this.eventHandlers.get('*')
            if (wildcardHandler) {
              wildcardHandler(data)
            }
          } catch (err) {
            console.error('Failed to parse message:', err)
          }
        })

        this.dc.addEventListener('error', (error) => {
          console.error('Data channel error:', error)
          const handler = this.eventHandlers.get('error')
          if (handler) {
            handler({ type: 'error', error })
          }
        })

        // Start the session using the Session Description Protocol (SDP)
        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)

        // Connect to OpenAI Realtime API
        const baseUrl = 'https://api.openai.com/v1/realtime'
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/sdp'
          },
        })

        if (!sdpResponse.ok) {
          const error = await sdpResponse.text()
          console.error('SDP response error:', sdpResponse.status, error)
          throw new Error(`Failed to establish WebRTC connection: ${sdpResponse.status}`)
        }

        const answer = {
          type: 'answer' as RTCSdpType,
          sdp: await sdpResponse.text(),
        }
        
        await this.pc.setRemoteDescription(answer)
        console.log('WebRTC connection established')
        
        } catch (error) {
          console.error('WebRTC connection error:', error)
          reject(error)
        }
      }
      
      setupConnection()
    })
  }

  on(event: string, handler: (event: Record<string, unknown>) => void) {
    this.eventHandlers.set(event, handler)
  }

  send(event: Record<string, unknown>) {
    if (this.dc && this.connected && this.dc.readyState === 'open') {
      console.log('Sending event:', event.type)
      this.dc.send(JSON.stringify(event))
    } else {
      console.error('Cannot send event - data channel not open', {
        connected: this.connected,
        dcState: this.dc?.readyState
      })
    }
  }

  updateSession(session: Record<string, unknown>) {
    this.send({
      type: 'session.update',
      session
    })
  }

  createResponse() {
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    })
  }

  disconnect() {
    if (this.dc) {
      this.dc.close()
      this.dc = null
    }
    
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.srcObject = null
      this.audioElement = null
    }
    
    this.connected = false
  }

  isConnected() {
    return this.connected
  }
}
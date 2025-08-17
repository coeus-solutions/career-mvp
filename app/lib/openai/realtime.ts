import { EventEmitter } from 'events';

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface SessionConfig {
  modalities?: string[];
  instructions?: string;
  voice?: string;
  temperature?: number;
  max_response_output_tokens?: number;
  turn_detection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
}

export class RealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private sessionId: string | null = null;
  private isConnected: boolean = false;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey; // Would be used for authentication in a proper implementation
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
        
        // Note: Browser WebSocket doesn't support headers in constructor
        // This would need a server-side proxy for proper authentication
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('Connected to OpenAI Realtime API');
          this.isConnected = true;
          this.initializeSession();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleEvent(data);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Disconnected from OpenAI Realtime API');
          this.isConnected = false;
          this.emit('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private initializeSession() {
    const sessionConfig: SessionConfig = {
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
      temperature: 0.7,
      max_response_output_tokens: 4096,
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      }
    };

    this.send({
      type: 'session.update',
      session: sessionConfig
    });
  }

  send(event: RealtimeEvent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }
    
    this.ws.send(JSON.stringify(event));
  }

  private handleEvent(event: RealtimeEvent) {
    switch (event.type) {
      case 'session.created':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.sessionId = (event as any).session?.id;
        console.log('Session created:', this.sessionId);
        this.emit('session.created', event);
        break;

      case 'session.updated':
        console.log('Session updated');
        this.emit('session.updated', event);
        break;

      case 'conversation.item.created':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((event as any).item?.role === 'user') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.emit('user.message', (event as any).item);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if ((event as any).item?.role === 'assistant') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.emit('assistant.message', (event as any).item);
        }
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('speech.started');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('speech.stopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.emit('transcription.completed', event.transcript);
        break;

      case 'response.audio_transcript.delta':
        this.emit('response.text.delta', event.delta);
        break;

      case 'response.audio_transcript.done':
        this.emit('response.text.done', event.transcript);
        break;

      case 'response.audio.delta':
        this.emit('response.audio.delta', event.delta);
        break;

      case 'response.audio.done':
        this.emit('response.audio.done');
        break;

      case 'response.done':
        this.emit('response.done', event);
        break;

      case 'error':
        console.error('API Error:', event.error);
        this.emit('error', event.error);
        break;

      default:
        this.emit(event.type, event);
    }
  }

  sendAudioChunk(audioData: ArrayBuffer) {
    if (!this.isConnected) {
      console.error('Not connected to Realtime API');
      return;
    }

    const base64Audio = this.arrayBufferToBase64(audioData);
    
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  commitAudioBuffer() {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  clearAudioBuffer() {
    this.send({
      type: 'input_audio_buffer.clear'
    });
  }

  sendText(text: string) {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    });

    this.send({
      type: 'response.create'
    });
  }

  createResponse() {
    this.send({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    });
  }

  cancelResponse() {
    this.send({
      type: 'response.cancel'
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
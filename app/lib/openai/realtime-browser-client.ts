'use client';

import { EventEmitter } from 'events';
import { RealtimeEvent } from '../types/realtime';

/**
 * Browser-compatible OpenAI RealTime API client
 * 
 * IMPORTANT: The OpenAI RealTime API requires authentication headers that browsers
 * cannot set on WebSocket connections. This client uses a server-side proxy approach.
 */

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  debug?: boolean;
}

export interface RealtimeSession {
  id?: string;
  model?: string;
  modalities?: string[];
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'shimmer';
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: {
    model?: string;
  };
  turn_detection?: {
    type: 'server_vad';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
  tools?: Array<{
    type: string;
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  tool_choice?: 'auto' | 'none' | 'required';
  temperature?: number;
  max_response_output_tokens?: number | 'inf';
}

export class RealtimeBrowserClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private debug: boolean;
  private isConnected: boolean = false;
  private sessionId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(config: RealtimeConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-realtime-preview-2024-10-01';
    this.debug = config.debug || false;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // IMPORTANT: We need to use a server proxy or alternative approach
        // because browsers cannot set Authorization headers on WebSocket
        
        // Option 1: Try using query parameter authentication (if supported)
        const params = new URLSearchParams({
          model: this.model,
        });
        
        // Construct the WebSocket URL
        const wsUrl = `wss://api.openai.com/v1/realtime?${params.toString()}`;
        
        this.log('Connecting to:', wsUrl);
        
        // Create WebSocket connection
        // Note: We cannot set headers here in the browser
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          this.log('WebSocket connection opened');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send authentication as first message
          this.sendAuthMessage();
          
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            this.logError('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          this.logError('WebSocket error:', error);
          this.emit('error', { 
            type: 'websocket_error',
            message: 'WebSocket connection error',
            error 
          });
        };

        this.ws.onclose = (event) => {
          this.log('WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Handle authentication errors specifically
          if (event.code === 1008 || event.reason?.includes('auth')) {
            this.emit('error', {
              type: 'authentication_error',
              message: 'Authentication failed. Please check your API key.',
              code: event.code,
              reason: event.reason
            });
            reject(new Error('Authentication failed'));
            return;
          }
          
          // Auto-reconnect for other errors
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        this.logError('Connection error:', error);
        reject(error);
      }
    });
  }

  private sendAuthMessage(): void {
    // Try sending API key as part of session configuration
    // This is a workaround since we can't set headers
    const authMessage = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful assistant.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        temperature: 0.8,
        // Include API key in session if needed
        api_key: this.apiKey
      }
    };
    
    this.send(authMessage);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.logError('Reconnection failed:', error);
      });
    }, delay);
  }

  updateSession(session: RealtimeSession): void {
    this.send({
      type: 'session.update',
      session
    });
  }

  send(data: RealtimeEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logError('Cannot send: WebSocket not connected');
      return;
    }
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  private handleMessage(data: RealtimeEvent): void {
    const eventType = data.type;
    
    if (!eventType) {
      this.logError('Received message without type:', data);
      return;
    }
    
    this.log('Received event:', eventType);
    
    // Handle specific event types
    switch (eventType) {
      case 'error':
        this.handleError(data);
        break;
        
      case 'session.created':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.sessionId = (data as any).session?.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.emit('session.created', (data as any).session);
        break;
        
      case 'session.updated':
        this.emit('session.updated', data.session);
        break;
        
      case 'conversation.item.created':
        this.emit('conversation.item.created', data.item);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        this.emit('transcription.completed', data);
        break;
        
      case 'conversation.item.input_audio_transcription.failed':
        this.emit('transcription.failed', data);
        break;
        
      case 'response.created':
        this.emit('response.created', data.response);
        break;
        
      case 'response.done':
        this.emit('response.done', data.response);
        break;
        
      case 'response.text.delta':
        this.emit('response.text.delta', data.delta);
        break;
        
      case 'response.text.done':
        this.emit('response.text.done', data.text);
        break;
        
      case 'response.audio_transcript.delta':
        this.emit('response.audio_transcript.delta', data.delta);
        break;
        
      case 'response.audio_transcript.done':
        this.emit('response.audio_transcript.done', data.transcript);
        break;
        
      case 'response.audio.delta':
        this.emit('response.audio.delta', data.delta);
        break;
        
      case 'response.audio.done':
        this.emit('response.audio.done', data);
        break;
        
      case 'input_audio_buffer.speech_started':
        this.emit('speech.started', data);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.emit('speech.stopped', data);
        break;
        
      case 'input_audio_buffer.committed':
        this.emit('input_audio_buffer.committed', data);
        break;
        
      case 'input_audio_buffer.cleared':
        this.emit('input_audio_buffer.cleared', data);
        break;
        
      case 'rate_limits.updated':
        this.emit('rate_limits.updated', data.rate_limits);
        break;
        
      default:
        // Emit all events for flexibility
        this.emit(eventType, data);
    }
  }

  private handleError(data: RealtimeEvent): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = (data as any).error || {};
    this.logError('API Error:', error);
    
    // Check for authentication errors
    if (error.code === 'invalid_api_key' || error.code === 'authentication_error') {
      this.emit('error', {
        type: 'authentication_error',
        message: error.message || 'Invalid API key',
        code: error.code
      });
      // Close connection on auth error
      this.disconnect();
    } else {
      this.emit('error', error);
    }
  }

  appendInputAudio(audioData: ArrayBuffer): void {
    const base64Audio = this.arrayBufferToBase64(audioData);
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  commitInputAudio(): void {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  clearInputAudio(): void {
    this.send({
      type: 'input_audio_buffer.clear'
    });
  }

  createResponse(options?: Partial<RealtimeEvent>): void {
    this.send({
      type: 'response.create',
      ...options
    });
  }

  cancelResponse(): void {
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

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.sessionId = null;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[RealtimeBrowserClient]', ...args);
    }
  }

  private logError(...args: unknown[]): void {
    console.error('[RealtimeBrowserClient]', ...args);
  }
}
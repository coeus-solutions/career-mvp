'use client';

import { SessionConfig } from '../types/realtime';

type EventHandler = (event: Record<string, unknown>) => void;

export class SimpleRealtimeClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connected = false;
  private debug = false;
  
  constructor(private apiKey: string, options?: { debug?: boolean }) {
    this.debug = options?.debug || false;
  }

  async connect(model: string = 'gpt-4o-realtime-preview-2024-12-17'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // OpenAI Realtime API WebSocket URL
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
        
        // Create WebSocket with authentication via subprotocol
        // This is the correct way for browser clients
        this.ws = new WebSocket(wsUrl, [
          'openai-beta.realtime-v1',
          `openai-insecure-api-key.${this.apiKey}`
        ]);

        this.ws.onopen = () => {
          this.connected = true;
          this.log('Connected to OpenAI Realtime API');
          this.emit('connected', {});
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.log('Received event:', data.type);
            this.emit(data.type, data);
            this.emit('*', data); // Wildcard for all events
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { type: 'websocket_error', error });
          reject(error);
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.log('Disconnected:', event.code, event.reason);
          this.emit('disconnected', { code: event.code, reason: event.reason });
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  send(event: Record<string, unknown>): void {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.log('Sending event:', event.type);
      this.ws.send(JSON.stringify(event));
    } else {
      console.error('Cannot send event - not connected');
    }
  }

  updateSession(session: SessionConfig): void {
    this.send({
      type: 'session.update',
      session
    });
  }

  sendAudio(audio: ArrayBuffer): void {
    if (!this.connected) return;
    
    // Convert ArrayBuffer to base64
    const uint8Array = new Uint8Array(audio);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);
    
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  commitAudio(): void {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  clearAudio(): void {
    this.send({
      type: 'input_audio_buffer.clear'
    });
  }

  createResponse(): void {
    this.send({
      type: 'response.create'
    });
  }

  cancelResponse(): void {
    this.send({
      type: 'response.cancel'
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[SimpleRealtimeClient]', ...args);
    }
  }
}
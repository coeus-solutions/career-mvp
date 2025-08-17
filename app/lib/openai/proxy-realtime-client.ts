'use client';

import { RealtimeEvent } from '../types/realtime';

type EventHandler = (event: RealtimeEvent) => void;

export class ProxyRealtimeClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connected = false;
  
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Connect to our local proxy instead of directly to OpenAI
        // The proxy will handle authentication with OpenAI
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/realtime/ws`;
        
        console.log('Connecting to proxy WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          console.log('Connected to proxy WebSocket');
          this.emit('connected', { type: 'connected' });
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received event:', data.type);
            this.emit(data.type, data);
            this.emit('*', data);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { type: 'websocket_error', error });
          if (!this.connected) {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          console.log('Disconnected from proxy:', event.code, event.reason);
          this.emit('disconnected', { type: 'disconnected', code: event.code, reason: event.reason });
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: RealtimeEvent) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  send(event: Record<string, unknown>) {
    if (this.ws && this.connected && this.ws.readyState === WebSocket.OPEN) {
      console.log('Sending event:', event.type);
      this.ws.send(JSON.stringify(event));
    } else {
      console.error('Cannot send event - not connected');
    }
  }

  sendAudio(audio: ArrayBuffer) {
    if (!this.connected) return;
    
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

  commitAudio() {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  clearAudio() {
    this.send({
      type: 'input_audio_buffer.clear'
    });
  }

  createResponse() {
    this.send({
      type: 'response.create'
    });
  }

  cancelResponse() {
    this.send({
      type: 'response.cancel'
    });
  }

  updateSession(session: Record<string, unknown>) {
    this.send({
      type: 'session.update',
      session
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}
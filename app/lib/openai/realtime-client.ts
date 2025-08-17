'use client';

import { EventEmitter } from 'events';

export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';

export interface RealtimeClientOptions {
  apiKey: string;
  model?: string;
  debug?: boolean;
}

export interface SessionConfig {
  modalities?: string[];
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'shimmer';
  input_audio_format?: AudioFormat;
  output_audio_format?: AudioFormat;
  input_audio_transcription?: {
    model: string;
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
    description: string;
    parameters: Record<string, unknown>;
  }>;
  tool_choice?: 'auto' | 'none' | 'required';
  temperature?: number;
  max_response_output_tokens?: number | 'inf';
}

export interface ConversationItem {
  id: string;
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  status?: 'completed' | 'in_progress' | 'incomplete';
  content?: Array<{
    type: 'text' | 'audio';
    text?: string;
    audio?: string;
    transcript?: string;
  }>;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface InputAudioBufferCommitEvent {
  type: 'input_audio_buffer.commit';
}

export interface InputAudioBufferAppendEvent {
  type: 'input_audio_buffer.append';
  audio: string;
}

export interface InputAudioBufferClearEvent {
  type: 'input_audio_buffer.clear';
}

export interface ConversationItemCreateEvent {
  type: 'conversation.item.create';
  previous_item_id?: string | null;
  item: ConversationItem;
}

export interface ConversationItemTruncateEvent {
  type: 'conversation.item.truncate';
  item_id: string;
  content_index: number;
  audio_end_ms: number;
}

export interface ConversationItemDeleteEvent {
  type: 'conversation.item.delete';
  item_id: string;
}

export interface ResponseCreateEvent {
  type: 'response.create';
  commit?: boolean;
  cancel_previous?: boolean;
  append?: boolean;
  response?: {
    modalities?: string[];
    instructions?: string;
    voice?: 'alloy' | 'echo' | 'shimmer';
    output_audio_format?: AudioFormat;
    tools?: Array<{ type: string; name: string; description?: string; parameters?: unknown }>;
    tool_choice?: 'auto' | 'none' | 'required';
    temperature?: number;
    max_output_tokens?: number | 'inf';
  };
}

export interface ResponseCancelEvent {
  type: 'response.cancel';
}

export interface SessionUpdateEvent {
  type: 'session.update';
  session: SessionConfig;
}

export type ClientEvent = 
  | InputAudioBufferCommitEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferClearEvent
  | ConversationItemCreateEvent
  | ConversationItemTruncateEvent
  | ConversationItemDeleteEvent
  | ResponseCreateEvent
  | ResponseCancelEvent
  | SessionUpdateEvent;

export type ServerEvent = {
  event_id: string;
  type: string;
  [key: string]: unknown;
};

export class RealtimeClient extends EventEmitter {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private apiKey: string;
  private model: string;
  private debug: boolean;
  private sessionId: string | null = null;
  private conversationId: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private audioElement: HTMLAudioElement | null = null;

  constructor(options: RealtimeClientOptions) {
    super();
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-4o-realtime-preview-2024-12-17';
    this.debug = options.debug || false;
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create RTCPeerConnection
        this.pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        // Set up audio element to play remote audio
        this.audioElement = document.createElement('audio');
        this.audioElement.autoplay = true;
        
        this.pc.ontrack = (e) => {
          this.log('Received remote track:', e.track.kind);
          if (this.audioElement && e.streams[0]) {
            this.audioElement.srcObject = e.streams[0];
          }
        };

        // Add local audio track for microphone input
        try {
          const ms = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } 
          });
          
          ms.getTracks().forEach(track => {
            this.log('Adding local track:', track.kind);
            this.pc!.addTrack(track, ms);
          });
        } catch (err) {
          this.logError('Failed to get user media:', err);
          reject(new Error('Failed to access microphone'));
          return;
        }

        // Create data channel for events
        this.dc = this.pc.createDataChannel('oai-events', {
          ordered: true
        });
        
        this.dc.addEventListener('open', () => {
          this.log('Data channel opened');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.startPingInterval();
          resolve();
        });

        this.dc.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerEvent(data);
          } catch (error) {
            this.logError('Error parsing message:', error);
          }
        });

        this.dc.addEventListener('error', (error) => {
          this.logError('Data channel error:', error);
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.dc.addEventListener('close', () => {
          this.log('Data channel closed');
          this.isConnected = false;
          this.stopPingInterval();
          this.emit('disconnected', { code: 1000, reason: 'Data channel closed' });
        });

        // Create offer and connect via WebRTC
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        // Send SDP to OpenAI
        const baseUrl = 'https://api.openai.com/v1/realtime';
        const sdpResponse = await fetch(`${baseUrl}?model=${this.model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/sdp'
          },
        });

        if (!sdpResponse.ok) {
          const error = await sdpResponse.text();
          this.logError('SDP response error:', sdpResponse.status, error);
          throw new Error(`Failed to establish WebRTC connection: ${sdpResponse.status}`);
        }

        const answer = {
          type: 'answer' as RTCSdpType,
          sdp: await sdpResponse.text(),
        };
        
        await this.pc.setRemoteDescription(answer);
        this.log('WebRTC connection established');
        
      } catch (error) {
        this.logError('Connection error:', error);
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        this.logError('Reconnection failed:', error);
      });
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.dc?.readyState === 'open') {
        this.dc.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  updateSession(config: SessionConfig): void {
    this.sendEvent({
      type: 'session.update',
      session: config
    });
  }

  sendEvent(event: ClientEvent): void {
    if (!this.dc || this.dc.readyState !== 'open') {
      this.logError('Data channel is not connected');
      throw new Error('Data channel is not connected');
    }
    
    this.log('Sending event:', event.type);
    this.dc.send(JSON.stringify(event));
  }

  private handleServerEvent(event: ServerEvent): void {
    this.log('Received event:', event.type);
    
    switch (event.type) {
      case 'error':
        this.logError('Server error:', event.error);
        this.emit('error', event.error);
        break;
        
      case 'session.created':
        this.sessionId = (event.session as { id?: string })?.id || null;
        this.emit('session.created', event.session);
        break;
        
      case 'session.updated':
        this.emit('session.updated', event.session);
        break;
        
      case 'conversation.created':
        this.conversationId = (event.conversation as { id?: string })?.id || null;
        this.emit('conversation.created', event.conversation);
        break;
        
      case 'input_audio_buffer.committed':
        this.emit('input_audio_buffer.committed', event);
        break;
        
      case 'input_audio_buffer.cleared':
        this.emit('input_audio_buffer.cleared', event);
        break;
        
      case 'input_audio_buffer.speech_started':
        this.emit('input_audio_buffer.speech_started', event);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.emit('input_audio_buffer.speech_stopped', event);
        break;
        
      case 'conversation.item.created':
        this.emit('conversation.item.created', event.item);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        this.emit('conversation.item.input_audio_transcription.completed', event);
        break;
        
      case 'conversation.item.input_audio_transcription.failed':
        this.emit('conversation.item.input_audio_transcription.failed', event);
        break;
        
      case 'conversation.item.truncated':
        this.emit('conversation.item.truncated', event);
        break;
        
      case 'conversation.item.deleted':
        this.emit('conversation.item.deleted', event);
        break;
        
      case 'response.created':
        this.emit('response.created', event.response);
        break;
        
      case 'response.done':
        this.emit('response.done', event.response);
        break;
        
      case 'response.output_item.added':
        this.emit('response.output_item.added', event.item);
        break;
        
      case 'response.output_item.done':
        this.emit('response.output_item.done', event.item);
        break;
        
      case 'response.content_part.added':
        this.emit('response.content_part.added', event);
        break;
        
      case 'response.content_part.done':
        this.emit('response.content_part.done', event);
        break;
        
      case 'response.text.delta':
        this.emit('response.text.delta', event.delta);
        break;
        
      case 'response.text.done':
        this.emit('response.text.done', event.text);
        break;
        
      case 'response.audio_transcript.delta':
        this.emit('response.audio_transcript.delta', event.delta);
        break;
        
      case 'response.audio_transcript.done':
        this.emit('response.audio_transcript.done', event.transcript);
        break;
        
      case 'response.audio.delta':
        this.emit('response.audio.delta', event.delta);
        break;
        
      case 'response.audio.done':
        this.emit('response.audio.done', event);
        break;
        
      case 'response.function_call_arguments.delta':
        this.emit('response.function_call_arguments.delta', event);
        break;
        
      case 'response.function_call_arguments.done':
        this.emit('response.function_call_arguments.done', event);
        break;
        
      case 'rate_limits.updated':
        this.emit('rate_limits.updated', event.rate_limits);
        break;
        
      default:
        this.emit(event.type, event);
    }
  }

  appendInputAudio(audioData: ArrayBuffer): void {
    const base64Audio = this.arrayBufferToBase64(audioData);
    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  commitInputAudio(): void {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  clearInputAudio(): void {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    });
  }

  createConversationItem(item: ConversationItem, previousItemId?: string | null): void {
    this.sendEvent({
      type: 'conversation.item.create',
      previous_item_id: previousItemId,
      item
    });
  }

  truncateConversationItem(itemId: string, contentIndex: number, audioEndMs: number): void {
    this.sendEvent({
      type: 'conversation.item.truncate',
      item_id: itemId,
      content_index: contentIndex,
      audio_end_ms: audioEndMs
    });
  }

  deleteConversationItem(itemId: string): void {
    this.sendEvent({
      type: 'conversation.item.delete',
      item_id: itemId
    });
  }

  createResponse(options?: {
    commit?: boolean;
    cancelPrevious?: boolean;
    append?: boolean;
    modalities?: string[];
    instructions?: string;
    voice?: 'alloy' | 'echo' | 'shimmer';
    outputAudioFormat?: AudioFormat;
    temperature?: number;
    maxOutputTokens?: number | 'inf';
  }): void {
    const event: ResponseCreateEvent = {
      type: 'response.create',
      commit: options?.commit,
      cancel_previous: options?.cancelPrevious,
      append: options?.append
    };

    if (options?.modalities || options?.instructions || options?.voice || 
        options?.outputAudioFormat || options?.temperature || options?.maxOutputTokens) {
      event.response = {
        modalities: options.modalities,
        instructions: options.instructions,
        voice: options.voice,
        output_audio_format: options.outputAudioFormat,
        temperature: options.temperature,
        max_output_tokens: options.maxOutputTokens
      };
    }

    this.sendEvent(event);
  }

  cancelResponse(): void {
    this.sendEvent({
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
    this.stopPingInterval();
    
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[RealtimeClient]', ...args);
    }
  }

  private logError(...args: unknown[]): void {
    console.error('[RealtimeClient]', ...args);
  }
}
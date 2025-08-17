'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeClient, SessionConfig } from '../openai/realtime-client';

export interface UseRealtimeAPIOptions {
  apiKey: string;
  sessionConfig?: SessionConfig;
  onTranscript?: (transcript: string) => void;
  onResponse?: (response: string) => void;
  onAudioResponse?: (audioData: string) => void;
  onError?: (error: Error | unknown) => void;
  debug?: boolean;
}

export interface UseRealtimeAPIReturn {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  response: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
  sendText: (text: string) => void;
  cancelResponse: () => void;
  clearConversation: () => void;
}

export function useRealtimeAPI(options: UseRealtimeAPIOptions): UseRealtimeAPIReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  
  const clientRef = useRef<RealtimeClient | null>(null);
  const audioBufferRef = useRef<string[]>([]);
  const responseTextRef = useRef<string>('');

  const connect = useCallback(async () => {
    const defaultSessionConfig: SessionConfig = {
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
    temperature: 0.8,
    max_response_output_tokens: 'inf'
  };
    if (clientRef.current?.getConnectionStatus()) {
      return;
    }

    try {
      const client = new RealtimeClient({
        apiKey: options.apiKey,
        debug: options.debug
      });

      client.on('connected', () => {
        setIsConnected(true);
        client.updateSession(options.sessionConfig || defaultSessionConfig);
      });

      client.on('disconnected', () => {
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
      });

      client.on('session.created', (session) => {
        console.log('Session created:', session.id);
      });

      client.on('input_audio_buffer.speech_started', () => {
        setIsListening(true);
        setTranscript('Listening...');
        responseTextRef.current = '';
      });

      client.on('input_audio_buffer.speech_stopped', () => {
        setIsListening(false);
      });

      client.on('conversation.item.input_audio_transcription.completed', (event) => {
        const transcriptText = event.transcript || '';
        setTranscript(transcriptText);
        if (options.onTranscript) {
          options.onTranscript(transcriptText);
        }
      });

      client.on('response.created', () => {
        setIsSpeaking(true);
        responseTextRef.current = '';
        audioBufferRef.current = [];
      });

      client.on('response.audio_transcript.delta', (delta) => {
        responseTextRef.current += delta;
        setResponse(responseTextRef.current);
      });

      client.on('response.audio_transcript.done', (finalTranscript) => {
        setResponse(finalTranscript);
        if (options.onResponse) {
          options.onResponse(finalTranscript);
        }
      });

      client.on('response.audio.delta', (delta) => {
        audioBufferRef.current.push(delta);
        if (options.onAudioResponse) {
          options.onAudioResponse(delta);
        }
      });

      client.on('response.audio.done', () => {
        setIsSpeaking(false);
      });

      client.on('response.done', () => {
        setIsSpeaking(false);
      });

      client.on('error', (error) => {
        console.error('Realtime API error:', error);
        if (options.onError) {
          options.onError(error);
        }
      });

      await client.connect();
      clientRef.current = client;
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!clientRef.current?.getConnectionStatus()) {
      console.error('Not connected to Realtime API');
      return;
    }
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (!clientRef.current?.getConnectionStatus()) {
      return;
    }
    
    clientRef.current.commitInputAudio();
    setIsListening(false);
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!clientRef.current?.getConnectionStatus()) {
      console.error('Not connected to Realtime API');
      return;
    }
    
    clientRef.current.appendInputAudio(audioData);
  }, []);

  const sendText = useCallback((text: string) => {
    if (!clientRef.current?.getConnectionStatus()) {
      console.error('Not connected to Realtime API');
      return;
    }
    
    clientRef.current.createConversationItem({
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'user',
      content: [{
        type: 'text',
        text: text
      }]
    });
    
    clientRef.current.createResponse();
    setTranscript(text);
  }, []);

  const cancelResponse = useCallback(() => {
    if (!clientRef.current?.getConnectionStatus()) {
      return;
    }
    
    clientRef.current.cancelResponse();
    setIsSpeaking(false);
  }, []);

  const clearConversation = useCallback(() => {
    setTranscript('');
    setResponse('');
    responseTextRef.current = '';
    audioBufferRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    response,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendAudio,
    sendText,
    cancelResponse,
    clearConversation
  };
}
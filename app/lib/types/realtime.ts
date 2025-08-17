// Type definitions for OpenAI Realtime API

export interface SessionConfig {
  modalities?: string[];
  instructions?: string;
  voice?: string;
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: {
    model: string;
  };
  turn_detection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  temperature?: number;
  max_response_output_tokens?: string | number;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface SessionCreatedEvent {
  id: string;
  object: string;
  model: string;
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription: {
    model: string;
  } | null;
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  } | null;
  tools: unknown[];
  tool_choice: string;
  temperature: number;
  max_response_output_tokens: number | null;
}

export interface AudioTranscriptEvent {
  transcript: string;
}

export interface ErrorEvent {
  type: string;
  code?: string;
  message?: string;
  param?: string;
  event_id?: string;
}

export interface DisconnectedEvent {
  code?: number;
  reason?: string;
}

export interface ConversationItem {
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  content?: Array<{
    type: 'input_text' | 'input_audio' | 'text' | 'audio';
    text?: string;
    audio?: string;
  }>;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface ResponseTextDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

export interface ResponseAudioDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

export interface ResponseTextDoneEvent {
  text: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

export interface ResponseAudioDoneEvent {
  item_id: string;
  output_index: number;
  content_index: number;
}

export interface ConversationItemCreatedEvent {
  previous_item_id: string | null;
  item: ConversationItem;
}

export interface ResponseCreatedEvent {
  response: {
    id: string;
    object: string;
    status: string;
    status_details: unknown | null;
    output: unknown[];
    usage: unknown | null;
  };
}

export interface ResponseDoneEvent {
  response: {
    id: string;
    object: string;
    status: string;
    status_details: unknown | null;
    output: unknown[];
    usage: {
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
    } | null;
  };
}

export interface InputAudioTranscriptionCompletedEvent {
  transcript: string;
  item_id: string;
  content_index: number;
}

export interface ConversationItemInputAudioTranscriptionCompletedEvent {
  item_id: string;
  content_index: number;
  transcript: string;
}

export interface InputAudioBufferCommittedEvent {
  previous_item_id: string | null;
  item_id: string;
}

export interface RateLimitsUpdatedEvent {
  rate_limits: Array<{
    name: string;
    limit: number;
    remaining: number;
    reset_seconds: number;
  }>;
}
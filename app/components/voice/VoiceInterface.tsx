'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRealtimeAPI } from '@/app/lib/hooks/useRealtimeAPI';
import { AudioCapture, AudioPlayer } from '@/app/lib/utils/audio';

interface VoiceInterfaceProps {
  apiKey?: string;
}

export default function VoiceInterface({ apiKey: propApiKey }: VoiceInterfaceProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const audioCapture = useRef<AudioCapture | null>(null);
  const audioPlayer = useRef<AudioPlayer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
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
    cancelResponse,
    clearConversation
  } = useRealtimeAPI({
    apiKey: apiKey || '',
    onTranscript: (text) => {
      console.log('Transcript:', text);
    },
    onResponse: (text) => {
      console.log('Response:', text);
    },
    onAudioResponse: async (audioData) => {
      if (audioPlayer.current && audioData) {
        try {
          await audioPlayer.current.playBase64Audio(audioData);
        } catch (error) {
          console.error('Error playing audio:', error);
        }
      }
    },
    onError: (error) => {
      console.error('API Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(errorMessage);
    },
    debug: true
  });

  useEffect(() => {
    const fetchApiKey = async () => {
      if (propApiKey) {
        setApiKey(propApiKey);
        return;
      }

      try {
        const response = await fetch('/api/realtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: {} })
        });
        
        if (response.ok) {
          const data = await response.json();
          setApiKey(data.apiKey);
        } else {
          throw new Error('Failed to fetch API configuration');
        }
      } catch (error) {
        console.error('Error fetching API key:', error);
        setError('Failed to initialize API connection');
      }
    };

    fetchApiKey();
  }, [propApiKey]);

  useEffect(() => {
    if (apiKey && !isInitialized) {
      audioCapture.current = new AudioCapture();
      audioPlayer.current = new AudioPlayer();
      setIsInitialized(true);
    }
  }, [apiKey, isInitialized]);

  const visualizeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  }, []);

  const handleStartListening = async () => {
    try {
      setError(null);

      if (!isConnected) {
        await connect();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        }
      });

      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      if (audioCapture.current) {
        await audioCapture.current.startCapture((audioData) => {
          sendAudio(audioData);
        });
      }

      startListening();
      visualizeAudio();
    } catch (err) {
      console.error('Error starting listening:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to access microphone';
      setError(errorMessage);
    }
  };

  const handleStopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioCapture.current) {
      audioCapture.current.stopCapture();
    }

    stopListening();
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (audioCapture.current) {
        audioCapture.current.stopCapture();
      }
      if (audioPlayer.current) {
        audioPlayer.current.stop();
      }
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="flex flex-col items-center space-y-6 p-2 sm:p-4">
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-[#4169E1]' : 'bg-gray-400'}`} />
        <span className="text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={toggleListening}
          disabled={!isInitialized}
          className={`
            relative w-28 h-28 sm:w-32 sm:h-32 rounded-full transition-all duration-300
            flex items-center justify-center select-none
            ${!isInitialized 
              ? 'bg-gray-300 cursor-not-allowed'
              : isListening 
                ? 'bg-[#3051B8] shadow-2xl' 
                : 'bg-[#4169E1] shadow-xl'
            }
            transform hover:scale-105 active:scale-95
            disabled:transform-none disabled:hover:scale-100
            text-white
          `}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening && (
            <div 
              className="absolute inset-0 rounded-full bg-white/20 animate-ping"
              style={{ animationDuration: '2s' }}
            />
          )}
          
          <div className="relative z-10">
            {isListening ? (
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="4" width="3" height="12" rx="1" />
                <rect x="11" y="4" width="3" height="12" rx="1" />
              </svg>
            ) : (
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </button>

        {isListening && (
          <div 
            className="absolute inset-0 rounded-full border-4 border-[#4169E1]/40"
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
              transition: 'transform 0.1s ease-out',
            }}
          />
        )}
      </div>

      <div className="text-center space-y-2">
        <p className="text-base sm:text-lg font-medium text-gray-700">
          {!isInitialized 
            ? 'Initializing...'
            : isSpeaking 
              ? 'CASEY is speaking...'
              : isListening 
                ? 'Listening...'
                : 'Click to start speaking'
          }
        </p>
        
        {isListening && (
          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-[#4169E1] rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(8, audioLevel * 100 * (0.5 + Math.random()))}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-[var(--radius-sm)] max-w-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {transcript && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-[var(--radius-sm)] max-w-md w-full animate-fadeIn">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">You said:</h3>
          <p className="text-gray-800">{transcript}</p>
        </div>
      )}

      {response && (
        <div className="p-4 bg-[#E6E9FF] border border-[#B8C5FF] rounded-[var(--radius-sm)] max-w-md w-full animate-fadeIn">
          <h3 className="text-sm font-semibold text-[#4169E1] mb-2">CASEY:</h3>
          <p className="text-gray-800 whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {(isListening || isSpeaking) && (
        <button
          onClick={isSpeaking ? cancelResponse : handleStopListening}
          className="px-6 py-3 bg-[#4169E1] text-white rounded-full hover:bg-[#3051B8] transition-all transform hover:scale-105 active:scale-95"
        >
          {isSpeaking ? 'Stop Response' : 'Stop Listening'}
        </button>
      )}

      {(transcript || response) && !isListening && !isSpeaking && (
        <button
          onClick={clearConversation}
          className="px-6 py-3 bg-white text-[#4169E1] border-2 border-[#4169E1] rounded-full hover:bg-[#E6E9FF] transition-all"
        >
          Clear Conversation
        </button>
      )}
    </div>
  );
}
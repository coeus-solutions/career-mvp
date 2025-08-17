'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceButtonProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onResponseUpdate?: (response: string) => void;
}

export default function VoiceButton({ onTranscriptUpdate }: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  const startListening = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        }
      });
      
      mediaStreamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      setIsListening(true);
      visualizeAudio();

      setTranscript('Listening... (OpenAI integration pending)');
      if (onTranscriptUpdate) {
        onTranscriptUpdate('Listening... (OpenAI integration pending)');
      }

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Unable to access microphone. Please check permissions.');
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsListening(false);
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        <button
          onClick={toggleListening}
          className={`
            relative w-32 h-32 rounded-full transition-all duration-300
            flex items-center justify-center
            ${isListening 
              ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-2xl' 
              : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-xl'
            }
            transform hover:scale-105 active:scale-95
          `}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening && (
            <div 
              className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"
              style={{ animationDuration: '2s' }}
            />
          )}
          
          <div className="relative z-10">
            {isListening ? (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="4" width="3" height="12" rx="1" />
                <rect x="11" y="4" width="3" height="12" rx="1" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </button>

        {isListening && (
          <div 
            className="absolute inset-0 rounded-full border-4 border-red-500 opacity-50"
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
              transition: 'transform 0.1s ease-out',
            }}
          />
        )}
      </div>

      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-gray-700">
          {isListening ? 'Listening...' : 'Click to start speaking'}
        </p>
        {isListening && (
          <div className="flex items-center justify-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(8, audioLevel * 100 * (0.5 + Math.random()))}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {transcript && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg max-w-md w-full">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">You said:</h3>
          <p className="text-gray-800">{transcript}</p>
        </div>
      )}

      {response && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md w-full">
          <h3 className="text-sm font-semibold text-blue-600 mb-2">CASEY:</h3>
          <p className="text-gray-800">{response}</p>
        </div>
      )}
    </div>
  );
}
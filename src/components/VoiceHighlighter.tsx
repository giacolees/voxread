import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceHighlighterProps {
  onHighlight: (text: string) => void;
  isActive: boolean;
}

export const VoiceHighlighter: React.FC<VoiceHighlighterProps> = ({ onHighlight, isActive }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const onHighlightRef = useRef(onHighlight);

  useEffect(() => { onHighlightRef.current = onHighlight; }, [onHighlight]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.trim().toLowerCase();
      if (text.startsWith('highlight ')) {
        onHighlightRef.current(text.slice('highlight '.length));
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onend = null;
      recognition.onresult = null;
      if (isListeningRef.current) recognition.stop();
    };
  }, []); // created once — refs handle live values

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    if (isListeningRef.current) {
      isListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      isListeningRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <button
        onClick={toggleListening}
        className={`p-4 rounded-full shadow-lg transition-all ${
          isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white'
        }`}
        title={isListening ? 'Stop Voice Highlighting' : 'Start Voice Highlighting'}
      >
        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
      </button>
      {isListening && (
        <div className="absolute bottom-full right-0 mb-2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Say "Highlight [phrase]"
        </div>
      )}
    </div>
  );
};

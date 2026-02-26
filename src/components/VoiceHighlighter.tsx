import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceHighlighterProps {
  onHighlight: (text: string) => void;
  isActive: boolean;
}

export const VoiceHighlighter: React.FC<VoiceHighlighterProps> = ({ onHighlight, isActive }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        
        // Trigger highlight if user says "highlight [text]"
        if (text.startsWith('highlight ')) {
          const phraseToHighlight = text.replace('highlight ', '');
          onHighlight(phraseToHighlight);
        }
      };

      recognition.onend = () => {
        if (isListening) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }
  }, [onHighlight, isListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
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

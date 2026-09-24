import type { SpeechPort } from '../../ports/contracts.ts';

export function createBrowserSpeech(): SpeechPort {
  return {
    speak(text, lang) {
      const synth = globalThis.speechSynthesis;
      if (!synth || text.length === 0) {
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'fr' ? 'fr-FR' : lang === 'pl' ? 'pl-PL' : 'en-US';
      synth.speak(utterance);
    },
  };
}

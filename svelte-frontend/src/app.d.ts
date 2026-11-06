// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// TypeScript's DOM lib only ships the speech recognition event types,
	// not the (partly vendor-prefixed) SpeechRecognition API itself.
	interface SpeechRecognition extends EventTarget {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		onstart: ((this: SpeechRecognition, event: Event) => void) | null;
		onresult: ((this: SpeechRecognition, event: SpeechRecognitionEvent) => void) | null;
		onend: ((this: SpeechRecognition, event: Event) => void) | null;
		onerror: ((this: SpeechRecognition, event: SpeechRecognitionErrorEvent) => void) | null;
		start(): void;
		stop(): void;
		abort(): void;
	}

	interface Window {
		SpeechRecognition?: new () => SpeechRecognition;
		webkitSpeechRecognition?: new () => SpeechRecognition;
	}
}

export {};

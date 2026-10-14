<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import type { Profile } from '#lib';
	import type { Conversation, ChatMessage, ChatButton } from '#lib';
	import type { RasaResponse } from '#lib';

	import ChatHeader from './ChatHeader.svelte';
	import ConversationHistory from './ConversationHistory.svelte';
	import ChatView from './ChatView.svelte';
	import ChatInput from './ChatInput.svelte';

	let { profile, onLogout }: {
		profile: Profile;
		onLogout: () => void;
	} = $props();

	let database: typeof import('#lib/db/database.ts') | null = null;
	let rasaAPI: typeof import('#lib/api/rasa-api.ts').rasaAPI | null = null;

	let conversations = $state<Conversation[]>([]);
	let activeConversationId = $state<number | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');

	let isReady = $state(false);
	let isSending = $state(false);
	let isListening = $state(false);
	let speechSupported = $state(false);
	let autoRead = $state(true);
	let historyOpen = $state(false);
	let errorMessage = $state('');

	let chatView: { scrollToBottom: () => void } | undefined;
	let recognition: SpeechRecognition | null = null;
	let synth: SpeechSynthesis | null = null;
	let speechQueue: string[] = [];
	let isSpeaking = false;
	let speechTimeout: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	onMount(async () => {
		try {
			const [databaseModule, apiModule] = await Promise.all([
				import('#lib/db/database.ts'),
				import('#lib/api/rasa-api.ts')
			]);

			if (destroyed) return;

			database = databaseModule;
			rasaAPI = apiModule.rasaAPI;

			initializeVoiceControls();
			await refreshConversations();

			if (destroyed) return;

			if (conversations.length) {
				await openConversation(conversations[0].id);
			} else {
				await startNewConversation();
			}

			isReady = true;
			await tick();
			scrollToBottom();
		} catch (error) {
			console.error('Could not initialize Milo:', error);
			errorMessage = 'Milo could not initialize. Check the database and API modules.';
			isReady = true;
		}
	});

	onDestroy(() => {
		destroyed = true;

		if (speechTimeout !== null) clearTimeout(speechTimeout);

		if (recognition) {
			recognition.onresult = null;
			recognition.onend = null;
			recognition.onerror = null;

			try {
				recognition.abort();
			} catch {
				// Recognition may already have ended.
			}
		}

		synth?.cancel();
		speechQueue = [];
	});

	async function refreshConversations() {
		if (database) {
			conversations = await database.getConversations(profile.username);
		}
	}

	async function startNewConversation() {
		if (!database || isSending) return;

		try {
			const id = await database.createConversation({
				username: profile.username,
				title: 'New conversation'
			});

			activeConversationId = id;
			messages = [];
			errorMessage = '';

			await refreshConversations();
			await tick();
			scrollToBottom();
		} catch (error) {
			console.error('Could not create conversation:', error);
			errorMessage = 'Could not create a new conversation.';
		}
	}

	async function openConversation(id: number) {
		if (!database || isSending) return;

		try {
			const loadedMessages = await database.getMessages(id);

			activeConversationId = id;
			messages = loadedMessages;
			errorMessage = '';

			await tick();
			scrollToBottom();
		} catch (error) {
			console.error('Could not open conversation:', error);
			errorMessage = 'Could not load that conversation.';
		}
	}

	async function removeCurrentConversation() {
		if (!database || !activeConversationId || isSending) return;

		if (!window.confirm('Delete this conversation and all its messages? This cannot be undone.')) {
			return;
		}

		try {
			await database.deleteConversation(activeConversationId);
			activeConversationId = null;
			messages = [];

			await refreshConversations();

			if (conversations.length) {
				await openConversation(conversations[0].id);
			} else {
				await startNewConversation();
			}
		} catch (error) {
			console.error('Could not delete conversation:', error);
			errorMessage = 'Could not delete this conversation.';
		}
	}

	async function sendMessage(text = draft) {
		const messageText = text.trim();

		if (!messageText || isSending || !database || !rasaAPI) return;

		if (!activeConversationId) {
			await startNewConversation();
			if (!activeConversationId) return;
		}

		const conversationId = activeConversationId;
		const clientId = `pending-${crypto.randomUUID()}`;

		const userMessage = {
			sender: 'user' as const,
			message: messageText,
			timestamp: new Date().toISOString()
		};

		draft = '';
		isSending = true;
		errorMessage = '';

		// Keep a unique temporary key until the database assigns a real ID.
		messages = [
			...messages,
			{ ...userMessage, id: clientId } as unknown as ChatMessage
		];

		await tick();
		scrollToBottom();

		try {
			const savedUserMessage = await database.saveMessage({
				conversationId,
				...userMessage
			});

			// Replace the optimistic message by its temporary ID, not object identity.
			messages = messages.map((message) =>
				(message.id as unknown) === clientId
					? { ...message, id: savedUserMessage }
					: message
			);

			await refreshConversations();

			const senderId = conversations.find(
				(conversation) => conversation.id === conversationId
			)?.senderId;

			if (!senderId) {
				throw new Error(`Conversation ${conversationId} has no sender ID.`);
			}

			const response: RasaResponse = await rasaAPI.sendMessage(
				senderId,
				messageText
			);

			if (destroyed) return;

			const responseMessages = Array.isArray(response)
				? response
				: (response?.messages ?? []);

			for (const item of responseMessages) {
				const image = item.url ?? item.image ?? null;
				const textContent = item.text ?? '';
				const buttons = Array.isArray(item.buttons) ? item.buttons : [];

				if (!textContent && !image && !buttons.length) continue;

				const botMessage = {
					sender: 'bot' as const,
					message: textContent,
					image,
					buttons,
					timestamp: new Date().toISOString()
				};

				const savedMessage = await database.saveMessage({
					conversationId,
					...botMessage
				});

				// Do not append a database record already present in the current list.
				if (
					activeConversationId === conversationId &&
					!messages.some((message) => message.id === savedMessage)
				) {
					messages = [
						...messages,
						{ ...botMessage, id: savedMessage } as ChatMessage
					];

					await tick();
					scrollToBottom();
				}

				if (textContent) speakText(textContent);
			}

			if (response?.error && responseMessages.length === 0) {
				errorMessage = 'Milo encountered a problem processing your message.';
			}

			await refreshConversations();
		} catch (error) {
			console.error('Failed to send message:', error);

			const failureMessage = {
				sender: 'bot' as const,
				message: 'Sorry, I encountered a problem communicating with Milo. Please try again.',
				timestamp: new Date().toISOString()
			};

			try {
				const id = await database.saveMessage({
					conversationId,
					...failureMessage
				});

				if (
					activeConversationId === conversationId &&
					!messages.some((message) => message.id === id)
				) {
					messages = [...messages, { ...failureMessage, id } as ChatMessage];
				}
			} catch (saveError) {
				console.error('Could not save error message:', saveError);

				if (activeConversationId === conversationId) {
					messages = [
						...messages,
						{
							...failureMessage,
							id: `error-${crypto.randomUUID()}`
						} as unknown as ChatMessage
					];
				}
			}

			errorMessage = 'The request could not be completed.';
		} finally {
			isSending = false;
			await tick();
			scrollToBottom();
		}
	}

	function scrollToBottom() {
		chatView?.scrollToBottom();
	}

	function formatTimestamp(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';

		const sameDay = date.toDateString() === new Date().toDateString();

		return date.toLocaleString(
			undefined,
			sameDay
				? { hour: '2-digit', minute: '2-digit' }
				: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
		);
	}

	function initializeVoiceControls() {
		if (typeof window === 'undefined') return;

		synth = window.speechSynthesis ?? null;

		const SpeechRecognitionAPI =
			window.SpeechRecognition ?? window.webkitSpeechRecognition;

		if (!SpeechRecognitionAPI) return;

		try {
			recognition = new SpeechRecognitionAPI();
			recognition.continuous = false;
			recognition.interimResults = true;
			recognition.lang = 'en-US';
			speechSupported = true;

			recognition.onstart = () => (isListening = true);

			recognition.onresult = (event) => {
				draft = Array.from(event.results)
					.map((result) => result[0]?.transcript ?? '')
					.join('');
			};

			recognition.onend = () => {
				isListening = false;

				if (draft.trim()) {
					speechTimeout = setTimeout(() => {
						speechTimeout = null;
						if (!destroyed) void sendMessage();
					}, 1000);
				}
			};

			recognition.onerror = (event) => {
				console.warn('Speech recognition error:', event.error);
				isListening = false;
			};
		} catch (error) {
			console.warn('Speech recognition could not be initialized:', error);
			recognition = null;
			speechSupported = false;
		}
	}

	function toggleSpeechRecognition() {
		if (!recognition || isSending) return;

		if (isListening) {
			recognition.stop();
			return;
		}

		if (speechTimeout !== null) clearTimeout(speechTimeout);
		speechTimeout = null;
		draft = '';

		try {
			recognition.start();
		} catch (error) {
			console.warn('Could not start speech recognition:', error);
		}
	}

	function speakText(text: string) {
		if (!autoRead || !synth || !text.trim()) return;

		const cleanText = text.replace(/<[^>]*>/g, '').trim();
		if (!cleanText) return;

		if (isSpeaking) {
			speechQueue.push(cleanText);
			return;
		}

		const utterance = new SpeechSynthesisUtterance(cleanText);
		const preferredVoice = synth.getVoices().find((voice) =>
			/samantha|google|natural/i.test(voice.name)
		);

		if (preferredVoice) utterance.voice = preferredVoice;

		utterance.lang = 'en-US';
		utterance.rate = 0.9;
		isSpeaking = true;

		utterance.onend = () => {
			isSpeaking = false;
			const nextText = speechQueue.shift();
			if (nextText && !destroyed) speakText(nextText);
		};

		utterance.onerror = (event) => {
			console.warn('Speech synthesis error:', event.error);
			isSpeaking = false;
			const nextText = speechQueue.shift();
			if (nextText && !destroyed) speakText(nextText);
		};

		synth.speak(utterance);
	}

	function handleResponseButton(button: ChatButton) {
		const payload = button.payload ?? button.title ?? button.text;
		if (typeof payload === 'string' && payload.trim()) void sendMessage(payload);
	}
</script>

<svelte:head>
	<title>Milo</title>
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') historyOpen = false;
	}}
/>

<div class="chat-app">
	<ChatHeader
		{profile}
		{isSending}
		canDelete={activeConversationId !== null}
		{historyOpen}
		onLogout={onLogout}
		onDelete={() => void removeCurrentConversation()}
		onToggleHistory={() => (historyOpen = !historyOpen)}
	/>

	<div class="workspace">
		<ConversationHistory
			{conversations}
			{activeConversationId}
			{isReady}
			{isSending}
			open={historyOpen}
			onNewConversation={() => {
				historyOpen = false;
				void startNewConversation();
			}}
			onOpenConversation={(id) => {
				historyOpen = false;
				void openConversation(id);
			}}
		/>

		{#if historyOpen}
			<button
				class="history-backdrop"
				type="button"
				aria-label="Close conversations"
				onclick={() => (historyOpen = false)}
			></button>
		{/if}

		<main class="chat-panel">
			<ChatView
				bind:this={chatView}
				{profile}
				{messages}
				{isReady}
				{isSending}
				{formatTimestamp}
				onResponseButton={handleResponseButton}
			/>

			{#if errorMessage}
				<div class="error-banner" role="alert">
					<span>{errorMessage}</span>
					<button
						type="button"
						aria-label="Dismiss error"
						onclick={() => (errorMessage = '')}
					>
						<i class="fa-solid fa-xmark" aria-hidden="true"></i>
					</button>
				</div>
			{/if}

			<ChatInput
				{draft}
				{isReady}
				{isSending}
				{isListening}
				{speechSupported}
				{autoRead}
				onDraftChange={(value) => (draft = value)}
				onSend={() => void sendMessage()}
				onToggleSpeech={toggleSpeechRecognition}
				onAutoReadChange={(value) => (autoRead = value)}
			/>
		</main>
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}

	.chat-app {
		display: flex;
		height: 100dvh;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-color);
		color: var(--text-primary);
		font-family: 'Ubuntu', system-ui, sans-serif;
	}

	.workspace {
		display: grid;
		min-height: 0;
		flex: 1;
		grid-template-columns: 205px minmax(0, 1fr);
	}

	.chat-panel {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
	}

	.error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 12px 8px;
		padding: 7px 10px;
		border: 1px solid var(--danger-color);
		border-radius: 5px;
		color: var(--danger-color);
		font-size: 12px;

		button {
			border: 0;
			background: transparent;
			color: inherit;
			font: inherit;
			cursor: pointer;
		}
	}

	.history-backdrop {
		display: none;
	}

	@media (max-width: 700px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.history-backdrop {
			position: fixed;
			inset: 48px 0 0;
			z-index: 2;
			display: block;
			border: 0;
			background: rgb(0 0 0 / 0.3);
		}
	}
</style>
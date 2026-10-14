<script lang="ts">
	let {
		draft,
		isReady,
		isSending,
		isListening,
		speechSupported,
		autoRead,
		onDraftChange,
		onSend,
		onToggleSpeech,
		onAutoReadChange
	}: {
		draft: string;
		isReady: boolean;
		isSending: boolean;
		isListening: boolean;
		speechSupported: boolean;
		autoRead: boolean;
		onDraftChange: (value: string) => void;
		onSend: () => void;
		onToggleSpeech: () => void;
		onAutoReadChange: (value: boolean) => void;
	} = $props();

	let textareaElement: HTMLTextAreaElement;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			onSend();
		}
	}

	function resizeTextarea() {
		if (!textareaElement) return;
		textareaElement.style.height = 'auto';
		textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 180)}px`;
	}

	// Resize whenever the draft changes, also when it is set from outside
	// (speech input, or cleared after sending). Effects run after the DOM
	// update, so the textarea already holds the new value.
	$effect(() => {
		void draft;
		resizeTextarea();
	});
</script>

<div class="composer-area">
	<div class="composer">
		<textarea
			bind:this={textareaElement}
			value={draft}
			rows="1"
			placeholder={isListening ? 'Listening...' : 'Type a message...'}
			aria-label="Message Milo"
			disabled={!isReady || isSending}
			oninput={(event) => onDraftChange(event.currentTarget.value)}
			onkeydown={handleKeydown}
		></textarea>

		{#if speechSupported}
			<button
				class="composer-button mic-button"
				class:recording={isListening}
				type="button"
				title={isListening ? 'Stop listening' : 'Speak your message'}
				aria-label={isListening ? 'Stop listening' : 'Speak your message'}
				disabled={isSending}
				onclick={onToggleSpeech}
			>
				<i class="fa-solid fa-microphone" aria-hidden="true"></i>
			</button>
		{/if}

		<button
			class="composer-button send-button"
			type="button"
			title="Send message"
			aria-label="Send message"
			disabled={!draft.trim() || isSending || !isReady}
			onclick={onSend}
		>
			<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
		</button>
	</div>

	<div class="composer-footer">
		<label>
			<input
				type="checkbox"
				checked={autoRead}
				onchange={(event) => onAutoReadChange(event.currentTarget.checked)}
			/>
			Auto-read responses
		</label>

		<span>{isListening ? 'Listening...' : 'Enter to send · Shift + Enter for a new line'}</span>
	</div>
</div>

<style>
	.composer-area {
		padding: 8px 12px max(12px, env(safe-area-inset-bottom));
	}

	.composer {
		display: flex;
		width: min(100%, 900px);
		align-items: flex-end;
		gap: 8px;
		margin: 0 auto;
		padding: 5px 7px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--input-bg);

		&:focus-within {
			border-color: var(--primary-color);
		}

		textarea {
			min-width: 0;
			max-height: 180px;
			flex: 1;
			resize: none;
			padding: 6px 3px;
			border: 0;
			outline: 0;
			background: transparent;
			color: var(--input-text);
			font: inherit;
			font-size: 13px;
			line-height: 1.5;

			&::placeholder {
				color: var(--text-secondary);
				opacity: 1;
			}
		}
	}

	.composer-button {
		display: flex;
    justify-content: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		place-items: center;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary);
		font: inherit;
		cursor: pointer;

		&:hover:not(:disabled) {
			background: var(--hover-color);
			color: var(--text-primary);
		}

		&:disabled {
			opacity: 0.4;
			cursor: default;
		}

		&:focus-visible {
			outline: 2px solid var(--primary-color);
			outline-offset: 2px;
		}
	}

	.mic-button.recording {
		color: var(--danger-color);
	}

	.send-button {
		background: var(--primary-color);
		color: #fff;

		&:hover:not(:disabled) {
			background: var(--primary-hover);
			color: #fff;
		}
	}

	.composer-footer {
		display: flex;
		width: min(100%, 900px);
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin: 6px auto 0;
		color: var(--text-secondary);
		font-size: 10px;

		label {
			display: flex;
			align-items: center;
			gap: 5px;
			cursor: pointer;
		}

		input {
			margin: 0;
			accent-color: var(--primary-color);
		}
	}

	@media (max-width: 420px) {
		.composer-footer {
			align-items: flex-start;
			flex-direction: column;
			gap: 4px;
		}
	}
</style>
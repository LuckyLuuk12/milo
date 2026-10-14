<script lang="ts">
	import favicon from '#lib/assets/milo.png';
	import type { Profile } from '#lib/types/profile';
	import type { ChatMessage, ChatButton } from '#lib/db/database';

	let {
		profile,
		messages,
		isReady,
		isSending,
		onResponseButton,
		formatTimestamp
	} = $props<{
		profile: Profile;
		messages: ChatMessage[];
		isReady: boolean;
		isSending: boolean;
		onResponseButton: (button: ChatButton) => void;
		formatTimestamp: (value: string) => string;
	}>();

	let messagesElement: HTMLDivElement;

	export function scrollToBottom() {
		if (messagesElement) {
			messagesElement.scrollTop = messagesElement.scrollHeight;
		}
	}

</script>

<div class="messages" bind:this={messagesElement}>
	{#if !isReady}
		<div class="empty-state">
			<p>Initializing Milo...</p>
		</div>
	{:else if !messages.length}
		<div class="empty-state">
			<img src={favicon} alt="" />
			<h3>What can I help you with?</h3>
			<p>Send a message to get started.</p>
		</div>
	{:else}
		{#each messages as message, index (message.id ?? index)}
			<article class="message" class:user-message={message.sender === 'user'}>
				{#if message.sender !== 'user'}
					<img class="avatar" src={favicon} alt="" />
				{/if}

				<div class="message-content">
					<div class="message-meta">
						<span>{message.sender === 'user' ? profile.username : 'Milo'}</span>
						<time>{formatTimestamp(message.timestamp)}</time>
					</div>

					<div class="bubble" class:user-bubble={message.sender === 'user'}>
						{#if message.message}
							<div class="message-text">{message.message}</div>
						{/if}

						{#if message.image}
							<img
								class="message-image"
								src={message.image}
								alt="Image from Milo"
								loading="lazy"
							/>
						{/if}

						{#if message.buttons?.length}
							<div class="response-buttons">
								{#each message.buttons as button, i (`${button.title ?? button.text ?? 'button'}-${i}`)}
									<button
										type="button"
										disabled={isSending}
										onclick={() => onResponseButton(button)}
									>
										{button.title ?? button.text ?? button.payload ?? 'Select'}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				{#if message.sender === 'user'}
					{#if profile.avatar}
						<img class="avatar" src={profile.avatar} alt="" />
					{:else}
						<span class="avatar placeholder">
							{profile.username.slice(0, 1).toUpperCase()}
						</span>
					{/if}
				{/if}
			</article>
		{/each}
	{/if}

	{#if isSending}
		<article class="message">
			<img class="avatar" src={favicon} alt="" />
			<div class="message-content">
				<div class="message-meta">Milo</div>
				<div class="bubble typing">•••</div>
			</div>
		</article>
	{/if}
</div>

<style>
	.messages {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		gap: 14px;
		overflow-y: auto;
		padding: 16px clamp(48px, 3vw, 64px);
		scroll-behavior: smooth;
	}

	.empty-state {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;

		img {
			width: 42px;
			height: 42px;
			margin-bottom: 10px;
			object-fit: contain;
		}

		h3 {
			margin: 0;
			font-size: 16px;
			font-weight: 500;
		}

		p {
			margin: 7px 0 0;
			color: var(--text-secondary);
			font-size: 12px;
		}
	}

	.message {
		display: flex;
		align-items: flex-start;
    justify-content: flex-start;
		gap: 8px;

		&.user-message {
      flex-direction: row;
			justify-content: flex-end;
		}
	}

	.avatar {
		width: 27px;
		height: 27px;
		flex-shrink: 0;
		border-radius: 50%;
		object-fit: cover;
	}

	.placeholder {
		display: grid;
		place-items: center;
		background: var(--primary-light);
		color: var(--primary-color);
		font-size: 12px;
		font-weight: 600;
	}

	.message-content {
		display: grid;
		min-width: 0;
		max-width: min(82%, 720px);
		gap: 3px;
	}

	.user-message .message-content {
		justify-items: end;
	}

	.message-meta {
		display: flex;
		gap: 7px;
		color: var(--text-secondary);
		font-size: 10px;

		time {
			font-size: 10px;
		}
	}

	.bubble {
		width: fit-content;
		max-width: 100%;
		border-radius: 8px;
		background: var(--hover-color);
		font-size: 13px;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}

	.user-bubble {
		background: var(--primary-light);
	}

	.message-text {
		white-space: pre-wrap;
	}

	.message-image {
		display: block;
		max-width: min(100%, 420px);
		max-height: 360px;
		margin-top: 6px;
		border-radius: 5px;
		object-fit: contain;
	}

	.response-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;

		button {
			padding: 5px 8px;
			border: 1px solid var(--border-color);
			border-radius: 5px;
			background: var(--white);
			color: var(--primary-color);
			font: inherit;
			font-size: 11px;
			cursor: pointer;

			&:hover:not(:disabled) {
				border-color: var(--primary-color);
			}

			&:disabled {
				opacity: 0.45;
				cursor: default;
			}
		}
	}

	.typing {
		color: var(--text-secondary);
		letter-spacing: 3px;
	}

	@media (max-width: 700px) {
		.messages {
			padding: 10px;
		}

		.message-content {
			max-width: 88%;
		}
	}
</style>
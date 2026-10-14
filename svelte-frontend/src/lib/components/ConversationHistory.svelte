<script lang="ts">
	import type { Conversation } from '#lib';

	let {
		conversations,
		activeConversationId,
		isReady,
		isSending,
		onNewConversation,
		onOpenConversation
	}: {
		conversations: Conversation[];
		activeConversationId: number | null;
		isReady: boolean;
		isSending: boolean;
		onNewConversation: () => void;
		onOpenConversation: (id: number) => void;
	} = $props();
</script>

<aside class="history">
	<button
		class="new-chat"
		type="button"
		disabled={!isReady || isSending}
		onclick={onNewConversation}
	>
		<i class="fa-solid fa-plus" aria-hidden="true"></i>
		New chat
	</button>

	<nav aria-label="Conversation history">
		{#each conversations as conversation (conversation.id)}
			<button
				type="button"
				class="conversation"
				class:active={activeConversationId === conversation.id}
				disabled={isSending}
				title={conversation.title || 'New conversation'}
				onclick={() => onOpenConversation(conversation.id)}
			>
				<i class="fa-regular fa-message" aria-hidden="true"></i>
				<span>{conversation.title || 'New conversation'}</span>
			</button>
		{/each}

		{#if isReady && !conversations.length}
			<p class="empty-history">No conversations yet.</p>
		{/if}
	</nav>
</aside>

<style>
	.history {
		display: flex;
		min-height: 0;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
		padding: 8px 6px;
		border-right: 1px solid var(--border-color);
		background: var(--white);
	}

	button {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		padding: 8px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		text-align: left;
		font: inherit;
		font-size: 12px;
		cursor: pointer;

		&:hover:not(:disabled),
		&.active {
			background: var(--hover-color);
		}

		&:focus-visible {
			outline: 2px solid var(--primary-color);
			outline-offset: 1px;
		}

		&:disabled {
			opacity: 0.45;
			cursor: default;
		}

		i {
			width: 15px;
			flex-shrink: 0;
			color: var(--text-secondary);
			text-align: center;
		}

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.new-chat {
		color: var(--primary-color);
	}

	nav {
		display: grid;
		align-content: start;
		gap: 2px;
		overflow-y: auto;
	}

	.conversation {
		color: var(--text-secondary);

		&.active {
			color: var(--text-primary);
		}
	}

	.empty-history {
		margin: 4px 8px;
		color: var(--text-secondary);
		font-size: 11px;
	}
</style>
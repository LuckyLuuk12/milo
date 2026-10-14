<script lang="ts">
	import favicon from '#lib/assets/milo.png';
	import type { Profile } from '#lib';

	let {
		profile,
		isSending,
		canDelete,
		historyOpen,
		onLogout,
		onDelete,
		onToggleHistory
	}: {
		profile: Profile;
		isSending: boolean;
		canDelete: boolean;
		historyOpen: boolean;
		onLogout: () => void;
		onDelete: () => void;
		onToggleHistory: () => void;
	} = $props();

	let profileMenuOpen = $state(false);
</script>

<header class="chat-header">
	<div class="brand">
		<!-- Only shown on small screens, where the history is a drawer. -->
		<button
			class="history-toggle"
			type="button"
			title="Conversations"
			aria-label={historyOpen ? 'Hide conversations' : 'Show conversations'}
			aria-expanded={historyOpen}
			aria-controls="conversation-history"
			onclick={onToggleHistory}
		>
			<i class="fa-solid fa-bars" aria-hidden="true"></i>
		</button>

		<img src={favicon} alt="" />
		<span>Milo</span>
	</div>

	<div class="header-actions">
		<button
			class="delete-button"
			type="button"
			title="Delete conversation"
			aria-label="Delete conversation"
			disabled={!canDelete || isSending}
			onclick={onDelete}
		>
			<i class="fa-regular fa-trash-can" aria-hidden="true"></i>
		</button>

		<div class="account">
			<button
				class="account-button"
				type="button"
				aria-expanded={profileMenuOpen}
				onclick={() => (profileMenuOpen = !profileMenuOpen)}
			>
				{#if profile.avatar}
					<img class="avatar" src={profile.avatar} alt="" />
				{:else}
					<span class="avatar placeholder">
						{profile.username.slice(0, 1).toUpperCase()}
					</span>
				{/if}

				<span class="username">{profile.username}</span>
				<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
			</button>

			{#if profileMenuOpen}
				<div class="account-menu">
					<strong>{profile.username}</strong>
					<span>Local profile</span>
					<button
						type="button"
						onclick={() => {
							profileMenuOpen = false;
							onLogout();
						}}
					>
						Switch profile / log out
					</button>
				</div>
			{/if}
		</div>
	</div>
</header>

{#if profileMenuOpen}
	<button
		class="menu-backdrop"
		type="button"
		aria-label="Close account menu"
		onclick={() => (profileMenuOpen = false)}
	></button>
{/if}

<style>
	.chat-header {
		position: relative;
		z-index: 2;
		display: flex;
		height: 48px;
		flex-shrink: 0;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		border-bottom: 1px solid var(--border-color);
		background: var(--white);
	}

	.brand,
	.header-actions,
	.account-button {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.brand {
		font-size: 14px;
		font-weight: 600;

		img {
			width: 27px;
			height: 27px;
			object-fit: contain;
		}
	}

	button {
		font: inherit;
		cursor: pointer;

		&:focus-visible {
			outline: 2px solid var(--primary-color);
			outline-offset: 2px;
		}

		&:disabled {
			opacity: 0.4;
			cursor: default;
		}
	}

	.history-toggle,
	.delete-button,
	.account-button {
		padding: 5px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: var(--text-secondary);

		&:hover:not(:disabled) {
			background: var(--hover-color);
			color: var(--text-primary);
		}
	}

	.account {
		position: relative;
	}

	.account-button {
		gap: 7px;

		> i {
			font-size: 10px;
		}
	}

	.avatar {
		width: 27px;
		height: 27px;
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

	.username {
		max-width: 140px;
		overflow: hidden;
		font-size: 12px;
		text-overflow: ellipsis;
	}

	.account-menu {
		position: absolute;
		top: calc(100% + 5px);
		right: 0;
		z-index: 4;
		display: grid;
		width: 200px;
		gap: 7px;
		padding: 10px;
		border: 1px solid var(--border-color);
		border-radius: var(--border-radius);
		background: var(--white);
		box-shadow: var(--shadow);

		strong {
			font-size: 12px;
			overflow-wrap: anywhere;
		}

		span {
			color: var(--text-secondary);
			font-size: 11px;
		}

		button {
			padding: 7px;
			border: 0;
			border-radius: 5px;
			background: var(--hover-color);
			text-align: left;
			font-size: 12px;
		}
	}

	.menu-backdrop {
		position: fixed;
		inset: 48px 0 0;
		z-index: 1;
		border: 0;
		background: transparent;
	}

	.history-toggle {
		display: none;
	}

	@media (max-width: 700px) {
		.history-toggle {
			display: block;
		}
	}

	@media (max-width: 420px) {
		.username {
			max-width: 85px;
		}
	}
</style>
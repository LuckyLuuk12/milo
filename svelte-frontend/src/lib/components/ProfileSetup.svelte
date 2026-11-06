<script lang="ts">
	import favicon from '#lib/assets/milo.png';
	import type { Profile } from '#lib';

	let { profiles = [], onLogin, onCreate }: {
		profiles: Profile[];
		onLogin: (profile: Profile) => void;
		onCreate: (profile: Profile) => void;
	} = $props();

	let username = $state('');
	let avatar = $state<string | null>(null);
	let error = $state('');

	async function handleAvatarChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Select a valid image file.';
			input.value = '';
			return;
		}

		try {
			const bitmap = await createImageBitmap(file);
			const canvas = document.createElement('canvas');
			const size = 128;
			const cropSize = Math.min(bitmap.width, bitmap.height);
			const context = canvas.getContext('2d');

			canvas.width = size;
			canvas.height = size;

			if (!context) throw new Error('Could not process image.');

			context.drawImage(
				bitmap,
				(bitmap.width - cropSize) / 2,
				(bitmap.height - cropSize) / 2,
				cropSize,
				cropSize,
				0,
				0,
				size,
				size
			);

			bitmap.close();
			avatar = canvas.toDataURL('image/jpeg', 0.8);
			error = '';
		} catch (cause) {
			console.error('Could not process profile image:', cause);
			error = 'Could not process that image. Try another file.';
		}
	}

	function createProfile() {
		const name = username.trim();

		if (!name) {
			error = 'Enter a username to continue.';
			return;
		}

		if (profiles.some((profile) => profile.username.toLowerCase() === name.toLowerCase())) {
			error = 'That username already exists. Select the existing profile instead.';
			return;
		}

		error = '';
		onCreate({ username: name, avatar });
	}
</script>

<svelte:head>
	<title>Welcome to Milo</title>
	<meta name="description" content="Set up your local profile to start chatting with Milo." />
</svelte:head>

<main class="setup-page">
	<section class="setup-card">
		<div class="brand">
			<img src={favicon} alt="" />
			<span>Milo</span>
		</div>

		{#if profiles.length}
			<section class="existing-profiles">
				<h2>Continue as</h2>

				<div class="profile-list">
					{#each profiles as profile (profile.username.toLowerCase())}
						<button class="existing-profile" type="button" onclick={() => onLogin(profile)}>
							{#if profile.avatar}
								<img class="avatar" src={profile.avatar} alt="" />
							{:else}
								<span class="avatar placeholder">
									{profile.username.slice(0, 1).toUpperCase()}
								</span>
							{/if}

							<span class="profile-name">{profile.username}</span>
               <i class="fa-solid fa-chevron-right arrow" aria-hidden="true"></i>
						</button>
					{/each}
				</div>
			</section>

			<div class="separator">or create a profile</div>
		{/if}

		<form onsubmit={(event) => { event.preventDefault(); createProfile(); }}>
			<h1>Select profile image &amp; username</h1>

			<div class="profile-fields">
				<label class="image-picker" for="avatar" title="Select profile image">
					{#if avatar}
						<img class="avatar preview" src={avatar} alt="" />
					{:else}
						<span class="avatar placeholder preview">
							{username.trim().slice(0, 1).toUpperCase() || '+'}
						</span>
					{/if}
				</label>

				<input
					id="avatar"
					class="file-input"
					type="file"
					accept="image/*"
					onchange={handleAvatarChange}
				/>

				<input
					class="username-input"
					bind:value={username}
					maxlength="32"
					autocomplete="nickname"
					placeholder="Username"
					aria-label="Username"
					required
				/>
			</div>

			{#if error}
				<p class="error-message" role="alert">{error}</p>
			{/if}

			<button class="create-button" type="submit">Continue <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
		</form>

		<p class="footnote">Profiles are stored locally in this browser. No password required.</p>
	</section>
</main>

<style>
	.setup-page {
		display: grid;
		min-height: 100vh;
		place-items: center;
		padding: 24px 16px;
		background: var(--bg-color);
	}

	.setup-card {
		width: min(100%, 400px);
		padding: 24px;
		border: 1px solid var(--border-color);
		border-radius: var(--border-radius);
		background: var(--white);

		.brand {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 18px;
			font-weight: 700;

			img {
				width: 30px;
				height: 30px;
				object-fit: contain;
			}
		}

		h1 {
			margin: 28px 0 16px;
			font-size: 19px;
			font-weight: 600;
		}

		h2 {
			margin: 0 0 10px;
			font-size: 13px;
			font-weight: 600;
		}

		.profile-list,
		form {
			display: grid;
			gap: 10px;
		}

		.existing-profile {
			display: flex;
			align-items: center;
			gap: 10px;
			width: 100%;
			padding: 9px;
			border: 1px solid var(--border-color);
			border-radius: 8px;
			background: var(--input-bg);
			color: var(--text-primary);
			text-align: left;
			cursor: pointer;

			&:hover {
				border-color: var(--primary-color);
			}
		}

		.avatar {
			width: 40px;
			height: 40px;
			flex-shrink: 0;
			border-radius: 50%;
			object-fit: cover;
		}

		.placeholder {
			display: grid;
			place-items: center;
			background: var(--hover-color);
			color: var(--text-secondary);
		}

		.profile-name {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.arrow {
			color: var(--text-secondary);
		}

		.separator {
			margin: 22px 0;
			color: var(--text-secondary);
			font-size: 12px;
			text-align: center;
		}

		.profile-fields {
			display: flex;
			align-items: center;
			gap: 14px;
		}

		.image-picker {
			flex-shrink: 0;
			border-radius: 50%;
			cursor: pointer;

			&:hover .placeholder,
			&:hover .preview {
				opacity: 0.75;
			}
		}

		.preview {
			display: grid;
			width: 56px;
			height: 56px;
			place-items: center;
			font-size: 22px;
		}

		.file-input {
			display: none;
		}

		.username-input {
			min-width: 0;
			flex: 1;
			padding: 11px;
			border: 1px solid var(--border-color);
			border-radius: 8px;
			background: var(--input-bg);
			color: var(--input-text);
			font: inherit;

			&:focus {
				border-color: var(--primary-color);
				outline: 1px solid var(--primary-color);
			}
		}

		.error-message {
			margin: 0;
			color: var(--danger-color);
			font-size: 13px;
		}

		.create-button {
			margin-top: 6px;
			padding: 11px 14px;
			border: 0;
			border-radius: 8px;
			background: var(--primary-color);
			color: #fff;
			font: inherit;
			cursor: pointer;

			&:hover {
				background: var(--primary-hover);
			}
		}

		.footnote {
			margin: 18px 0 0;
			color: var(--text-secondary);
			font-size: 12px;
			line-height: 1.5;
			text-align: center;
		}
	}

	@media (max-width: 440px) {
		.setup-card {
			padding: 20px;
		}
	}
</style>

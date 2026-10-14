
<script lang="ts">
	import { onMount } from 'svelte';
	import ProfileSetup from '#lib/components/ProfileSetup.svelte';
	import Chat from '#lib/components/Chat.svelte';
  import type { Profile } from '#lib';

	const PROFILES_KEY = 'milo.profiles.v1';
	const ACTIVE_PROFILE_KEY = 'milo.activeUsername.v1';

	let profiles = $state<Profile[]>([]);
	let currentProfile = $state<Profile | null>(null);
	let ready = $state(false);
	let storageError = $state('');

	onMount(() => {
		try {
			const storedProfiles = localStorage.getItem(PROFILES_KEY);
			const parsedProfiles: unknown = storedProfiles
				? JSON.parse(storedProfiles)
				: [];

			profiles = Array.isArray(parsedProfiles)
				? parsedProfiles.filter(
						(profile): profile is Profile =>
							profile !== null &&
							typeof profile === 'object' &&
							'username' in profile &&
							typeof profile.username === 'string' &&
							profile.username.trim().length > 0
					).map((profile) => ({
						username: profile.username.trim(),
						avatar:
							'avatar' in profile && typeof profile.avatar === 'string'
								? profile.avatar
								: null
					}))
				: [];

			const activeUsername = localStorage.getItem(ACTIVE_PROFILE_KEY);

			currentProfile =
				profiles.find((profile) => profile.username === activeUsername) ?? null;
		} catch (error) {
			console.error('Could not restore Milo profiles:', error);
			storageError =
				'Could not load local profiles. Check your browser storage settings.';
		} finally {
			ready = true;
		}
	});

	function persistProfiles(
		nextProfiles: Profile[],
		activeProfile: Profile | null
	): boolean {
		try {
			localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles));

			if (activeProfile) {
				localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfile.username);
			} else {
				localStorage.removeItem(ACTIVE_PROFILE_KEY);
			}

			profiles = nextProfiles;
			currentProfile = activeProfile;
			storageError = '';

			return true;
		} catch (error) {
			console.error('Could not save Milo profile:', error);
			storageError =
				'Could not save this profile. Browser storage may be full or unavailable.';

			return false;
		}
	}

	function login(profile: Profile) {
		const savedProfile = profiles.find(
			(item) => item.username === profile.username
		);

		if (savedProfile) {
			persistProfiles(profiles, savedProfile);
		}
	}

	function createProfile(profile: Profile) {
		const username = profile.username.trim();

		if (
			profiles.some(
				(item) => item.username.toLowerCase() === username.toLowerCase()
			)
		) {
			storageError =
				'That username already exists. Select the existing profile.';
			return;
		}

		const newProfile: Profile = {
			username,
			avatar: profile.avatar || null
		};

		persistProfiles([...profiles, newProfile], newProfile);
	}

	function handleLogout() {
		persistProfiles(profiles, null);
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#121212" />
</svelte:head>

{#if !ready}
	<main class="loading-screen" aria-live="polite">
		<img src="/milo.png" alt="" />
		<p>Loading Milo...</p>
	</main>
{:else if !currentProfile}
	<ProfileSetup {profiles} onLogin={login} onCreate={createProfile} />

	{#if storageError}
		<div class="storage-error" role="alert">
			{storageError}
		</div>
	{/if}
{:else}
	<Chat profile={currentProfile} onLogout={handleLogout} />
{/if}

<style>
	.loading-screen {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--text-secondary);

		img {
			width: 48px;
			height: 48px;
			object-fit: contain;
		}

		p {
			margin: 0;
			font-size: 14px;
		}
	}

	.storage-error {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 100;
		max-width: min(420px, calc(100vw - 32px));
		padding: 12px 16px;
		border: 1px solid var(--danger-color);
		border-radius: var(--border-radius);
		background: var(--white);
		color: var(--danger-color);
		box-shadow: var(--shadow);
		font-size: 13px;
		line-height: 1.5;
	}
</style>

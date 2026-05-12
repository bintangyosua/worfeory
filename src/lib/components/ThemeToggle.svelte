<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Sun, Moon } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let isDark = $state(false);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('color-theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('color-theme', 'light');
		}
	}
</script>

<Button variant="ghost" size="icon" onclick={toggleTheme} aria-label="Toggle theme">
	{#if isDark}
		<Moon class="h-5 w-5" />
	{:else}
		<Sun class="h-5 w-5" />
	{/if}
</Button>

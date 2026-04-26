<script lang="ts">
	import type { SolverSuggestion } from '$lib/solver/solver';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';

	interface Props {
		suggestions: SolverSuggestion[];
		remainingCount: number;
		onSelectWord?: (word: string) => void;
		isCalculating: boolean;
	}

	let { suggestions, remainingCount, onSelectWord, isCalculating }: Props = $props();
</script>

<Card.Root class="w-full">
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<Card.Title class="text-base">Solver Suggestions</Card.Title>
			<Badge variant="secondary" class="font-mono">
				{remainingCount.toLocaleString()} words left
			</Badge>
		</div>
		<Card.Description>
			{#if isCalculating}
				Calculating best guesses...
			{:else if suggestions.length === 0}
				Enter a word and set tile colors to get suggestions.
			{:else}
				Click a word to auto-fill it as your next guess.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content class="pb-4">
		{#if isCalculating}
			<div class="flex items-center justify-center py-6">
				<div class="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
				<span class="text-muted-foreground ml-3 text-sm">Analyzing entropy...</span>
			</div>
		{:else if suggestions.length > 0}
			<div class="space-y-1">
				{#each suggestions as suggestion, i}
					<button
						class={cn(
							'flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors',
							'hover:bg-accent hover:text-accent-foreground',
							'cursor-pointer',
							i === 0 && 'bg-primary/5'
						)}
						onclick={() => onSelectWord?.(suggestion.word)}
						type="button"
					>
						<div class="flex items-center gap-3">
							<span class="text-muted-foreground w-5 text-right font-mono text-xs">
								{i + 1}.
							</span>
							<span class="font-mono text-sm font-bold uppercase tracking-wider">
								{suggestion.word}
							</span>
						</div>
						<span class="font-mono text-xs text-muted-foreground">
							{suggestion.score.toFixed(3)} bits
						</span>
					</button>
				{/each}
			</div>
		{:else}
			<p class="text-muted-foreground py-4 text-center text-sm">
				No suggestions available yet.
			</p>
		{/if}
	</Card.Content>
</Card.Root>

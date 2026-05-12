<script lang="ts">
	import Board from '$lib/components/wordle/Board.svelte';
	import Keyboard from '$lib/components/wordle/Keyboard.svelte';
	import SuggestionPanel from '$lib/components/wordle/SuggestionPanel.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Card from '$lib/components/ui/card';
	import {
		type GuessRow,
		type TileData,
		type TileState,
		type SolverSuggestion,
		type SolverMode,
		type GuessHistory,
		getSuggestions,
		applyGuess,
		tilesToPattern,
		getWordlist,
		isValidWord,
		getTopPossibleWords
	} from '$lib/solver/solver';
	import { Input } from '$lib/components/ui/input';
	import { RotateCcw, Lightbulb, Info, Zap } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	// Game state
	let guesses = $state<GuessRow[]>(createEmptyBoard());
	let activeRow = $state(0);
	let currentCol = $state(0);
	let remainingWords = $state<string[]>(getWordlist());
	let topPossibleWords = $derived(getTopPossibleWords(remainingWords, 10));
	let suggestions = $state<SolverSuggestion[]>([]);
	let isCalculating = $state(false);
	let letterStates = $state<Record<string, 'correct' | 'present' | 'absent' | undefined>>({});
	let gameMessage = $state('');
	let gameWon = $state(false);
	let showHelp = $state(false);

	let selectedMode = $state<SolverMode>('rookie');
	let selectedStarter = $state('salet');
	let simTarget = $state('');
	let isSimulating = $state(false);

	function buildHistory(upToRow: number): GuessHistory[] {
		const h: GuessHistory[] = [];
		if (upToRow < 0) return h;
		for (let r = 0; r <= upToRow; r++) {
			const row = guesses[r];
			const word = row.tiles.map((t) => t.letter).join('');
			if (word.length !== 5) break;
			const pattern = tilesToPattern(row.tiles);
			h.push({ guess: word, pattern });
		}
		return h;
	}

	function createEmptyBoard(): GuessRow[] {
		return Array.from({ length: 6 }, () => ({
			word: '',
			tiles: Array.from({ length: 5 }, () => ({
				letter: '',
				state: 'empty' as TileState
			}))
		}));
	}

	function handleKey(key: string) {
		if (gameWon || activeRow >= 6) return;

		if (key === '⌫' || key === 'Backspace') {
			if (currentCol > 0) {
				currentCol--;
				guesses[activeRow].tiles[currentCol] = { letter: '', state: 'empty' };
				guesses[activeRow].word = guesses[activeRow].tiles.map((t) => t.letter).join('');
			}
			return;
		}

		if (key === 'Enter') {
			submitGuess();
			return;
		}

		// Regular letter
		const letter = key.toLowerCase();
		if (/^[a-z]$/.test(letter) && currentCol < 5) {
			guesses[activeRow].tiles[currentCol] = { letter, state: 'absent' };
			guesses[activeRow].word = guesses[activeRow].tiles.map((t) => t.letter).join('');
			currentCol++;
		}
	}

	function handleTileClick(row: number, col: number) {
		if (row !== activeRow) return;
		const tile = guesses[row].tiles[col];
		if (!tile.letter) return;

		const stateOrder: TileState[] = ['absent', 'present', 'correct'];
		const currentIndex = stateOrder.indexOf(tile.state as TileState);
		const nextState = stateOrder[(currentIndex + 1) % stateOrder.length];
		guesses[row].tiles[col] = { ...tile, state: nextState };
	}

	function submitGuess() {
		const row = guesses[activeRow];
		const word = row.tiles.map((t) => t.letter).join('');

		if (word.length !== 5) {
			gameMessage = 'Word must be 5 letters!';
			setTimeout(() => (gameMessage = ''), 2000);
			return;
		}

		if (!isValidWord(word)) {
			gameMessage = 'Word not in dictionary!';
			setTimeout(() => (gameMessage = ''), 2000);
			return;
		}

		const pattern = tilesToPattern(row.tiles);

		// Update keyboard letter states
		for (let i = 0; i < 5; i++) {
			const letter = row.tiles[i].letter;
			const tileState = row.tiles[i].state as 'correct' | 'present' | 'absent';
			const existing = letterStates[letter];
			if (
				tileState === 'correct' ||
				(tileState === 'present' && existing !== 'correct') ||
				(tileState === 'absent' && !existing)
			) {
				letterStates[letter] = tileState;
			}
		}

		// Check win
		if (pattern === 'CCCCC') {
			gameWon = true;
			gameMessage = '🎉 Solved!';
			return;
		}

		// Filter remaining words
		remainingWords = applyGuess(remainingWords, word, pattern);

		if (remainingWords.length === 0) {
			gameMessage = 'No matching words found!';
			return;
		}

		// Move to next row
		activeRow++;
		currentCol = 0;

		if (activeRow >= 6) {
			gameMessage = 'Out of guesses!';
			return;
		}

		// Calculate suggestions
		calculateSuggestions();
	}

	async function calculateSuggestions() {
		isCalculating = true;
		suggestions = [];

		// Use setTimeout to allow UI to update
		await new Promise((resolve) => setTimeout(resolve, 50));

		try {
			const history = buildHistory(activeRow > 0 ? activeRow - 1 : -1);
			suggestions = getSuggestions(remainingWords, history, selectedMode, 10);
		} catch {
			suggestions = [];
		}

		isCalculating = false;

		// Auto-fill the top suggestion into the board
		if (suggestions.length > 0) {
			selectSuggestion(suggestions[0].word);
		}
	}

	function selectSuggestion(word: string) {
		if (gameWon || activeRow >= 6) return;

		// Fill in the word
		for (let i = 0; i < 5; i++) {
			guesses[activeRow].tiles[i] = {
				letter: word[i],
				state: 'absent'
			};
		}
		guesses[activeRow].word = word;
		currentCol = 5;
	}

	function resetGame() {
		guesses = createEmptyBoard();
		activeRow = 0;
		currentCol = 0;
		remainingWords = getWordlist();
		suggestions = [];
		letterStates = {};
		gameMessage = '';
		gameWon = false;
		selectSuggestion(selectedStarter);
	}

	function getInitialSuggestion() {
		calculateSuggestions();
	}

	async function simulateGame() {
		const targetWord = simTarget.toLowerCase();
		if (targetWord.length !== 5) return;
		
		if (!isValidWord(targetWord)) {
			gameMessage = 'Target word not in dictionary!';
			setTimeout(() => (gameMessage = ''), 2000);
			return;
		}

		isSimulating = true;

		try {
			resetGame();
			await new Promise(res => setTimeout(res, 50));

			for (let r = 0; r < 6; r++) {
				if (r === 0) {
					selectSuggestion(selectedStarter);
				} else {
					if (suggestions.length === 0) {
						gameMessage = 'No words left to guess!';
						break;
					}
					selectSuggestion(suggestions[0].word);
				}

				const guess = guesses[activeRow].word;
				let remainingTarget = targetWord.split('');
				const pattern = ['A', 'A', 'A', 'A', 'A'];
				
				// Pass 1: Correct
				for (let i = 0; i < 5; i++) {
					if (guess[i] === remainingTarget[i]) {
						pattern[i] = 'C';
						remainingTarget[i] = '.';
					}
				}
				// Pass 2: Present
				for (let i = 0; i < 5; i++) {
					if (pattern[i] !== 'C') {
						const idx = remainingTarget.indexOf(guess[i]);
						if (idx !== -1) {
							pattern[i] = 'P';
							remainingTarget[idx] = '.';
						}
					}
				}

				for (let i = 0; i < 5; i++) {
					guesses[activeRow].tiles[i].state = pattern[i] === 'C' ? 'correct' : (pattern[i] === 'P' ? 'present' : 'absent');
				}

				submitGuess();

				if (gameWon) break;
				
				await new Promise(res => setTimeout(res, 500));
			}
		} finally {
			isSimulating = false;
		}
	}

	onMount(() => {
		selectSuggestion(selectedStarter);
	});

	// Handle physical keyboard events
	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey || e.altKey || e.metaKey || isSimulating) return;

		// Ignore global keyboard events if user is typing in an input field
		if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;

		if (e.key === 'Backspace') {
			e.preventDefault();
			handleKey('⌫');
		} else if (e.key === 'Enter') {
			e.preventDefault();
			handleKey('Enter');
		} else if (/^[a-zA-Z]$/.test(e.key)) {
			handleKey(e.key);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Wordle Solver — Entropy-Based Word Suggestions</title>
	<meta
		name="description"
		content="An intelligent Wordle solver that uses information entropy to suggest optimal guesses. Based on 3Blue1Brown's information theory approach."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Header -->
	<header class="border-b border-border">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
			<div class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-primary" />
				<h1 class="text-lg font-bold tracking-tight">Wordle Solver</h1>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => (showHelp = !showHelp)}>
					<Info class="mr-1 h-4 w-4" />
					How to use
				</Button>
				<Button variant="outline" size="sm" onclick={resetGame}>
					<RotateCcw class="mr-1 h-4 w-4" />
					Reset
				</Button>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<!-- Help Banner -->
	{#if showHelp}
		<div class="border-b border-border bg-muted/50">
			<div class="mx-auto max-w-5xl px-4 py-4">
				<Card.Root>
					<Card.Content class="pt-4">
						<div class="grid gap-3 text-sm md:grid-cols-3">
							<div class="flex gap-2">
								<Badge variant="outline" class="shrink-0">1</Badge>
								<p>
									Type a word or click a suggestion, then <strong>click each tile</strong> to set its
									color based on Wordle's feedback.
								</p>
							</div>
							<div class="flex gap-2">
								<Badge variant="outline" class="shrink-0">2</Badge>
								<p>
									Press <strong>Enter</strong> to submit. The solver will filter possible words and suggest
									optimal next guesses.
								</p>
							</div>
							<div class="flex gap-2">
								<Badge variant="outline" class="shrink-0">3</Badge>
								<p>
									Suggestions are ranked by <strong>information entropy</strong> — higher bits means more
									information gained per guess.
								</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
		<!-- Left: Board + Keyboard -->
		<div class="flex flex-1 flex-col items-center gap-5">
			<!-- Message -->
			{#if gameMessage}
				<div class="animate-in duration-200 fade-in slide-in-from-top-1">
					<Badge variant={gameWon ? 'default' : 'destructive'} class="px-4 py-1.5 text-sm">
						{gameMessage}
					</Badge>
				</div>
			{/if}

			<!-- Tile Color Legend -->
			<div class="flex items-center gap-4 text-xs text-muted-foreground">
				<div class="flex items-center gap-1.5">
					<div class="h-4 w-4 rounded-sm bg-emerald-600"></div>
					<span>Correct</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-4 w-4 rounded-sm bg-amber-500"></div>
					<span>Present</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-4 w-4 rounded-sm border border-border bg-muted"></div>
					<span>Absent</span>
				</div>
			</div>

			<!-- Board -->
			<Board {guesses} {activeRow} onTileClick={handleTileClick} />

			<Separator />

			<!-- Keyboard -->
			<Keyboard onKey={handleKey} {letterStates} />
		</div>

		<!-- Right: Suggestions -->
		<div class="w-full lg:w-80">
			<div class="sticky top-6 space-y-4">
				<SuggestionPanel
					{suggestions}
					possibleWords={topPossibleWords}
					remainingCount={remainingWords.length}
					onSelectWord={selectSuggestion}
					{isCalculating}
				/>

				<Button
					variant="outline"
					class="w-full"
					onclick={getInitialSuggestion}
					disabled={isCalculating}
				>
					<Lightbulb class="mr-2 h-4 w-4" />
					{suggestions.length > 0 ? 'Recalculate' : 'Get Suggestions'}
				</Button>

				<!-- Mode Picker -->
				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-base">Solver Mode</Card.Title>
						<Card.Description>Select the difficulty constraints</Card.Description>
					</Card.Header>
					<Card.Content class="pb-4">
						<div class="grid grid-cols-3 gap-2">
							{#each ['rookie', 'veteran', 'legend'] as mode}
								<Button
									variant={selectedMode === mode ? 'default' : 'outline'}
									size="sm"
									class="capitalize"
									onclick={() => {
										selectedMode = mode as SolverMode;
										if (simTarget.length === 5 && !isSimulating) {
											simulateGame();
										} else if (activeRow > 0) {
											calculateSuggestions();
										}
									}}
								>
									{mode}
								</Button>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Starter Picker -->
				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-base">Choose Starter Word</Card.Title>
						<Card.Description>Select your preferred opening word</Card.Description>
					</Card.Header>
					<Card.Content class="pb-4">
						<div class="grid grid-cols-2 gap-2">
							<Button
								variant={selectedStarter === 'salet' ? 'default' : 'outline'}
								class="h-auto flex-col items-start py-2"
								onclick={() => {
									selectedStarter = 'salet';
									if (activeRow === 0 && currentCol === 0) selectSuggestion('salet');
								}}
							>
								<span class="font-bold tracking-wider">SALET</span>
								<span class="text-[10px] font-normal opacity-80">Fastest solve</span>
							</Button>
							<Button
								variant={selectedStarter === 'tares' ? 'default' : 'outline'}
								class="h-auto flex-col items-start py-2"
								onclick={() => {
									selectedStarter = 'tares';
									if (activeRow === 0 && currentCol === 0) selectSuggestion('tares');
								}}
							>
								<span class="font-bold tracking-wider">TARES</span>
								<span class="text-[10px] font-normal opacity-80">High entropy</span>
							</Button>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Simulation -->
				<Card.Root>
					<Card.Header class="pb-3">
						<Card.Title class="text-base">Simulate Game</Card.Title>
						<Card.Description>Enter target word to auto-solve</Card.Description>
					</Card.Header>
					<Card.Content class="pb-4">
						<div class="flex gap-2">
							<Input
								bind:value={simTarget}
								maxlength={5}
								placeholder="e.g. CRANE"
								class="uppercase"
								onkeydown={(e) => e.key === 'Enter' && !isSimulating && simulateGame()}
							/>
							<Button disabled={isSimulating || simTarget.length !== 5} onclick={simulateGame}>
								{isSimulating ? '...' : 'Simulate'}
							</Button>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Quick Info Card -->
				<Card.Root>
					<Card.Content class="pt-4">
						<div class="space-y-2 text-xs text-muted-foreground">
							<p>
								<strong class="text-foreground">Algorithm:</strong> Information entropy (Shannon)
							</p>
							<p>
								<strong class="text-foreground">Inspired by:</strong> 3Blue1Brown's video on solving Wordle
								using information theory
							</p>
							<p>
								<strong class="text-foreground">Dictionary:</strong>
								{getWordlist().length.toLocaleString()} five-letter words
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-border">
		<div class="mx-auto max-w-5xl px-4 py-3">
			<p class="text-center text-xs text-muted-foreground">Created By Minuettaro</p>
		</div>
	</footer>
</div>

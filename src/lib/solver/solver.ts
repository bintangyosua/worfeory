import wordlistData from '$lib/data/wordlist.json';
import freqMapData from '$lib/data/freqmap.json';
import { entropy } from './entropy';
import { filterWordlist } from './filter-wordlist';

const totalWordlist: string[] = wordlistData as string[];
const freqMap = freqMapData as Record<string, number>;

export type TileState = 'empty' | 'absent' | 'present' | 'correct';

export interface TileData {
	letter: string;
	state: TileState;
}

export interface GuessRow {
	tiles: TileData[];
	word: string;
}

export interface SolverSuggestion {
	word: string;
	score: number;
}

export type SolverMode = 'rookie' | 'veteran' | 'legend';

export interface GuessHistory {
	guess: string;
	pattern: string;
}

/**
 * Get the best guess suggestions based on the current remaining wordlist.
 * Returns top N suggestions sorted by entropy score.
 */
export function getSuggestions(
	remainingWords: string[],
	history: GuessHistory[] = [],
	mode: SolverMode = 'rookie',
	topN: number = 10
): SolverSuggestion[] {
	if (remainingWords.length === 0) return [];
	if (remainingWords.length === 1) {
		return [{ word: remainingWords[0], score: 0 }];
	}
	if (remainingWords.length === 2) {
		// "Kalo sisa 2, bukan mencari informasi lagi, tapi pake aja salah satunya"
		return [
			{ word: remainingWords[0], score: 0 },
			{ word: remainingWords[1], score: 0 }
		];
	}

	const scored: SolverSuggestion[] = [];
	let candidatesPool: string[];

	if (mode === 'rookie') {
		candidatesPool = totalWordlist;
	} else if (mode === 'veteran') {
		candidatesPool = totalWordlist.filter((word) => {
			for (const h of history) {
				for (let i = 0; i < 5; i++) {
					if (h.pattern[i] === 'C') {
						if (word[i] !== h.guess[i]) return false;
					} else if (h.pattern[i] === 'P') {
						if (!word.includes(h.guess[i])) return false;
					}
				}
			}
			return true;
		});
	} else if (mode === 'legend') {
		candidatesPool = remainingWords;
	} else {
		candidatesPool = totalWordlist;
	}

	// Score all words from the candidates pool
	for (const word of candidatesPool) {
		const score = entropy(remainingWords, word);
		scored.push({ word, score });
	}

	// Sort by score descending
	scored.sort((a, b) => b.score - a.score);

	return scored.slice(0, topN);
}

/**
 * Get the top N possible words sorted by frequency.
 */
export function getTopPossibleWords(
	remainingWords: string[],
	topN: number = 10
): string[] {
	// We map to frequencies, sort, and take topN
	return [...remainingWords]
		.sort((a, b) => getWordFrequency(b) - getWordFrequency(a))
		.slice(0, topN);
}

/**
 * Filter down the remaining word list based on a guess and its pattern
 */
export function applyGuess(
	remainingWords: string[],
	guess: string,
	pattern: string
): string[] {
	return filterWordlist(remainingWords, guess, pattern);
}

/**
 * Convert tile states to a pattern string (A/P/C)
 */
export function tilesToPattern(tiles: TileData[]): string {
	return tiles
		.map((t) => {
			switch (t.state) {
				case 'correct':
					return 'C';
				case 'present':
					return 'P';
				case 'absent':
					return 'A';
				default:
					return 'A';
			}
		})
		.join('');
}

/**
 * Get the initial wordlist
 */
export function getWordlist(): string[] {
	return [...totalWordlist];
}

/**
 * Get the word frequency for display purposes
 */
export function getWordFrequency(word: string): number {
	return freqMap[word] ?? 0;
}

/**
 * Check if a word exists in the wordlist
 */
export function isValidWord(word: string): boolean {
	return totalWordlist.includes(word.toLowerCase());
}

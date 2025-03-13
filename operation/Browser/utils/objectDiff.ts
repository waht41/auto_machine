/**
 * Array Diff Algorithm
 * 
 * This module provides functionality to compare two arrays of objects and identify
 * the differences between them (additions, deletions, and changes), without relying on unique keys.
 */

import { compareTwoStrings } from 'string-similarity';
import { distance } from 'fastest-levenshtein';
import { isEqual } from 'lodash';

/**
 * Represents a change in an object property
 */
export interface PropertyChange<T = any> {
  oldValue: T;
  newValue: T;
}

/**
 * Represents the type of difference found
 */
export enum DiffType {
  ADDED = 'added',
  DELETED = 'deleted',
  CHANGED = 'changed'
}

/**
 * Represents a difference between objects
 */
export interface Diff<T> {
  type: DiffType;
  item: T;
  changes?: Record<string, PropertyChange>; // Only for CHANGED type
  oldItem?: T; // Reference to the original item (for CHANGED type)
}

/**
 * Options for array diff operation
 */
export interface DiffOptions {
  /** Similarity threshold (0-1) above which items are considered the same */
  similarityThreshold?: number;
  /** Fields that should have more weight in similarity calculation */
  keyFields?: string[];
  /** Maximum Levenshtein distance for text similarity */
  maxTextDistance?: number;
}

/**
 * Calculates similarity score between two objects
 * 
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @param options - Comparison options
 * @returns A similarity score between 0 and 1
 */
export function calculateSimilarity(
	obj1: Record<string, any>,
	obj2: Record<string, any>,
	options: DiffOptions = {}
): number {
	const keyFields = options.keyFields || [];
	const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
	let totalScore = 0;
	let totalWeight = 0;
  
	for (const key of allKeys) {
		// Skip undefined or null values on both sides
		if (obj1[key] == null && obj2[key] == null) continue;
    
		// Assign a weight to the field
		const weight = keyFields.includes(key) ? 3 : 1;
		totalWeight += weight;
    
		// If key doesn't exist in one of the objects
		if (obj1[key] === undefined || obj2[key] === undefined) {
			// Score 0 for this field
			continue;
		}
    
		const val1 = obj1[key];
		const val2 = obj2[key];
    
		// Calculate similarity based on value type
		let fieldScore = 0;
    
		if (typeof val1 === 'string' && typeof val2 === 'string') {
			// For text fields, use string similarity
			const maxDistance = options.maxTextDistance || 10;
			const stringDist = distance(val1, val2);
      
			if (stringDist === 0) {
				fieldScore = 1; // Exact match
			} else if (stringDist <= maxDistance) {
				fieldScore = 1 - (stringDist / maxDistance);
			} else {
				// Fall back to string similarity for longer texts
				fieldScore = compareTwoStrings(val1, val2);
			}
		} else if (typeof val1 === 'number' && typeof val2 === 'number') {
			// For numbers, calculate relative similarity
			const maxVal = Math.max(Math.abs(val1), Math.abs(val2));
			if (maxVal === 0) {
				fieldScore = 1; // Both values are 0
			} else {
				const diff = Math.abs(val1 - val2);
				fieldScore = 1 - Math.min(diff / maxVal, 1);
			}
		} else if (Array.isArray(val1) && Array.isArray(val2)) {
			// For arrays, compare length and content
			if (val1.length === 0 && val2.length === 0) {
				fieldScore = 1;
			} else if (val1.length === 0 || val2.length === 0) {
				fieldScore = 0;
			} else {
				// Simple array similarity based on common elements
				const set1 = new Set(val1.map(String));
				const set2 = new Set(val2.map(String));
				const intersection = new Set([...set1].filter(x => set2.has(x)));
				fieldScore = (2 * intersection.size) / (set1.size + set2.size);
			}
		} else if (val1 === val2) {
			// Direct equality for other types
			fieldScore = 1;
		}
    
		totalScore += fieldScore * weight;
	}
  
	return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Finds the longest common subsequence between two arrays
 * 
 * @param arr1 - First array
 * @param arr2 - Second array
 * @param similarityFn - Function to compare two items
 * @param threshold - Similarity threshold to consider items as matching
 * @returns An array of pairs of indices [i, j] representing matches
 */
export function findLongestCommonSubsequence<T>(
	arr1: T[],
	arr2: T[],
	similarityFn: (a: T, b: T) => number,
	threshold: number
): [number, number][] {
	// Create a matrix of similarity scores
	const scores: number[][] = [];
	for (let i = 0; i <= arr1.length; i++) {
		scores[i] = Array(arr2.length + 1).fill(0);
	}
  
	// Fill the matrix
	for (let i = 1; i <= arr1.length; i++) {
		for (let j = 1; j <= arr2.length; j++) {
			const similarity = similarityFn(arr1[i-1], arr2[j-1]);
			if (similarity >= threshold) {
				scores[i][j] = scores[i-1][j-1] + 1;
			} else {
				scores[i][j] = Math.max(scores[i-1][j], scores[i][j-1]);
			}
		}
	}
  
	// Backtrack to find matched pairs
	const matches: [number, number][] = [];
	let i = arr1.length;
	let j = arr2.length;
  
	while (i > 0 && j > 0) {
		const similarity = similarityFn(arr1[i-1], arr2[j-1]);
    
		if (similarity >= threshold && scores[i][j] === scores[i-1][j-1] + 1) {
			matches.unshift([i-1, j-1]);
			i--;
			j--;
		} else if (scores[i-1][j] >= scores[i][j-1]) {
			i--;
		} else {
			j--;
		}
	}
  
	return matches;
}

/**
 * Compares two objects and returns the changes
 * 
 * @param oldObj - The original object
 * @param newObj - The new object to compare against
 * @returns An object containing the changes between the objects
 */
export function compareObjects(
	oldObj: Record<string, any>,
	newObj: Record<string, any>
): Record<string, PropertyChange> | null {
	const changes: Record<string, PropertyChange> = {};
	let hasChanges = false;
  
	// Find all keys from both objects
	const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  
	for (const key of allKeys) {
		if (!isEqual(oldObj[key], newObj[key])) {
			changes[key] = {
				oldValue: oldObj[key],
				newValue: newObj[key]
			};
			hasChanges = true;
		}
	}
  
	return hasChanges ? changes : null;
}

/**
 * Compares two arrays of objects and returns the differences
 * This implementation does not rely on specific keys for comparison
 * 
 * @template T - The type of objects being compared
 * @param oldList - The original array of objects
 * @param newList - The new array of objects to compare against
 * @param options - Options for the diff algorithm
 * @returns An array of differences (additions, deletions, and changes)
 */
export function diffArrays<T extends Record<string, any>>(
	oldList: T[],
	newList: T[],
	options: DiffOptions = {}
): Diff<T>[] {
	const result: Diff<T>[] = [];
	const similarityThreshold = options.similarityThreshold || 0.7;
  
	// Handle empty arrays
	if (oldList.length === 0) {
		return newList.map(item => ({ type: DiffType.ADDED, item }));
	}
	if (newList.length === 0) {
		return oldList.map(item => ({ type: DiffType.DELETED, item }));
	}
  
	// Create a similarity function using our calculateSimilarity function
	const similarityFn = (a: T, b: T) => calculateSimilarity(a, b, options);
  
	// Find the longest common subsequence
	const matches = findLongestCommonSubsequence(oldList, newList, similarityFn, similarityThreshold);
  
	// Create sets to track which indices have been matched
	const matchedOldIndices = new Set(matches.map(([i, _]) => i));
	const matchedNewIndices = new Set(matches.map(([_, j]) => j));
  
	// Process matches (changed items)
	for (const [oldIndex, newIndex] of matches) {
		const oldItem = oldList[oldIndex];
		const newItem = newList[newIndex];
    
		const changes = compareObjects(oldItem, newItem);
		if (changes) {
			result.push({
				type: DiffType.CHANGED,
				item: newItem,
				changes,
				oldItem
			});
		}
	}
  
	// Process deleted items (in old but not matched)
	for (let i = 0; i < oldList.length; i++) {
		if (!matchedOldIndices.has(i)) {
			result.push({
				type: DiffType.DELETED,
				item: oldList[i]
			});
		}
	}
  
	// Process added items (in new but not matched)
	for (let j = 0; j < newList.length; j++) {
		if (!matchedNewIndices.has(j)) {
			result.push({
				type: DiffType.ADDED,
				item: newList[j]
			});
		}
	}
  
	return result;
}

/**
 * Represents a difference between objects (for backward compatibility)
 */
export interface DiffWithKey<T, K extends keyof T = keyof T> {
  type: DiffType;
  item: T;
  changes?: Record<Exclude<keyof T, K>, PropertyChange>; // Only for CHANGED type
}

/**
 * Type for a function that extracts an ID from an object
 */
export type IdExtractor<T, K> = (item: T) => K;

/**
 * Compares two arrays of objects and returns the differences
 * 
 * @template T - The type of objects being compared
 * @param oldList - The original array of objects
 * @param newList - The new array of objects to compare against
 * @param idFieldOrExtractor - Optional field name or function to extract ID. 
 *                           If not provided, similarity-based comparison will be used.
 * @param options - Options for similarity-based comparison (only used when idFieldOrExtractor is not provided)
 * @returns An array of differences (additions, deletions, and changes)
 */
export function diffObjects<T extends Record<string, any>, K extends keyof T>(
  oldList: T[],
  newList: T[],
  idField: K
): DiffWithKey<T, K>[];

export function diffObjects<T extends Record<string, any>, K>(
  oldList: T[],
  newList: T[],
  idExtractor: IdExtractor<T, K>
): DiffWithKey<T>[];

export function diffObjects<T extends Record<string, any>>(
  oldList: T[],
  newList: T[],
  options?: DiffOptions
): Diff<T>[];

export function diffObjects<T extends Record<string, any>, K extends keyof T | any>(
	oldList: T[],
	newList: T[],
	idFieldOrExtractorOrOptions?: K | IdExtractor<T, any> | DiffOptions
): DiffWithKey<T>[] | Diff<T>[] {
	// If no parameter is provided or it's a DiffOptions object, use diffArrays
	if (idFieldOrExtractorOrOptions === undefined ||
      (typeof idFieldOrExtractorOrOptions === 'object' && 
       !Array.isArray(idFieldOrExtractorOrOptions) && 
       typeof (idFieldOrExtractorOrOptions as Function) !== 'function')) {
		return diffArrays(oldList, newList, idFieldOrExtractorOrOptions as DiffOptions);
	}
  
	// Legacy key-based comparison
	const result: DiffWithKey<T>[] = [];
  
	// Create maps for faster lookups
	const oldMap = new Map<any, T>();
	const newMap = new Map<any, T>();
  
	// Determine if we're using a field name or an extractor function
	const getItemId = typeof idFieldOrExtractorOrOptions === 'function'
		? idFieldOrExtractorOrOptions as IdExtractor<T, any>
		: (item: T) => item[idFieldOrExtractorOrOptions as keyof T];
  
	// Populate the maps
	oldList.forEach(item => oldMap.set(getItemId(item), item));
	newList.forEach(item => newMap.set(getItemId(item), item));
  
	// Find deleted items (in old but not in new)
	oldList.forEach(oldItem => {
		const id = getItemId(oldItem);
		if (!newMap.has(id)) {
			result.push({
				type: DiffType.DELETED,
				item: oldItem
			});
		}
	});
  
	// Find added and changed items
	newList.forEach(newItem => {
		const id = getItemId(newItem);
    
		// Item is added (in new but not in old)
		if (!oldMap.has(id)) {
			result.push({
				type: DiffType.ADDED,
				item: newItem
			});
			return;
		}
    
		// Item exists in both, check for changes
		const oldItem = oldMap.get(id)!;
		const changes: Record<string, PropertyChange> = {};
		let hasChanges = false;
    
		// Compare all properties
		Object.keys(newItem).forEach(key => {
			// Skip the id field if it's a string key
			if (typeof idFieldOrExtractorOrOptions === 'string' && key === idFieldOrExtractorOrOptions) return;
      
			// Check if the property values are different
			if (!isEqual(oldItem[key], newItem[key])) {
				changes[key] = {
					oldValue: oldItem[key],
					newValue: newItem[key]
				};
				hasChanges = true;
			}
		});
    
		// Check for properties in old object that are not in new object
		Object.keys(oldItem).forEach(key => {
			// Skip the id field if it's a string key
			if (typeof idFieldOrExtractorOrOptions === 'string' && key === idFieldOrExtractorOrOptions) return;
      
			if (!(key in newItem)) {
				changes[key] = {
					oldValue: oldItem[key],
					newValue: undefined
				};
				hasChanges = true;
			}
		});
    
		// If there are changes, add to result
		if (hasChanges) {
			result.push({
				type: DiffType.CHANGED,
				item: newItem,
				changes
			});
		}
	});
  
	return result;
}

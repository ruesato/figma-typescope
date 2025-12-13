import { useMemo } from 'react';

/**
 * Calculate Levenshtein distance between two strings
 * Measures the minimum number of single-character edits needed to change one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Check if query is a substring match in text
 * Characters must appear in order but don't need to be consecutive
 */
function isSubstringMatch(text: string, query: string): boolean {
  let textIndex = 0;
  for (let queryIndex = 0; queryIndex < query.length; queryIndex++) {
    textIndex = text.indexOf(query[queryIndex], textIndex);
    if (textIndex === -1) return false;
    textIndex++;
  }
  return true;
}

/**
 * Get match score for fuzzy search
 * Returns 0 if no match, higher scores for better matches
 *
 * Priority:
 * 1. Exact match (score: 1000)
 * 2. Starts with query (score: 500)
 * 3. Substring match (score: 100 - distance)
 * 4. Levenshtein match if query < 4 chars and distance <= threshold
 */
function getMatchScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 1000;

  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 500;

  // Substring match (sequential characters)
  if (isSubstringMatch(lowerText, lowerQuery)) {
    // Boost score for matches earlier in the string
    const position = lowerText.indexOf(lowerQuery[0]);
    return 100 - (position * 0.1);
  }

  // Levenshtein match for short queries
  // Only apply for short queries to avoid performance issues
  if (lowerQuery.length <= 4) {
    const distance = levenshteinDistance(lowerText, lowerQuery);
    // Allow typos: max distance is roughly 1-2 characters for short strings
    const maxDistance = Math.ceil(lowerQuery.length / 2);
    if (distance <= maxDistance) {
      return 50 - distance;
    }
  }

  return 0;
}

/**
 * Hook for fuzzy search with smart matching
 *
 * Implements two-tier search strategy:
 * 1. Start with substring matching (fast, precise)
 * 2. Fall back to Levenshtein distance for typo tolerance (if few results)
 *
 * @param items Array of items to search
 * @param query Search query string
 * @param searchFields Array of field names to search (supports nested with dot notation)
 * @returns Sorted array of matching items
 */
export function useFuzzySearch<T extends Record<string, any>>(
  items: T[],
  query: string,
  searchFields: (keyof T)[] = []
): T[] {
  return useMemo(() => {
    if (!query.trim() || searchFields.length === 0) {
      return items;
    }

    // Get value from potentially nested field (e.g., "metadata.name")
    const getFieldValue = (obj: T, field: string): string => {
      const value = field.split('.').reduce((current, part) => current?.[part], obj as any);
      return String(value || '').trim();
    };

    // Score each item based on all search fields
    const scored = items
      .map((item) => {
        let bestScore = 0;

        for (const field of searchFields) {
          const fieldValue = getFieldValue(item, String(field));
          const score = getMatchScore(fieldValue, query);
          bestScore = Math.max(bestScore, score);
        }

        return { item, score: bestScore };
      })
      .filter((entry) => entry.score > 0);

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score).map((entry) => entry.item);
  }, [items, query, searchFields]);
}

export default useFuzzySearch;

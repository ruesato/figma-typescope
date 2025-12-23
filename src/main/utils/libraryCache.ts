/**
 * Library Cache - Singleton pattern for library resolution
 *
 * Caches library data for the duration of an audit to eliminate redundant API calls.
 * Performance impact: Eliminates 10,000+ calls to getAvailableLibrariesAsync() per audit.
 */

let libraryMapCache: Map<string, string> | null = null;
let libraryListCache: any[] | null = null;

/**
 * Get library map (key -> name)
 * Cached for audit duration to avoid repeated API calls
 */
export async function getLibraryMap(): Promise<Map<string, string>> {
  if (libraryMapCache) {
    return libraryMapCache;
  }

  const map = new Map<string, string>();

  try {
    // Try variable collections first (new API)
    if (
      figma.teamLibrary &&
      typeof figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync === 'function'
    ) {
      try {
        const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        for (const collection of collections) {
          map.set(collection.key, collection.name);
        }
      } catch (e) {
        console.warn('[LibraryCache] Could not load library variable collections:', e);
      }
    }

    // Try traditional libraries (fallback)
    if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibrariesAsync === 'function') {
      try {
        const libraries = await figma.teamLibrary.getAvailableLibrariesAsync();
        for (const library of libraries) {
          // Only add if not already present (variable collections take precedence)
          if (!map.has(library.key)) {
            map.set(library.key, library.name);
          }
        }
      } catch (e) {
        console.warn('[LibraryCache] Could not load style libraries:', e);
      }
    }
  } catch (error) {
    console.warn(
      '[LibraryCache] Could not load team libraries - proceeding with basic name resolution:',
      error
    );
  }

  libraryMapCache = map;
  console.log(`[LibraryCache] Cached ${map.size} library entries`);
  return map;
}

/**
 * Get library list
 * Cached for audit duration to avoid repeated API calls
 */
export async function getLibraryList(): Promise<any[]> {
  if (libraryListCache) {
    return libraryListCache;
  }

  try {
    if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibrariesAsync === 'function') {
      libraryListCache = await figma.teamLibrary.getAvailableLibrariesAsync();
      console.log(`[LibraryCache] Cached ${libraryListCache.length} libraries`);
      return libraryListCache;
    }
  } catch (error) {
    console.warn('[LibraryCache] Could not load libraries:', error);
  }

  libraryListCache = [];
  return libraryListCache;
}

/**
 * Clear library cache
 * Should be called at the start of each audit to ensure fresh data
 */
export function clearLibraryCache(): void {
  libraryMapCache = null;
  libraryListCache = null;
  console.log('[LibraryCache] Cache cleared');
}

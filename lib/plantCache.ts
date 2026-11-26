/**
 * Client-side in-memory cache for plant hierarchy.
 * Since plant and area hierarchy is static master data, caching it in the browser
 * allows instant rendering when navigating between Dashboard and the Create Permit form.
 */

let cachedPlantsData: any[] | null = null

export function getCachedPlants(): any[] | null {
  return cachedPlantsData
}

export function setCachedPlants(plants: any[]) {
  if (Array.isArray(plants) && plants.length > 0) {
    cachedPlantsData = plants
  }
}

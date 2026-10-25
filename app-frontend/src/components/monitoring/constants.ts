/** How often the monitoring queries are re-fetched by the UI. */
export const REFRESH_INTERVAL_MS = 30000

/**
 * A reading older than this is flagged "Data tidak terbaru".
 * This is deliberately NOT tied to REFRESH_INTERVAL_MS: polling every 30 s says nothing about how
 * often a physical sensor reports, and a threshold below the sensors' own cadence would mark every
 * sensor stale. Lower it if your devices report more often than every few minutes.
 */
export const STALE_AFTER_MS = 15 * 60 * 1000

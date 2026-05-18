const SESSION_STORAGE_KEY = 'party_game_session_id'

/**
 * Get or create a session ID for the user
 * Session IDs persist across browser sessions to enable auto-rejoin
 * @returns {string} The session ID
 */
export function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY)
  
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    console.log('=== SESSION ID GENERATED ===', { sessionId })
  } else {
    console.log('=== SESSION ID RETRIEVED ===', { sessionId })
  }
  
  return sessionId
}

/**
 * Generate a new session ID using crypto.randomUUID with fallback
 * @returns {string} A unique session ID
 */
function generateSessionId() {
  // Try using crypto.randomUUID first (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback for older browsers
  return generateFallbackUUID()
}

/**
 * Fallback UUID generator for browsers without crypto.randomUUID
 * @returns {string} A UUID v4 formatted string
 */
function generateFallbackUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Clear the session ID from localStorage
 * Used when a room ends or session needs to be reset
 */
export function clearSessionId() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
  console.log('=== SESSION ID CLEARED ===')
}

/**
 * Check if a session ID exists in localStorage
 * @returns {boolean} True if session ID exists
 */
export function hasSessionId() {
  return !!localStorage.getItem(SESSION_STORAGE_KEY)
}

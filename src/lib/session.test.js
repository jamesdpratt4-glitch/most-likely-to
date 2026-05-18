import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSessionId, clearSessionId, hasSessionId } from './session'

describe('Session Utility', () => {
  const STORAGE_KEY = 'party_game_session_id'

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    // Clear localStorage after each test
    localStorage.clear()
  })

  describe('getSessionId', () => {
    it('should generate and store a new session ID when none exists', () => {
      const sessionId = getSessionId()
      
      expect(sessionId).toBeTruthy()
      expect(typeof sessionId).toBe('string')
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) // UUID v4 format
      expect(localStorage.getItem(STORAGE_KEY)).toBe(sessionId)
    })

    it('should return existing session ID when one already exists', () => {
      const existingId = 'existing-session-id-12345'
      localStorage.setItem(STORAGE_KEY, existingId)
      
      const sessionId = getSessionId()
      
      expect(sessionId).toBe(existingId)
    })
  })

  describe('clearSessionId', () => {
    it('should remove session ID from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'test-session-id')
      expect(hasSessionId()).toBe(true)
      
      clearSessionId()
      
      expect(hasSessionId()).toBe(false)
    })

    it('should not throw error when clearing non-existent session', () => {
      expect(() => clearSessionId()).not.toThrow()
    })
  })

  describe('hasSessionId', () => {
    it('should return true when session ID exists', () => {
      localStorage.setItem(STORAGE_KEY, 'test-session-id')
      expect(hasSessionId()).toBe(true)
    })

    it('should return false when session ID does not exist', () => {
      expect(hasSessionId()).toBe(false)
    })

    it('should return false when session ID is empty string', () => {
      localStorage.setItem(STORAGE_KEY, '')
      expect(hasSessionId()).toBe(false)
    })
  })

  describe('Session ID Format', () => {
    it('should generate consistent UUID format', () => {
      const sessionId1 = getSessionId()
      localStorage.clear()
      const sessionId2 = getSessionId()
      
      expect(sessionId1).not.toBe(sessionId2) // Different calls should generate different IDs
      expect(sessionId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(sessionId2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })
})

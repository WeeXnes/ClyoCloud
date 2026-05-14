import { describe, it, expect } from 'vitest'

/**
 * Security Verification Suite
 * This test ensures that the "Deny-by-Default" policy in server/middleware/auth.ts
 * is working correctly for all critical endpoints.
 */

// All endpoints that REQUIRE authentication
const protectedEndpoints = [
  // Core API
  '/api/activity',
  '/api/activity-full',
  '/api/bulk-download',
  '/api/change-password',
  '/api/download',
  '/api/download-stop',
  '/api/favorites',
  '/api/file-meta',
  '/api/files',
  '/api/folder',
  '/api/move',
  '/api/rename',
  '/api/stats',
  '/api/storage-map',
  '/api/tags',
  '/api/upload',
  '/api/user-settings',
  '/api/verify',
  '/api/videos',
  '/api/zip',
  
  // 2FA Management
  '/api/2fa/disable',
  '/api/2fa/enable',
  '/api/2fa/setup',

  // TV Features
  '/api/tv/channels',
  '/api/tv/epg',
  '/api/tv/record',
  '/api/tv/record-cancel',
  '/api/tv/recordings',
  '/tv/stream/channel/123',
  '/tv/icon/test.png',

  // Content Delivery (Raw Routes)
  '/file/test.txt',
  '/files/test-folder', // Verifying plural route protection
  '/stream/test.mp4',
  '/thumbnail/test.png',
  '/media/test.mp4',

  // System/Admin Pages
  '/settings',
  '/logs',
  '/favorites',
  '/shared'
]

// All endpoints that are EXPLICITLY PUBLIC
const publicEndpoints = [
  '/api/login',
  '/api/logout',
  '/api/public/file-info',
  '/api/2fa/verify-login',
  '/login',
  '/favicon.ico',
  '/robots.txt',
  '/clyo.png',
  '/wicon.png',
  // Public Shared Links
  '/p/username/path/to/file',
  '/p/file/username/path/to/file',
  '/p/stream/username/path/to/file',
  '/p/thumbnail/username/path/to/file'
]

describe('Security: Authentication Guard', () => {
  const BASE_URL = 'http://localhost:6969'

  describe('Protected Endpoints (Must return 401 or redirect to login)', () => {
    protectedEndpoints.forEach((endpoint) => {
      it(`blocks unauthorized access to ${endpoint}`, async () => {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 'Accept': 'application/json' }
        })
        
        // Should be 401 (Unauthorized) for JSON requests
        expect(response.status).toBe(401)
      })

      it(`rejects invalid tokens for ${endpoint}`, async () => {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 
            'Accept': 'application/json',
            'Cookie': 'token=invalid.jwt.token' 
          }
        })
        expect(response.status).toBe(401)
      })
    })
  })

  describe('Public Endpoints (Must be accessible)', () => {
    publicEndpoints.forEach((endpoint) => {
      it(`allows public access to ${endpoint}`, async () => {
        const response = await fetch(`${BASE_URL}${endpoint}`)
        // We don't check for 200 because some might return 404 (file not found) 
        // or 400 (bad params), but they MUST NOT return 401
        expect(response.status).not.toBe(401)
      })
    })
  })

  describe('Deny-by-Default Policy', () => {
    it('blocks a completely random/unknown path', async () => {
      const response = await fetch(`${BASE_URL}/some/hidden/admin/path`, {
        headers: { 'Accept': 'application/json' }
      })
      expect(response.status).toBe(401)
    })
  })
})

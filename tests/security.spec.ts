import { describe, it, expect } from 'vitest'

// List of all known endpoints
const endpoints = [
  '/api/2fa/disable', '/api/2fa/enable', '/api/2fa/setup', '/api/activity',
  '/api/activity-full', '/api/bulk-download', '/api/change-password', '/api/download',
  '/api/download-stop', '/api/favorites', '/api/file-meta', '/api/files',
  '/api/folder', '/api/rename', '/api/stats', '/api/tags', '/api/upload',
  '/api/user-settings', '/api/verify', '/api/videos', '/api/zip'
]

const publicEndpoints = [
  '/api/login', '/api/logout', '/api/public/file-info', '/api/2fa/verify-login'
]

describe('API Security Tests', () => {
  describe('Protected Endpoints', () => {
    endpoints.forEach((endpoint) => {
      it(`should return 401 for ${endpoint} without a token`, async () => {
        const response = await fetch(`http://localhost:3000${endpoint}`)
        expect(response.status).toBe(401)
      })

      it(`should return 401 for ${endpoint} with an invalid token`, async () => {
        const response = await fetch(`http://localhost:3000${endpoint}`, {
          headers: { Cookie: 'token=invalid_token_xyz' }
        })
        expect(response.status).toBe(401)
      })
    })
  })

  describe('Public Endpoints', () => {
    publicEndpoints.forEach((endpoint) => {
      it(`should be accessible (not 401) for ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:3000${endpoint}`)
        // Expecting either 2xx or 3xx (as they might redirect)
        expect(response.status).toBeLessThan(400)
        expect(response.status).not.toBe(401)
      })
    })
  })
})

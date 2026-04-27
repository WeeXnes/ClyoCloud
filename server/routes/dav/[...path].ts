import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const webdav = require('webdav-server')
const { v2 } = webdav
import { defineEventHandler, createError } from 'h3'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

// Cache for user file systems to avoid re-creating them every time
const userFSs: Record<string, any> = {}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authHeader = event.node.req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    event.node.res.setHeader('WWW-Authenticate', 'Basic realm="ClyoCloud WebDAV"')
    event.node.res.statusCode = 401
    return 'Unauthorized'
  }

  const base64Auth = authHeader.split(' ')[1]
  const [username, password] = Buffer.from(base64Auth, 'base64').toString().split(':')

  try {
    // Validate user
    const usersData = JSON.parse(fs.readFileSync(config.usersFilePath, 'utf-8'))
    const user = usersData.find((u: any) => u.name === username)

    if (!user || !bcrypt.compareSync(password, user.password)) {
      event.node.res.setHeader('WWW-Authenticate', 'Basic realm="ClyoCloud WebDAV"')
      event.node.res.statusCode = 401
      return 'Unauthorized'
    }

    // User is authenticated
    const userStoragePath = path.join(config.storagePath, username)
    if (!fs.existsSync(userStoragePath)) {
      fs.mkdirSync(userStoragePath, { recursive: true })
    }

    if (!userFSs[username]) {
      userFSs[username] = new webdav.PhysicalFileSystem(userStoragePath)
    }

    const server = new webdav.WebDAVServer()
    server.setFileSystemSync('/', userFSs[username], true)

    // Adjust the request URL
    const originalUrl = event.node.req.url || ''
    // Strip /dav from the beginning
    let newUrl = originalUrl.replace(/^\/dav/, '')
    if (!newUrl.startsWith('/')) newUrl = '/' + newUrl
    event.node.req.url = newUrl

    // Adjust Destination header for MOVE/COPY
    const destination = event.node.req.headers.destination as string
    if (destination) {
      try {
        const url = new URL(destination, `http://${event.node.req.headers.host}`)
        let newDest = url.pathname.replace(/^\/dav/, '')
        if (!newDest.startsWith('/')) newDest = '/' + newDest
        event.node.req.headers.destination = newDest
      } catch (e) {
        let newDest = destination.replace(/^\/dav/, '')
        if (!newDest.startsWith('/')) newDest = '/' + newDest
        event.node.req.headers.destination = newDest
      }
    }

    return new Promise<void>((resolve, reject) => {
      server.executeRequest(event.node.req, event.node.res, (err) => {
        if (err) {
          console.error('WebDAV Error:', err)
          resolve() // Still resolve to let it finish
        } else {
          resolve()
        }
      })
    })
  } catch (err) {
    console.error('WebDAV Auth Error:', err)
    throw createError({ statusCode: 500, statusMessage: 'Internal Server Error' })
  }
})

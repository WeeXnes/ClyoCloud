import os from 'os'
import { applyPathEnv } from './pathEnv'

// Runs before Nitro loads runtimeConfig, which is read from the environment once and then frozen.
// Registered through nitro.unenv.polyfill in nuxt.config.ts.
applyPathEnv(process.env, os.homedir)

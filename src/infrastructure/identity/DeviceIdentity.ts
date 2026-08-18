import { uuidv7 } from 'uuidv7'

const KEY = 'agora:deviceToken'

/**
 * Who this device is. An opaque token, never derived from the name, kept locally and salted with
 * the agora id on the server — so the same phone is a different identity in a different agora.
 */
export const DeviceIdentity = {
  token(): string {
    const stored = localStorage.getItem(KEY)
    if (stored) return stored
    const fresh = uuidv7()
    localStorage.setItem(KEY, fresh)
    return fresh
  },
}

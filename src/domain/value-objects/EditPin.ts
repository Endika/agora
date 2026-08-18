/**
 * Edit-PIN format guard. Hashing and verification happen server-side (agora.pin_hash inside the
 * join_group / recover_participant RPCs, throttled by agora.pin_attempts); neither the plaintext
 * nor the hash ever reaches the client snapshot.
 */
export class EditPin {
  static validateFormat(pin: string): void {
    if (!/^\d{4,6}$/.test(pin)) throw new Error('EditPin: must be 4-6 digits')
  }
}

import type { Sensitivity } from '@/content/types';

/**
 * The client-side encryption boundary. ARCHITECTURE §5, D05.
 *
 * Every write to local storage passes through here, tagged with the
 * sensitivity class the schema declared for it. In v1 the registered
 * implementation is the identity transform: sensitive data simply never leaves
 * the device, which is a promise we can keep absolutely with zero
 * cryptographic risk.
 *
 * In v2 a real cipher registers at this same seam with no call-site changes.
 * That is the entire reason the boundary exists now — adding end-to-end
 * encrypted sync later becomes wiring a cipher into an existing interface,
 * rather than re-tiering a live database that already holds users' medication
 * lists and duress codes.
 */
export interface CipherBoundary {
  readonly id: string;
  encode(value: unknown, sensitivity: Sensitivity): Promise<unknown>;
  decode(stored: unknown, sensitivity: Sensitivity): Promise<unknown>;
  /** Whether data of this class may ever be transmitted off-device. */
  mayTransmit(sensitivity: Sensitivity): boolean;
}

/**
 * v1 implementation.
 *
 * Stores plaintext locally — IndexedDB is already origin-isolated and
 * device-local, and encrypting at rest against a key the same device holds
 * buys very little. What it does enforce is the transmission rule.
 */
export const identityCipher: CipherBoundary = {
  id: 'identity-v1',

  async encode(value) {
    return value;
  },

  async decode(stored) {
    return stored;
  },

  mayTransmit(sensitivity) {
    // v1: nothing syncs at all, but the rule that matters long-term is that
    // `sensitive` never does. Encoding it here means the day sync arrives, the
    // constraint is already load-bearing rather than remembered.
    return sensitivity !== 'sensitive';
  },
};

let active: CipherBoundary = identityCipher;

export function registerCipher(cipher: CipherBoundary): void {
  active = cipher;
}

export function cipher(): CipherBoundary {
  return active;
}

/**
 * Guard for any future sync path. Throws rather than returning false, because
 * a silent skip is how sensitive data eventually gets transmitted by a
 * refactor nobody reviewed closely.
 */
export function assertTransmittable(sensitivity: Sensitivity, what: string): void {
  if (!cipher().mayTransmit(sensitivity)) {
    throw new Error(
      `Refusing to transmit "${what}": sensitivity "${sensitivity}" is local-only (D05).`,
    );
  }
}

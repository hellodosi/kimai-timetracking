/**
 * High-Security AES-256-GCM Local Storage Encryption Service
 * Derives encryption keys using PBKDF2 (100,000 rounds, SHA-256)
 * Uses standard Web Crypto API (SubtleCrypto)
 */

export interface EncryptedContainer {
  v: 1;
  salt: string; // Base64
  iv: string;   // Base64
  ciphertext: string; // Base64
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class EncryptionService {
  private static cachedKey: CryptoKey | null = null;
  private static cachedPin: string | null = null;

  /**
   * Derive AES-GCM-256 key from a PIN/passcode and salt
   */
  private static async deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passcode),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt an arbitrary serializable payload using passcode
   */
  static async encrypt(data: unknown, passcode: string): Promise<string> {
    if (!crypto?.subtle) {
      throw new Error('Web Crypto API ist in diesem Browser nicht verfügbar.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(passcode, salt);

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const container: EncryptedContainer = {
      v: 1,
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      ciphertext: arrayBufferToBase64(ciphertextBuffer),
    };

    return JSON.stringify(container);
  }

  /**
   * Decrypt an encrypted container using passcode
   */
  static async decrypt<T>(containerJson: string, passcode: string): Promise<T> {
    if (!crypto?.subtle) {
      throw new Error('Web Crypto API ist in diesem Browser nicht verfügbar.');
    }

    let container: EncryptedContainer;
    try {
      container = JSON.parse(containerJson);
    } catch {
      throw new Error('Ungültiges Datenformat für verschlüsselte Daten.');
    }

    if (!container.v || !container.salt || !container.iv || !container.ciphertext) {
      throw new Error('Ungültige Verschlüsselungs-Struktur.');
    }

    const salt = new Uint8Array(base64ToArrayBuffer(container.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(container.iv));
    const ciphertext = base64ToArrayBuffer(container.ciphertext);

    const key = await this.deriveKey(passcode, salt);

    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      const jsonStr = dec.decode(decryptedBuffer);
      return JSON.parse(jsonStr) as T;
    } catch {
      throw new Error('Entschlüsselung fehlgeschlagen. PIN / Passwort ist ungültig.');
    }
  }

  /**
   * Store active session PIN in memory for the duration of the tab session
   */
  static setSessionPin(pin: string) {
    this.cachedPin = pin;
    sessionStorage.setItem('kimai_session_unlocked', '1');
  }

  static getSessionPin(): string | null {
    return this.cachedPin;
  }

  static isSessionUnlocked(): boolean {
    return !!this.cachedPin;
  }

  static lockSession() {
    this.cachedPin = null;
    this.cachedKey = null;
    sessionStorage.removeItem('kimai_session_unlocked');
  }
}

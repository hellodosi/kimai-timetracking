import { EncryptionService } from './crypto';
import type { KimaiConfig, ActiveTimer, TimesheetEntry, CachedMetadata } from '../types/kimai';

const STORAGE_KEYS = {
  // If PIN is enabled, VAULT_CHECK holds an encrypted check payload
  VAULT_CHECK: 'kimai_enc_vault_check',
  // Flag indicating if PIN protection is active
  PIN_PROTECTED: 'kimai_pin_protected',
  // Storage keys (can be plain JSON or encrypted depending on whether PIN protection is active)
  CONFIG: 'kimai_config',
  ACTIVE_TIMER: 'kimai_active_timer',
  TIMESHEETS: 'kimai_timesheets',
  METADATA: 'kimai_metadata',
};

export class StorageService {
  /**
   * Check if app is configured with Kimai connection details
   */
  static isConfigured(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.CONFIG);
  }

  /**
   * Check if a security PIN is set
   */
  static isPinSet(): boolean {
    return localStorage.getItem(STORAGE_KEYS.PIN_PROTECTED) === 'true';
  }

  /**
   * Verify whether the entered PIN can unlock the vault
   */
  static async verifyPin(pin: string): Promise<boolean> {
    const checkEnc = localStorage.getItem(STORAGE_KEYS.VAULT_CHECK);
    if (!checkEnc) return true;
    try {
      const result = await EncryptionService.decrypt<{ check: string }>(checkEnc, pin);
      return result?.check === 'KIMAI_VAULT_OK';
    } catch {
      return false;
    }
  }

  /**
   * Initial setup with URL & API Token (no PIN required at login)
   */
  static async initializeConnection(config: KimaiConfig): Promise<void> {
    // Save unencrypted initially
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    localStorage.setItem(STORAGE_KEYS.PIN_PROTECTED, 'false');

    if (!localStorage.getItem(STORAGE_KEYS.TIMESHEETS)) {
      localStorage.setItem(STORAGE_KEYS.TIMESHEETS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.METADATA)) {
      localStorage.setItem(
        STORAGE_KEYS.METADATA,
        JSON.stringify({ customers: [], projects: [], activities: [], lastSyncedAt: null })
      );
    }
  }

  /**
   * Activate PIN encryption on existing data
   */
  static async setPin(newPin: string): Promise<void> {
    const config = await this.getConfig();
    const timer = await this.getActiveTimer();
    const timesheets = await this.getTimesheets();
    const metadata = await this.getMetadata();

    const checkPayload = { check: 'KIMAI_VAULT_OK', timestamp: Date.now() };
    const encCheck = await EncryptionService.encrypt(checkPayload, newPin);

    localStorage.setItem(STORAGE_KEYS.VAULT_CHECK, encCheck);
    localStorage.setItem(STORAGE_KEYS.PIN_PROTECTED, 'true');
    EncryptionService.setSessionPin(newPin);

    if (config) {
      const encConfig = await EncryptionService.encrypt(config, newPin);
      localStorage.setItem(STORAGE_KEYS.CONFIG, encConfig);
    }
    if (timer) {
      const encTimer = await EncryptionService.encrypt(timer, newPin);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMER, encTimer);
    }
    if (timesheets) {
      const encTimesheets = await EncryptionService.encrypt(timesheets, newPin);
      localStorage.setItem(STORAGE_KEYS.TIMESHEETS, encTimesheets);
    }
    if (metadata) {
      const encMeta = await EncryptionService.encrypt(metadata, newPin);
      localStorage.setItem(STORAGE_KEYS.METADATA, encMeta);
    }
  }

  /**
   * Remove PIN protection (revert to local non-PIN storage)
   */
  static async removePin(currentPin: string): Promise<boolean> {
    const isValid = await this.verifyPin(currentPin);
    if (!isValid) return false;

    const config = await this.getConfig(currentPin);
    const timer = await this.getActiveTimer(currentPin);
    const timesheets = await this.getTimesheets(currentPin);
    const metadata = await this.getMetadata(currentPin);

    localStorage.removeItem(STORAGE_KEYS.VAULT_CHECK);
    localStorage.setItem(STORAGE_KEYS.PIN_PROTECTED, 'false');
    EncryptionService.lockSession();

    if (config) localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    if (timer) localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMER, JSON.stringify(timer));
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_TIMER);
    localStorage.setItem(STORAGE_KEYS.TIMESHEETS, JSON.stringify(timesheets || []));
    localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(metadata));

    return true;
  }

  /**
   * Change user PIN and re-encrypt all stored data
   */
  static async changePin(oldPin: string, newPin: string): Promise<boolean> {
    const isValid = await this.verifyPin(oldPin);
    if (!isValid) return false;

    const config = await this.getConfig(oldPin);
    const timer = await this.getActiveTimer(oldPin);
    const timesheets = await this.getTimesheets(oldPin);
    const metadata = await this.getMetadata(oldPin);

    // Save with new PIN
    const checkPayload = { check: 'KIMAI_VAULT_OK', timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEYS.VAULT_CHECK, await EncryptionService.encrypt(checkPayload, newPin));
    localStorage.setItem(STORAGE_KEYS.PIN_PROTECTED, 'true');

    if (config) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, await EncryptionService.encrypt(config, newPin));
    }
    if (timer) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMER, await EncryptionService.encrypt(timer, newPin));
    }
    localStorage.setItem(STORAGE_KEYS.TIMESHEETS, await EncryptionService.encrypt(timesheets, newPin));
    localStorage.setItem(STORAGE_KEYS.METADATA, await EncryptionService.encrypt(metadata, newPin));

    EncryptionService.setSessionPin(newPin);
    return true;
  }

  /**
   * Helper to deserialize string data: tries JSON parse, or decrypt if PIN protected
   */
  private static async readItem<T>(key: string, pin?: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const isProtected = this.isPinSet();

    if (!isProtected) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }

    // PIN protected
    const activePin = pin || EncryptionService.getSessionPin();
    if (!activePin) return null; // App locked

    try {
      return await EncryptionService.decrypt<T>(raw, activePin);
    } catch {
      // Fallback if item was stored as plain json
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
  }

  /**
   * Helper to write item: either plain JSON or encrypted
   */
  private static async writeItem(key: string, data: unknown, pin?: string): Promise<void> {
    const isProtected = this.isPinSet();
    if (!isProtected) {
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }

    const activePin = pin || EncryptionService.getSessionPin();
    if (!activePin) {
      throw new Error('PIN-geschützt: Bitte App entsperren.');
    }

    const encrypted = await EncryptionService.encrypt(data, activePin);
    localStorage.setItem(key, encrypted);
  }

  /**
   * Load Kimai Config
   */
  static async getConfig(pin?: string): Promise<KimaiConfig | null> {
    return this.readItem<KimaiConfig>(STORAGE_KEYS.CONFIG, pin);
  }

  /**
   * Save Kimai Config
   */
  static async saveConfig(config: KimaiConfig, pin?: string): Promise<void> {
    await this.writeItem(STORAGE_KEYS.CONFIG, config, pin);
  }

  /**
   * Load Active Timer
   */
  static async getActiveTimer(pin?: string): Promise<ActiveTimer | null> {
    return this.readItem<ActiveTimer>(STORAGE_KEYS.ACTIVE_TIMER, pin);
  }

  /**
   * Save Active Timer (or remove if null)
   */
  static async saveActiveTimer(timer: ActiveTimer | null, pin?: string): Promise<void> {
    if (!timer) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TIMER);
      return;
    }
    await this.writeItem(STORAGE_KEYS.ACTIVE_TIMER, timer, pin);
  }

  /**
   * Load Timesheet Entries
   */
  static async getTimesheets(pin?: string): Promise<TimesheetEntry[]> {
    const items = await this.readItem<TimesheetEntry[]>(STORAGE_KEYS.TIMESHEETS, pin);
    return items || [];
  }

  /**
   * Save Timesheet Entries
   */
  static async saveTimesheets(entries: TimesheetEntry[], pin?: string): Promise<void> {
    await this.writeItem(STORAGE_KEYS.TIMESHEETS, entries, pin);
  }

  /**
   * Load Cached Metadata
   */
  static async getMetadata(pin?: string): Promise<CachedMetadata> {
    const defaultMeta: CachedMetadata = { customers: [], projects: [], activities: [], lastSyncedAt: null };
    const meta = await this.readItem<CachedMetadata>(STORAGE_KEYS.METADATA, pin);
    return meta || defaultMeta;
  }

  /**
   * Save Cached Metadata
   */
  static async saveMetadata(metadata: CachedMetadata, pin?: string): Promise<void> {
    await this.writeItem(STORAGE_KEYS.METADATA, metadata, pin);
  }

  /**
   * Clears only offline captured timesheets (pending or failed sync) and active timer.
   * Retains configuration, PIN encryption, and cached metadata.
   */
  static async clearOfflineTimesheets(pin?: string): Promise<number> {
    const timesheets = await this.getTimesheets(pin);
    const syncedOnly = timesheets.filter((t) => t.syncStatus === 'synced');
    const removedCount = timesheets.length - syncedOnly.length;
    await this.saveTimesheets(syncedOnly, pin);
    await this.saveActiveTimer(null, pin);
    return removedCount;
  }

  /**
   * Complete reset of all local data (factory reset)
   */
  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.VAULT_CHECK);
    localStorage.removeItem(STORAGE_KEYS.PIN_PROTECTED);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TIMER);
    localStorage.removeItem(STORAGE_KEYS.TIMESHEETS);
    localStorage.removeItem(STORAGE_KEYS.METADATA);
    EncryptionService.lockSession();
  }
}

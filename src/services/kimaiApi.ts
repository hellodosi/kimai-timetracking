import type { KimaiConfig, Customer, Project, Activity, TimesheetEntry, ServerStatus } from '../types/kimai';

/**
 * Format a Date or date string to Kimai's expected local ISO format:
 * YYYY-MM-DDTHH:mm:ss (no milliseconds, no timezone offset, local time)
 */
export function formatKimaiDateTime(dateInput: Date | string | number): string {
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateInput)) {
    return dateInput;
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Extracts detailed human-readable validation error messages from Kimai / Symfony responses
 */
function extractDetailedErrorMessage(errorJson: unknown, defaultMsg: string): string {
  if (!errorJson || typeof errorJson !== 'object') return defaultMsg;
  const obj = errorJson as Record<string, unknown>;
  const collected: string[] = [];

  function traverse(node: unknown, path: string[] = []) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string') {
          const prefix = path.length > 0 ? `[${path.join('.')}] ` : '';
          collected.push(`${prefix}${item}`);
        } else {
          traverse(item, path);
        }
      }
      return;
    }
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.errors)) {
      for (const err of rec.errors) {
        if (typeof err === 'string') {
          const prefix = path.length > 0 ? `[${path.join('.')}] ` : '';
          collected.push(`${prefix}${err}`);
        }
      }
    }
    if (rec.children && typeof rec.children === 'object') {
      for (const [key, child] of Object.entries(rec.children as Record<string, unknown>)) {
        traverse(child, [...path, key]);
      }
    }
  }

  if (obj.errors) {
    traverse(obj.errors);
  }

  if (collected.length > 0) {
    const baseMessage = typeof obj.message === 'string' && obj.message ? obj.message : defaultMsg;
    return `${baseMessage}: ${collected.join(', ')}`;
  }

  if (typeof obj.message === 'string' && obj.message) {
    return obj.message;
  }

  return defaultMsg;
}

export class KimaiApiService {
  private static cleanUrl(url: string): string {
    let clean = url.trim().replace(/\/+$/, '');
    // If user mistakenly appended /api or /api/ping
    if (clean.endsWith('/api')) {
      clean = clean.slice(0, -4);
    }
    return clean;
  }

  private static getHeaders(config: KimaiConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiToken.trim()}`,
      'X-AUTH-TOKEN': config.apiToken.trim(),
    };
    if (config.username && config.username.trim()) {
      headers['X-AUTH-USER'] = config.username.trim();
    }
    return headers;
  }

  /**
   * Ping Kimai API to test if server is currently reachable
   */
  static async ping(config: KimaiConfig, timeoutMs = 4000): Promise<ServerStatus> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/ping`, {
        method: 'GET',
        headers: this.getHeaders(config),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Try getting version if available
        let kimaiVersion: string | undefined;
        try {
          const verRes = await fetch(`${baseUrl}/api/version`, {
            method: 'GET',
            headers: this.getHeaders(config),
            signal: AbortSignal.timeout(2000),
          });
          if (verRes.ok) {
            const verData = await verRes.json();
            kimaiVersion = verData.version || verData.semver;
          }
        } catch {
          // ignore version failure if ping was ok
        }

        return {
          isReachable: true,
          checking: false,
          lastChecked: Date.now(),
          kimaiVersion,
        };
      }

      // If unauthorized, return reachable but not authorized
      if (response.status === 401 || response.status === 403) {
        return {
          isReachable: false,
          checking: false,
          lastChecked: Date.now(),
          errorMessage: 'Server erreichbar, aber API-Token nicht autorisiert (HTTP 401/403).',
        };
      }

      return {
        isReachable: false,
        checking: false,
        lastChecked: Date.now(),
        errorMessage: `Server antwortete mit Status ${response.status}`,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        isReachable: false,
        checking: false,
        lastChecked: Date.now(),
        errorMessage: isAbort ? 'Zeitüberschreitung (Timeout)' : 'Verbindung fehlgeschlagen (Offline)',
      };
    }
  }

  /**
   * Fetch all visible Customers
   */
  static async fetchCustomers(config: KimaiConfig): Promise<Customer[]> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/customers?visible=1`, {
      headers: this.getHeaders(config),
    });
    if (!res.ok) throw new Error(`Fehler beim Laden der Kunden (HTTP ${res.status})`);
    return await res.json();
  }

  /**
   * Fetch all visible Projects
   */
  static async fetchProjects(config: KimaiConfig): Promise<Project[]> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/projects?visible=1`, {
      headers: this.getHeaders(config),
    });
    if (!res.ok) throw new Error(`Fehler beim Laden der Projekte (HTTP ${res.status})`);
    return await res.json();
  }

  /**
   * Fetch all visible Activities
   */
  static async fetchActivities(config: KimaiConfig): Promise<Activity[]> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/activities?visible=1`, {
      headers: this.getHeaders(config),
    });
    if (!res.ok) throw new Error(`Fehler beim Laden der Aufgaben (HTTP ${res.status})`);
    return await res.json();
  }

  /**
   * Start a real-time timesheet on Kimai server
   */
  static async startTimesheet(
    config: KimaiConfig,
    entry: {
      begin: string;
      project: number;
      activity: number;
      description?: string;
      tags?: string[];
      billable?: boolean;
    }
  ): Promise<{ id: number }> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const formattedBegin = formatKimaiDateTime(entry.begin);
    const payload: Record<string, unknown> = {
      begin: formattedBegin,
      project: Number(entry.project),
      activity: Number(entry.activity),
      description: entry.description || '',
      billable: entry.billable ?? true,
    };
    if (entry.tags && entry.tags.length > 0) {
      payload.tags = Array.isArray(entry.tags) ? entry.tags.join(',') : String(entry.tags);
    }

    const res = await fetch(`${baseUrl}/api/timesheets`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = extractDetailedErrorMessage(errorJson, `HTTP ${res.status}`);
      } catch {
        const errBody = await res.text().catch(() => '');
        if (errBody) errMsg += ` ${errBody.slice(0, 150)}`;
      }
      throw new Error(`Fehler beim Starten auf Kimai: ${errMsg}`);
    }

    const data = await res.json();
    return { id: data.id };
  }

  /**
   * Fetch currently active timesheets running on the Kimai server
   */
  static async fetchActiveTimesheets(config: KimaiConfig): Promise<any[]> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/timesheets/active`, {
      method: 'GET',
      headers: this.getHeaders(config),
    });
    if (!res.ok) {
      throw new Error(`Fehler beim Abrufen aktiver Timer (HTTP ${res.status})`);
    }
    return await res.json();
  }

  /**
   * Stop an active timesheet on Kimai server
   */
  static async stopTimesheet(config: KimaiConfig, remoteId: number): Promise<any> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/timesheets/${remoteId}/stop`, {
      method: 'PATCH',
      headers: this.getHeaders(config),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = extractDetailedErrorMessage(errorJson, `HTTP ${res.status}`);
      } catch {
        // use default
      }
      throw new Error(`Fehler beim Stoppen auf Kimai: ${errMsg}`);
    }

    return await res.json();
  }

  /**
   * Post a completed timesheet record (used during offline sync)
   */
  static async postCompletedTimesheet(
    config: KimaiConfig,
    entry: TimesheetEntry
  ): Promise<{ id: number; adjustedEnd?: string }> {
    const baseUrl = this.cleanUrl(config.baseUrl);

    let startDate = new Date(entry.begin);
    let endDate = entry.end ? new Date(entry.end) : new Date();

    if (isNaN(startDate.getTime())) startDate = new Date();
    if (isNaN(endDate.getTime())) endDate = new Date(startDate.getTime() + 60000);

    // Kimai validation rule:
    // 1. end must be strictly greater than begin
    // 2. Timesheets cannot have a duration of 0 seconds.
    // If end is <= begin (e.g. stopped right away or entered with same start/end),
    // automatically advance end by at least 1 minute (60 seconds) so Kimai accepts it.
    let adjustedEnd: string | undefined;
    if (endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 60 * 1000);
      adjustedEnd = formatKimaiDateTime(endDate);
    }

    const formattedBegin = formatKimaiDateTime(startDate);
    const formattedEnd = formatKimaiDateTime(endDate);

    const payload: Record<string, unknown> = {
      begin: formattedBegin,
      end: formattedEnd,
      project: Number(entry.projectId),
      activity: Number(entry.activityId),
      description: entry.description || '',
      billable: Boolean(entry.billable ?? true),
    };
    if (entry.tags && entry.tags.length > 0) {
      payload.tags = Array.isArray(entry.tags) ? entry.tags.join(',') : String(entry.tags);
    }

    const res = await fetch(`${baseUrl}/api/timesheets`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = extractDetailedErrorMessage(errorJson, `HTTP ${res.status}`);
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errMsg += ` ${text.slice(0, 150)}`;
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    return { id: data.id, adjustedEnd };
  }
}

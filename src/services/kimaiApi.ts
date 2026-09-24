import type { KimaiConfig, Customer, Project, Activity, TimesheetEntry, ServerStatus } from '../types/kimai';

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
      } else {
        const errorText = response.status === 403 || response.status === 401 
          ? 'Zugriff nicht autorisiert (API-Token ungültig)' 
          : `Server antwortete mit HTTP ${response.status}`;

        return {
          isReachable: false,
          checking: false,
          lastChecked: Date.now(),
          errorMessage: errorText,
        };
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as Error)?.name === 'AbortError';
      const msg = isAbort
        ? 'Zeitüberschreitung (Server antwortet nicht)'
        : 'Server derzeit nicht erreichbar (Offline-Modus aktiv)';
      
      return {
        isReachable: false,
        checking: false,
        lastChecked: Date.now(),
        errorMessage: msg,
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
    const payload: Record<string, unknown> = {
      begin: entry.begin,
      project: entry.project,
      activity: entry.activity,
      description: entry.description || '',
      billable: entry.billable ?? true,
    };
    if (entry.tags && entry.tags.length > 0) {
      payload.tags = entry.tags.join(',');
    }

    const res = await fetch(`${baseUrl}/api/timesheets`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Fehler beim Starten auf Kimai: HTTP ${res.status} ${errBody}`);
    }

    const data = await res.json();
    return { id: data.id };
  }

  /**
   * Stop an active timesheet on Kimai server
   */
  static async stopTimesheet(config: KimaiConfig, remoteId: number): Promise<void> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/api/timesheets/${remoteId}/stop`, {
      method: 'PATCH',
      headers: this.getHeaders(config),
    });

    if (!res.ok) {
      throw new Error(`Fehler beim Stoppen auf Kimai (HTTP ${res.status})`);
    }
  }

  /**
   * Post a completed timesheet record (used during offline sync)
   */
  static async postCompletedTimesheet(
    config: KimaiConfig,
    entry: TimesheetEntry
  ): Promise<{ id: number }> {
    const baseUrl = this.cleanUrl(config.baseUrl);
    const payload: Record<string, unknown> = {
      begin: entry.begin,
      end: entry.end || new Date().toISOString().replace('Z', ''),
      project: entry.projectId,
      activity: entry.activityId,
      description: entry.description || '',
      billable: entry.billable ?? true,
    };
    if (entry.tags && entry.tags.length > 0) {
      payload.tags = entry.tags.join(',');
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
        if (errorJson.message) errMsg = errorJson.message;
      } catch {
        // use status
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    return { id: data.id };
  }
}

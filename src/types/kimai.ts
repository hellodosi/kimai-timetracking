export interface KimaiConfig {
  baseUrl: string;
  apiToken: string;
  username?: string;
  useProxy?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  visible: boolean;
  color?: string;
  comment?: string;
}

export interface Project {
  id: number;
  name: string;
  customer: number | Customer;
  visible: boolean;
  color?: string;
  comment?: string;
  parentTitle?: string;
}

export interface Activity {
  id: number;
  name: string;
  project?: number | null;
  visible: boolean;
  color?: string;
  comment?: string;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export interface TimesheetEntry {
  localId: string;
  remoteId?: number;
  begin: string; // ISO string e.g. 2026-09-24T08:30:00
  end?: string | null; // ISO string or null if currently active
  projectId: number;
  projectName: string;
  customerName?: string;
  activityId: number;
  activityName: string;
  description?: string;
  tags?: string[];
  billable?: boolean;
  syncStatus: SyncStatus;
  syncError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveTimer {
  localId: string;
  remoteId?: number;
  begin: string;
  projectId: number;
  projectName: string;
  customerName?: string;
  activityId: number;
  activityName: string;
  description: string;
  tags: string[];
  billable: boolean;
  isRunning: boolean;
}

export interface CachedMetadata {
  customers: Customer[];
  projects: Project[];
  activities: Activity[];
  lastSyncedAt: number | null;
}

export interface ServerStatus {
  isReachable: boolean;
  checking: boolean;
  lastChecked: number | null;
  kimaiVersion?: string;
  errorMessage?: string;
}

export interface QRConfigPayload {
  url?: string;
  baseUrl?: string;
  user?: string;
  username?: string;
  token?: string;
  apiToken?: string;
}

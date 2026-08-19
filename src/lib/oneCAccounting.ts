import { apiGet, apiPost } from '@/lib/api';

export interface OneCUnmatchedRecord {
  externalId: string;
  kind: 'invoice' | 'avr' | 'esf' | 'payment';
  number: string;
  date: string;
  amount: number;
  currency: string;
  contractNumber: string;
  organizationName: string;
  counterpartyName: string;
  reason: 'missing_contract' | 'contract_not_found' | 'ambiguous_contract' | string;
  candidates?: string[];
}

export interface OneCSyncStatus {
  configured: boolean;
  pullEnabled: boolean;
  pushEnabled: boolean;
  mode: 'pull_and_push' | 'pull' | 'push' | 'disabled';
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string;
  source: string;
  received: number;
  matched: number;
  unmatchedCount: number;
  unmatchedSummary: Record<string, number>;
  updatedProjects: number;
  unmatched: OneCUnmatchedRecord[];
  history: Array<{
    at: string;
    source: string;
    received: number;
    matched: number;
    unmatched: number;
    updatedProjects: number;
  }>;
}

interface OneCSyncResponse {
  success: boolean;
  status: OneCSyncStatus;
  integrationKey?: string;
}

export async function getOneCSyncStatus(): Promise<OneCSyncStatus> {
  const response = await apiGet<OneCSyncResponse>('/api/1c/sync');
  if (response.error || !response.data?.status) {
    throw new Error(response.error || 'Не удалось получить состояние обмена с 1С');
  }
  return response.data.status;
}

export async function pullOneCAccounting(): Promise<OneCSyncStatus> {
  const response = await apiPost<OneCSyncResponse>('/api/1c/sync', { action: 'pull' });
  if (response.error || !response.data?.status) {
    throw new Error(response.error || 'Не удалось синхронизировать данные с 1С');
  }
  return response.data.status;
}

export async function createOneCIntegrationKey(): Promise<{ status: OneCSyncStatus; integrationKey: string }> {
  const response = await apiPost<OneCSyncResponse>('/api/1c/sync', { action: 'rotate_key' });
  if (response.error || !response.data?.status || !response.data.integrationKey) {
    throw new Error(response.error || 'Не удалось создать ключ обмена с 1С');
  }
  return { status: response.data.status, integrationKey: response.data.integrationKey };
}

export const ONEC_UNMATCHED_REASON_LABELS: Record<string, string> = {
  missing_contract: 'В записи 1С не указан договор',
  contract_not_found: 'Договор не найден в проектах HUB',
  ambiguous_contract: 'Одинаковый номер договора найден в нескольких проектах',
};

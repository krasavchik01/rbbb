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
  lastErrorCode?: 'schema_not_ready' | 'sync_busy' | 'pull_not_configured' | 'sync_failed' | string;
  source: string;
  rawReceived?: number;
  received: number;
  accepted?: number;
  rejectedCount?: number;
  rejectedReasons?: Record<string, number>;
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
  latestRun?: {
    source: string;
    runId: string;
    batchCount: number;
    expectedBatchCount: number;
    rawReceived: number;
    accepted: number;
    rejectedCount: number;
    rejectedReasons: Record<string, number>;
    matched: number;
    unmatchedCount: number;
    unmatchedSummary: Record<string, number>;
    updatedProjects: number;
    status: 'processing' | 'skipped' | 'success' | 'error';
    startedAt: string | null;
    completedAt: string | null;
    complete: boolean;
  } | null;
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
  contract_identity_mismatch: 'Номер договора совпал, но компания или клиент отличаются',
  ambiguous_contract: 'Одинаковый номер договора найден в нескольких проектах',
  ambiguous_existing_record: 'Одна запись 1С обнаружена сразу в нескольких проектах',
};

export const ONEC_REJECTED_REASON_LABELS: Record<string, string> = {
  invalid_shape: 'Повреждённая строка',
  unsupported_kind: 'Неизвестный вид документа',
  missing_identity: 'Нет номера или ID документа',
  invalid_date: 'Некорректная дата',
  non_positive_amount: 'Нулевая или отрицательная сумма',
  payload_limit: 'Превышен размер пакета',
  invalid_record: 'Некорректные обязательные поля',
};

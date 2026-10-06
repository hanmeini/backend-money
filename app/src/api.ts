import { API_BASE_URL } from './config';

export type TxType = 'INCOME' | 'EXPENSE';
export type TxSource = 'CASH' | 'OVO' | 'GOPAY' | 'DANA' | 'SHOPEEPAY' | 'OTHER';

export interface Transaction {
  id: number;
  type: TxType;
  source: TxSource;
  amount: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface Dashboard {
  periode: string;
  sisaUangAman: number;
  totalMasuk: number;
  totalKeluar: number;
  sisaHari: number;
  amanPerHari: number;
  transaksiTerakhir: Transaction[];
}

export interface SmsPayload {
  pengirim: string;
  teks: string;
  timestamp: number | string;
}

async function request<T>(path: string, deviceId: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error ?? `Request gagal (${res.status})`);
  }
  return body;
}

export function ingestSms(deviceId: string, payload: SmsPayload) {
  return request<{ status: string; logId: number }>(`/api/v1/sms/ingest`, deviceId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getDashboard(deviceId: string, month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return request<Dashboard>(`/api/v1/dashboard${query}`, deviceId);
}

export interface TransactionFilters {
  month?: string;
  source?: TxSource;
  type?: TxType;
  limit?: number;
  offset?: number;
}

export function getTransactions(deviceId: string, filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  if (filters.source) params.set('source', filters.source);
  if (filters.type) params.set('type', filters.type);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<{ total: number; items: Transaction[] }>(`/api/v1/transactions${query}`, deviceId);
}

export interface NewTransaction {
  amount: number;
  type: TxType;
  source: TxSource;
  note?: string;
}

export function createTransaction(deviceId: string, tx: NewTransaction) {
  return request<{ transaction: Transaction }>(`/api/v1/transactions`, deviceId, {
    method: 'POST',
    body: JSON.stringify(tx),
  });
}

export function updateTransaction(deviceId: string, id: number, tx: Partial<NewTransaction>) {
  return request<{ transaction: Transaction }>(`/api/v1/transactions/${id}`, deviceId, {
    method: 'PUT',
    body: JSON.stringify(tx),
  });
}

export function deleteTransaction(deviceId: string, id: number) {
  return request<{ deleted: boolean; id: number }>(`/api/v1/transactions/${id}`, deviceId, {
    method: 'DELETE',
  });
}

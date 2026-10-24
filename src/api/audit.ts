import { apiClient, unwrapApiEnvelope } from './client';
import { ValueCreationLog, AuditStatus, MiningResource, QuotaSnapshot } from '../../types';

export interface AuditResponse {
  log: ValueCreationLog;
  resource: MiningResource;
  snapshot: QuotaSnapshot;
  linkedLogs?: ValueCreationLog[];
  recalibratedLogs?: ValueCreationLog[];
}

export const putAuditLog = async (
  logId: string,
  status: AuditStatus,
  extras?: { verifiedAmount?: number; auditNotes?: string } | number,
): Promise<AuditResponse> => {
  const body: Record<string, unknown> = { logId, status };
  const opts = typeof extras === 'number' ? { verifiedAmount: extras } : extras;
  if (opts?.verifiedAmount != null && Number.isFinite(opts.verifiedAmount)) {
    body.verifiedAmount = Math.round(opts.verifiedAmount);
  }
  if (typeof opts?.auditNotes === 'string' && opts.auditNotes.trim()) {
    body.auditNotes = opts.auditNotes.trim();
  }
  const raw = await apiClient.put<any>('/api/audit', body);
  return unwrapApiEnvelope<AuditResponse>(raw);
};

export const auditLog = putAuditLog;

export interface BankStatementVerificationResult {
  success: boolean;
  summary: {
    total: number;
    matchedCount: number;
    conflictCount: number;
    exceptionCount: number;
  };
  matched: Array<{
    statementItem: { id: string; payeeName: string; amount: number; transactionTime: string; transactionId: string };
    matchedLog: ValueCreationLog;
  }>;
  conflicts: Array<{
    statementItem: { id: string; payeeName: string; amount: number; transactionTime: string; transactionId: string };
    candidates: ValueCreationLog[];
  }>;
  exceptions: Array<{
    statementItem: { id: string; payeeName: string; amount: number; transactionTime: string; transactionId: string };
    reason: string;
  }>;
}

export const verifyBankStatement = async (fileData?: string, filename?: string): Promise<BankStatementVerificationResult> => {
  const raw = await apiClient.post<any>('/api/audit/verify-statement', { fileData, filename });
  return unwrapApiEnvelope<BankStatementVerificationResult>(raw);
};

export const confirmStatementConflicts = async (confirmations: Array<{ logId: string; transactionId?: string }>): Promise<{ success: boolean; updatedCount: number }> => {
  const raw = await apiClient.post<any>('/api/audit/confirm-conflicts', { confirmations });
  return unwrapApiEnvelope<any>(raw);
};


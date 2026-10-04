import { AuditStatus, ProjectStatus, RefineType, ValueCreationLog, User } from '../../types';
import { UI_LABELS } from '../constants/uiLabels';
import { PROJECT_STATUS_LABELS, REFINE_TYPE_LABELS } from '../constants/terminology';

export function formatAuditStatusLabel(status: AuditStatus): string {
  switch (status) {
    case AuditStatus.Pending:
      return UI_LABELS.PENDING;
    case AuditStatus.Confirmed:
      return UI_LABELS.CONFIRMED;
    case AuditStatus.Approved:
      return UI_LABELS.APPROVED;
    case AuditStatus.Rejected:
      return UI_LABELS.REJECTED;
    default:
      return status;
  }
}

export function formatProjectStatusLabel(status: ProjectStatus | string): string {
  return PROJECT_STATUS_LABELS[status] || status;
}

/**
 * 提炼类型中文映射 (附录 F-4 / D′-0)
 */
export function formatRefineTypeLabel(type: RefineType | string): string {
  const str = String(type);
  return REFINE_TYPE_LABELS[str] || type;
}

/**
 * 术语统一显示辅助函数 (附录 F-5)
 */
export function labelLogOperator(log: ValueCreationLog, users?: User[]): string {
  if (users && users.length > 0) {
    const u = users.find(user => user.id === log.rankId || user.userId === log.rankId);
    if (u) return u.name || u.userId || log.rankId;
  }
  return log.rankId || '未知主体';
}

export function labelBusinessUnit(center?: string | null): string {
  if (!center || center.trim() === '') return '—';
  return center.trim();
}

/**
 * 价值创造记录表经营单元取数 (SSOT: 附录 D.6.8)
 * 经营单元：矿山分配时已确定，直接读矿山分轨指派。业务上不会空。
 * - category=产值 → resources.find(miningId).assignedToValue || assignedTo
 * - category=收款 → resources.find(miningId).assignedToRevenue || assignedTo
 */
export function labelLogBusinessUnitFromMine(
  log: ValueCreationLog | undefined | null,
  resources: any[] = []
): string {
  if (!log) return '—';
  const resource = resources.find(r => r && r.id === log.miningId);
  if (!resource) return '—';
  const rawUnit = log.category === '收款'
    ? (resource.assignedToRevenue || resource.assignedTo)
    : (resource.assignedToValue || resource.assignedTo);
  return rawUnit && String(rawUnit).trim() !== '' ? String(rawUnit).trim() : '—';
}

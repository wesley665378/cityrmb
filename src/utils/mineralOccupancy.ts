import { ValueCreationLog, MiningResource, AuditStatus, RefineCategory } from '../types';
import { roundMoney } from './formatMoney';
import { isCreationCategoryLog, isDynamicCostLog } from './costCategory';
import { getInitialRevenueCapacity, getInitialValueCapacity } from './miningCapacity';

export interface RawInputOccupancyData {
  pending: number;
  confirmed: number;
  mined: number;
  totalOccupancy: number; // pending + confirmed + mined
}

export interface RawInputMineralOccupancy {
  revenue: RawInputOccupancyData;
  value: RawInputOccupancyData;
  maxAllowedRevenue: number; // 款初 - totalOccupancy
  maxAllowedValue: number;   // 产初 - totalOccupancy
}

/**
 * 判断单条流水是否属于创造端正常提炼流水（非动态消耗）
 */
function isCreationMiningLog(log?: ValueCreationLog | null): boolean {
  if (!log) return false;
  if (!isCreationCategoryLog(log)) return false;
  if (isDynamicCostLog(log)) return false;
  return true;
}

function isConfirmedStatus(status: any): boolean {
  return status === AuditStatus.Confirmed || status === '已确权' || status === 'Confirmed' || status === 'confirmed';
}

function isApprovedStatus(status: any): boolean {
  return status === AuditStatus.Approved || status === '入库' || status === 'Approved' || status === 'approved';
}

function isPendingStatus(status: any): boolean {
  return status === AuditStatus.Pending || status === '待确权' || status === 'Pending' || status === 'pending';
}

/**
 * 获取单条流水的输入数 (rawAmount，无则 amount) 并 roundMoney 整数
 */
export function getLogRawInputAmount(log: ValueCreationLog): number {
  const val = log.rawAmount !== undefined && log.rawAmount !== null ? Number(log.rawAmount) : Number(log.amount || 0);
  return roundMoney(val);
}

/**
 * 按流水输入数 (rawAmount，无则 amount) 计算占用量
 * 仅供 ProgressBar 进度条分子 与 最高可提炼量 (含超额提示核算) 调用
 */
export function calculateRawInputMineralOccupancy(
  resource: MiningResource | undefined | null,
  logs: ValueCreationLog[]
): RawInputMineralOccupancy {
  if (!resource) {
    return {
      revenue: { pending: 0, confirmed: 0, mined: 0, totalOccupancy: 0 },
      value: { pending: 0, confirmed: 0, mined: 0, totalOccupancy: 0 },
      maxAllowedRevenue: 0,
      maxAllowedValue: 0
    };
  }

  const relevantLogs = (logs || []).filter(l => l && l.miningId === resource.id && isCreationMiningLog(l));

  // 收款轨
  const revLogs = relevantLogs.filter(l => {
    const cat = l.category as string;
    return cat === RefineCategory.Revenue || cat === '收款' || cat === 'Revenue' || cat === 'revenue';
  });
  const pendingRevenue = revLogs.filter(l => isPendingStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const confirmedRevenue = revLogs.filter(l => isConfirmedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const minedRevenue = revLogs.filter(l => isApprovedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const totalOccupancyRevenue = pendingRevenue + confirmedRevenue + minedRevenue;

  // 产值轨
  const valLogs = relevantLogs.filter(l => {
    const cat = l.category as string;
    return cat === RefineCategory.Value || cat === '产值' || cat === 'Value' || cat === 'value';
  });
  const pendingValue = valLogs.filter(l => isPendingStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const confirmedValue = valLogs.filter(l => isConfirmedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const minedValue = valLogs.filter(l => isApprovedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const totalOccupancyValue = pendingValue + confirmedValue + minedValue;

  const initialRevCap = roundMoney(getInitialRevenueCapacity(resource));
  const initialValCap = roundMoney(getInitialValueCapacity(resource));

  const maxAllowedRevenue = Math.max(0, initialRevCap - totalOccupancyRevenue);
  const maxAllowedValue = Math.max(0, initialValCap - totalOccupancyValue);

  return {
    revenue: {
      pending: pendingRevenue,
      confirmed: confirmedRevenue,
      mined: minedRevenue,
      totalOccupancy: totalOccupancyRevenue
    },
    value: {
      pending: pendingValue,
      confirmed: confirmedValue,
      mined: minedValue,
      totalOccupancy: totalOccupancyValue
    },
    maxAllowedRevenue,
    maxAllowedValue
  };
}

import { ValueCreationLog, MiningResource, AuditStatus, RefineCategory } from '../types';
import { roundMoney } from './formatMoney';
import { isCreationCategoryLog, isDynamicCostLog } from './costCategory';
import { getInitialRevenueCapacity, getInitialValueCapacity } from './miningCapacity';

export interface RawInputOccupancyData {
  pending: number;
  confirmed: number;
  mined: number;
  totalOccupancy: number; // pending + confirmed + mined (输入合计)
}

export interface RawInputMineralOccupancy {
  initialRevenue: number; // 款初
  initialValue: number;   // 产初
  revenue: RawInputOccupancyData;
  value: RawInputOccupancyData;
  maxAllowedRevenue: number; // max(0, 款初 - 已确(输入) - 待确(输入) - 入库(输入))
  maxAllowedValue: number;   // max(0, 产初 - 已确(输入) - 待确(输入) - 入库(输入))
}

/**
 * 从 resource 还原门禁用款初（与矿山下达一致，如存库 27990 还原为款初 30000）
 */
export function getGateInitialRevenue(resource?: MiningResource | null): number {
  if (!resource) return 0;
  const storedRev = getInitialRevenueCapacity(resource);
  if (!storedRev || storedRev <= 0) return 0;
  return roundMoney(storedRev / 0.933);
}

/**
 * 从 resource 还原门禁用产初（与矿山下达一致，兼容未乘 0.933 的存量记录）
 */
export function getGateInitialValue(resource?: MiningResource | null): number {
  if (!resource) return 0;
  const storedRev = getInitialRevenueCapacity(resource);
  const storedVal = getInitialValueCapacity(resource);
  if (!storedVal || storedVal <= 0) return 0;
  const isLegacyUnscaledVal =
    storedRev > 0 &&
    (Math.abs(storedVal - Math.round(storedRev / 0.933)) <= 3 ||
      (storedVal > storedRev && Math.abs(Math.round(storedVal * 0.933) - storedRev) <= 3));
  return isLegacyUnscaledVal ? roundMoney(storedVal) : roundMoney(storedVal / 0.933);
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
 * 获取单条流水的输入 (rawAmount) 并逐笔 round
 */
export function getLogRawInputAmount(log: ValueCreationLog): number {
  if (log.rawAmount !== undefined && log.rawAmount !== null) {
    return roundMoney(Number(log.rawAmount));
  }
  const cat = log.category as string;
  const isRev = cat === RefineCategory.Revenue || cat === '收款' || cat === 'Revenue' || cat === 'revenue';
  if (isRev && log.amount) {
    return roundMoney(Number(log.amount) / 0.933);
  }
  return roundMoney(Number(log.amount || 0));
}

/**
 * 按流水输入 (rawAmount) 计算占用量与最高可提炼量
 * - 收款：max(0, 本矿款初 - 已确(输入) - 待确(输入) - 入库(输入))
 * - 产值：max(0, 本矿产初 - 已确(输入) - 待确(输入) - 入库(输入))
 */
export function calculateRawInputMineralOccupancy(
  resource: MiningResource | undefined | null,
  logs: ValueCreationLog[]
): RawInputMineralOccupancy {
  if (!resource) {
    return {
      initialRevenue: 0,
      initialValue: 0,
      revenue: { pending: 0, confirmed: 0, mined: 0, totalOccupancy: 0 },
      value: { pending: 0, confirmed: 0, mined: 0, totalOccupancy: 0 },
      maxAllowedRevenue: 0,
      maxAllowedValue: 0
    };
  }

  const relevantLogs = (logs || []).filter(l => l && l.miningId === resource.id && isCreationMiningLog(l));

  // 收款轨（按输入 rawAmount 逐笔 round 累加）
  const revLogs = relevantLogs.filter(l => {
    const cat = l.category as string;
    return cat === RefineCategory.Revenue || cat === '收款' || cat === 'Revenue' || cat === 'revenue';
  });
  const pendingRevenue = revLogs.filter(l => isPendingStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const confirmedRevenue = revLogs.filter(l => isConfirmedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const minedRevenue = revLogs.filter(l => isApprovedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const totalOccupancyRevenue = confirmedRevenue + pendingRevenue + minedRevenue;

  // 产值轨（按输入 rawAmount 逐笔 round 累加）
  const valLogs = relevantLogs.filter(l => {
    const cat = l.category as string;
    return cat === RefineCategory.Value || cat === '产值' || cat === 'Value' || cat === 'value';
  });
  const pendingValue = valLogs.filter(l => isPendingStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const confirmedValue = valLogs.filter(l => isConfirmedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const minedValue = valLogs.filter(l => isApprovedStatus(l.status)).reduce((sum, l) => sum + getLogRawInputAmount(l), 0);
  const totalOccupancyValue = confirmedValue + pendingValue + minedValue;

  // 左项还原为业务认定的款初、产初
  const initialRevenue = getGateInitialRevenue(resource);
  const initialValue = getGateInitialValue(resource);

  const maxAllowedRevenue = Math.max(0, initialRevenue - confirmedRevenue - pendingRevenue - minedRevenue);
  const maxAllowedValue = Math.max(0, initialValue - confirmedValue - pendingValue - minedValue);

  return {
    initialRevenue,
    initialValue,
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

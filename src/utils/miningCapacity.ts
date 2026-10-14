import { MiningResource, ValueCreationLog } from '../../types';
import { calculateHedgeCapacitiesAndWeights } from './consumptionHedge';
import { importNetAmount } from './purification';

export { importNetAmount };

/**
 * 矿山双轨初限折算函数（SSOT 存库口径）：
 * 矿山下达、录入保存、批量导入时，款初与产初存库均为提纯后净值（一律 × 0.933 提纯后存库）。
 * @param rawAmount 合同毛额
 * @returns 提纯后净值整数
 */
export function mineInitialNetAmount(rawAmount: number): number {
  return Math.round((Number(rawAmount) || 0) * 0.933);
}

export function getInitialRevenueCapacity(r: MiningResource): number {
  return r ? (r.initialRevenueCapacity || r.revenueCapacity || 0) : 0;
}

export function getInitialValueCapacity(r: MiningResource): number {
  return r ? (r.initialValueCapacity || r.valueCapacity || 0) : 0;
}

/**
 * 校验并校准单个矿山资源：
 * 对已落库「产初毛额、款初已提纯」的存量矿山（如 LH26QY0017 款初=40119, 产初=43000）：
 * - 将 initialValueCapacity / valueCapacity / initialValueLimit (及对应 quotas.*.valueQuota) 改为 roundMoney(原产初 × 0.933)
 * - 若产初已经是净值，严格禁止二次乘以 0.933
 */
export function calibrateMiningResource(res: MiningResource): { resource: MiningResource; calibrated: boolean } {
  if (!res) return { resource: res, calibrated: false };
  const initRev = res.initialRevenueCapacity !== undefined ? res.initialRevenueCapacity : (res.revenueCapacity || 0);
  const initVal = res.initialValueCapacity !== undefined ? res.initialValueCapacity : (res.valueCapacity || 0);

  // 严格判定是否为存量「毛额产初」：
  // 1. initVal 近似等于 round(initRev / 0.933)（如款初=40119, 产初=43000）
  // 2. 或者录入时同毛额，但款初已乘0.933，产初仍为毛额 (round(initVal * 0.933) ≈ initRev 且 initVal > initRev)
  const isLegacyGrossVal = initRev > 0 && initVal > 0 && (
    Math.abs(initVal - Math.round(initRev / 0.933)) <= 3 ||
    (initVal > initRev && Math.abs(Math.round(initVal * 0.933) - initRev) <= 3)
  );

  if (!isLegacyGrossVal) {
    return { resource: res, calibrated: false };
  }

  const calibratedVal = Math.round(initVal * 0.933);

  const calibratedQuotas = res.quotas?.map(q => {
    if (q.valueQuota && (q.valueQuota === initVal || Math.abs(q.valueQuota - initVal) <= 2)) {
      return { ...q, valueQuota: calibratedVal };
    }
    return q;
  });

  const calibratedRes: MiningResource = {
    ...res,
    initialValueCapacity: calibratedVal,
    valueCapacity: calibratedVal,
    initialValueLimit: calibratedVal,
    quotas: calibratedQuotas || res.quotas,
    unconfirmedValue: Math.max(0, calibratedVal - (res.confirmedValue || 0) - (res.pendingValue || 0) - (res.minedValue || 0))
  };

  return { resource: calibratedRes, calibrated: true };
}

export function calibrateMiningResources(resources: MiningResource[]): MiningResource[] {
  if (!Array.isArray(resources)) return resources;
  return resources.map(r => calibrateMiningResource(r).resource);
}

export function getCurrentRevenueCapacity(r: MiningResource, logs?: ValueCreationLog[]): number {
  if (!r) return 0;
  if (!logs) return getInitialRevenueCapacity(r);
  return calculateHedgeCapacitiesAndWeights(r, logs).revCurrent;
}

export function getCurrentValueCapacity(r: MiningResource, logs?: ValueCreationLog[]): number {
  if (!r) return 0;
  if (!logs) return getInitialValueCapacity(r);
  return calculateHedgeCapacitiesAndWeights(r, logs).valCurrent;
}

export function getCWeightRevenue(r: MiningResource, logs?: ValueCreationLog[]): number {
  if (!r || !logs) return 1;
  return calculateHedgeCapacitiesAndWeights(r, logs).cWeightRev;
}

export function getCWeightValue(r: MiningResource, logs?: ValueCreationLog[]): number {
  if (!r || !logs) return 1;
  return calculateHedgeCapacitiesAndWeights(r, logs).cWeightVal;
}

export function getB2WeightValue(r: MiningResource, logs?: ValueCreationLog[]): number {
  if (!r || !logs) return 1;
  return calculateHedgeCapacitiesAndWeights(r, logs).b2Weight;
}

export function getHedgedRevenueCapacity(r: MiningResource, logs?: ValueCreationLog[]): number {
  return getCurrentRevenueCapacity(r, logs);
}

export function getHedgedValueCapacity(r: MiningResource, logs?: ValueCreationLog[]): number {
  return getCurrentValueCapacity(r, logs);
}

export function mergeMiningResources(existing: MiningResource[], incoming: MiningResource[]): MiningResource[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming || [];

  const incomingMap = new Map<string, MiningResource>();
  incoming.forEach(r => {
    if (r && r.id) {
      incomingMap.set(r.id, r);
    }
  });

  const updatedExisting = existing.map(r => (r && incomingMap.has(r.id)) ? incomingMap.get(r.id)! : r);
  const existingIds = new Set(existing.map(r => r?.id).filter(Boolean));
  const trulyNew = incoming.filter(r => r && r.id && !existingIds.has(r.id));

  return [...updatedExisting, ...trulyNew];
}


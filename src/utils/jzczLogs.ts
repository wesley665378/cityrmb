import { ValueCreationLog } from '../types';
import { isDynamicCostLog } from './costCategory';

/**
 * 判定单条流水是否属于价值创造 (jzcz)
 * 口径：confirmationType 不是「消耗确权」、「手动确权」且不是「系统兜底确权」，且非动态消耗
 */
export function shouldPersistLogToJzcz(log?: ValueCreationLog | null): boolean {
  if (!log) return false;
  const cType = (log.confirmationType as string) || '';
  if (cType === '消耗确权' || cType === '手动确权' || cType === '系统兜底确权') return false;
  return !isDynamicCostLog(log);
}

export function filterLogsForJzczSync(logs: ValueCreationLog[]): ValueCreationLog[] {
  if (!logs || !Array.isArray(logs)) return [];
  return logs.filter(shouldPersistLogToJzcz);
}

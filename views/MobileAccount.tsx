import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  apiClient,
  unwrapApiEnvelope,
  fetchSessionUser,
  fetchDistributionData,
  fetchWorkspaceData,
} from '../src/api';
import { computeCfoKuanMetrics } from '../src/utils/distributionCfoMath';
import { calculateHistoricalNetValue } from '../src/utils/business';
import { resolveLogBusinessMonth, getLocalMonthString } from '../src/utils/dateUtils';
import { User, ValueCreationLog, MiningResource, Role } from '../types';

// ==========================================
// 1. 类型定义 (TypeScript Interfaces)
// ==========================================

export interface MeInfo {
  id: string;
  userId?: string;
  name: string;
  category?: string;
  role?: string;
  center?: string;
}

export interface DistributionRow {
  userId: string;
  id?: string;
  userName?: string;
  name?: string;
  category?: string;
  historyDebt?: number;
  historyDebtConfirmed?: number;
  costPackage?: number;
  aCost?: number;
  b1Cost?: number;
  aCostConfirmed?: number;
  bCostConfirmed?: number;
  currentSurplus?: number;
  currentSurplusConfirmed?: number;
  theoreticalBonus?: number;
  theoreticalBonusConfirmed?: number;
  basicPoints?: number;
  basePoints?: number;
  performancePoints?: number;
  bonusPoints?: number;
  dividendPoints?: number;
  confirmed?: {
    costPackage?: number;
    aCost?: number;
    b1Cost?: number;
    historyDebt?: number;
    currentSurplus?: number;
    theoreticalBonus?: number;
  };
}

export interface EvaluationExpertRow {
  userId: string;
  id?: string;
  name?: string;
  monthlyEfficiency?: number;
  yearlyEfficiency?: number;
  contribution?: number;
  tierLabel?: string;
  tier?: string;
}

export interface WorkspaceLog {
  id: string;
  miningId?: string;
  recordedCollectorId?: string;
  rankId?: string;
  category?: 'Revenue' | 'Value' | '收款' | '产值' | string;
  type?: string;
  costCategory?: 'A' | 'B' | 'B1' | 'B2' | 'C' | 'D' | string;
  valueConsumptionMode?: 'B1' | 'B2' | string;
  amount?: number;
  rawAmount?: number;
  dynamicCost?: number;
  netValue?: number;
  status?: string;
  confirmationType?: string;
  businessDate?: string;
  month?: string;
  timestamp?: number;
  deleted?: boolean;
}

export interface TodoTaskItem {
  id: string;
  title: string;
  miningId: string;
  plannedPackage?: number;
}

export interface MobileAccountProps {
  onNavigate?: (path: string) => void;
}

// ==========================================
// 2. 工具函数
// ==========================================

function formatPoints(val: number | undefined | null): string {
  if (val === undefined || val === null || Number.isNaN(Number(val))) {
    return '—';
  }
  return Math.round(Number(val)).toLocaleString('zh-CN');
}

function resolveLogDate(log: WorkspaceLog): string {
  if (log.businessDate) return log.businessDate;
  if (log.month) return log.month;
  if (log.timestamp) {
    const d = new Date(Number(log.timestamp));
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return '—';
}

function isValueCategory(cat?: string): boolean {
  return cat === 'Value' || cat === '产值';
}

function isRevenueCategory(cat?: string): boolean {
  return cat === 'Revenue' || cat === '收款';
}

function isConfirmedOrApproved(status?: string): boolean {
  return (
    status === '已确权' ||
    status === '入库' ||
    status === 'Confirmed' ||
    status === 'Approved'
  );
}

function isPendingStatus(status?: string): boolean {
  return status === '待确权' || status === 'Pending';
}

function isDynamicCostRecord(log: WorkspaceLog): boolean {
  if (log.confirmationType === '消耗确权' || log.confirmationType === '手动确权') return true;
  if (log.costCategory && ['A', 'B', 'B1', 'B2', 'C', 'D'].includes(log.costCategory)) return true;
  if (typeof log.dynamicCost === 'number' && log.dynamicCost > 0) return true;
  return false;
}

function resolveCostSubType(log: WorkspaceLog): string {
  if (log.costCategory === 'B') {
    return log.valueConsumptionMode === 'B2' ? 'B2' : 'B1';
  }
  return log.costCategory || '其他';
}

// ==========================================
// 3. 主组件 MobileAccount
// ==========================================

export const MobileAccount: React.FC<MobileAccountProps> = ({ onNavigate }) => {
  const [month] = useState<string>(() => getLocalMonthString());
  const [activeTab, setActiveTab] = useState<'value' | 'cost' | 'eval'>('value');

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [me, setMe] = useState<MeInfo | null>(null);
  const [fullUser, setFullUser] = useState<User | null>(null);
  const [myDist, setMyDist] = useState<DistributionRow | null>(null);
  const [myEval, setMyEval] = useState<EvaluationExpertRow | null>(null);
  const [myLogs, setMyLogs] = useState<WorkspaceLog[]>([]);
  const [allWorkspaceLogs, setAllWorkspaceLogs] = useState<ValueCreationLog[]>([]);
  const [wsResources, setWsResources] = useState<MiningResource[]>([]);
  const [wsUsers, setWsUsers] = useState<User[]>([]);
  const [workspaceReady, setWorkspaceReady] = useState<boolean>(false);
  const [todos, setTodos] = useState<TodoTaskItem[]>([]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setWorkspaceReady(false);

    try {
      // 1. 并行请求 /api/auth/me、/api/distribution、/api/evaluation
      const [meUser, distRes, evalRaw] = await Promise.all([
        fetchSessionUser(),
        fetchDistributionData(month).catch(() => null),
        apiClient
          .get<unknown>(`/api/evaluation?month=${encodeURIComponent(month)}`)
          .then((r) => unwrapApiEnvelope<Record<string, unknown>>(r))
          .catch(() => null),
      ]);

      const resolvedId = String(meUser?.id || meUser?.userId || '');
      const resolvedUserId = String(meUser?.userId || meUser?.id || '');
      if (!resolvedId) {
        throw new Error('未能获取到当前有效身份信息');
      }

      const currentMe: MeInfo = {
        id: resolvedId,
        userId: resolvedUserId,
        name: String(meUser?.name || resolvedUserId || '未命名用户'),
        category: String(meUser?.category || meUser?.role || '采集主体'),
        role: String(meUser?.role || ''),
        center: String(meUser?.center || ''),
      };
      setMe(currentMe);

      const isSelfRow = (row: Record<string, unknown>): boolean => {
        const rUid = String(row?.userId || '');
        const rId = String(row?.id || '');
        return (
          (rUid !== '' && (rUid === currentMe.id || rUid === currentMe.userId)) ||
          (rId !== '' && (rId === currentMe.id || rId === currentMe.userId))
        );
      };

      // 解析本人 distribution 行（仅作对照与拆分读取，结余/历史欠产以 CFO 强覆写为准）
      const distList = Array.isArray(distRes?.distribution)
        ? distRes.distribution
        : Array.isArray(distRes?.experts)
        ? distRes.experts
        : [];
      const matchedDist =
        (distList as unknown as Record<string, unknown>[]).find(isSelfRow) || null;
      setMyDist(matchedDist as unknown as DistributionRow | null);

      // 解析本人 evaluation 行
      const evalList = Array.isArray(evalRaw?.experts)
        ? evalRaw.experts
        : Array.isArray(evalRaw)
        ? evalRaw
        : [];
      const matchedEval =
        (evalList as Record<string, unknown>[]).find(isSelfRow) || null;
      setMyEval(matchedEval as unknown as EvaluationExpertRow | null);

      // 2. 获取 me 后，拉取 /api/workspace 并按本人聚合流水与 CFO 上下文
      const wsRes = await fetchWorkspaceData();
      const rawUsers: User[] = Array.isArray(wsRes?.managedUsers)
        ? wsRes.managedUsers
        : Array.isArray((wsRes as Record<string, unknown>)?.users)
        ? ((wsRes as Record<string, unknown>).users as User[])
        : [];
      const rawResources: MiningResource[] = Array.isArray(wsRes?.miningResources)
        ? wsRes.miningResources
        : [];

      const matchedWsUser = rawUsers.find(
        (u) =>
          u &&
          (u.id === currentMe.id ||
            u.userId === currentMe.id ||
            u.id === currentMe.userId ||
            (currentMe.userId && u.userId === currentMe.userId))
      );

      const mergedUser: User = {
        ...(matchedWsUser || {}),
        id: matchedWsUser?.id || currentMe.id,
        userId: matchedWsUser?.userId || currentMe.userId || currentMe.id,
        name: matchedWsUser?.name || currentMe.name,
        category: (matchedWsUser?.category || currentMe.category) as User['category'],
        role: (matchedWsUser?.role || currentMe.role || Role.Collector) as Role,
        center: matchedWsUser?.center || currentMe.center,
      };
      if (matchedWsUser && matchedWsUser.category && matchedWsUser.category !== currentMe.category) {
        setMe((prev) => (prev ? { ...prev, category: matchedWsUser.category } : prev));
      }
      setFullUser(mergedUser);
      setWsUsers(rawUsers.length > 0 ? rawUsers : [mergedUser]);
      setWsResources(rawResources);

      const rawLogs: WorkspaceLog[] = [];
      const seenIds = new Set<string>();

      const appendLogs = (arr: unknown) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
          if (item && typeof item === 'object') {
            const logItem = item as WorkspaceLog;
            if (logItem.deleted) continue;
            const lid = String(logItem.id || '');
            if (lid && seenIds.has(lid)) continue;
            if (lid) seenIds.add(lid);

            // 确保历史流水具备真实 netValue（与桌面端 App.tsx / MyAccount.tsx 同轨）
            let resolvedNet = logItem.netValue;
            if (typeof resolvedNet !== 'number' || Number.isNaN(resolvedNet)) {
              const calcNet = calculateHistoricalNetValue(
                logItem as unknown as ValueCreationLog,
                rawResources,
                rawUsers
              );
              if (typeof calcNet === 'number' && !Number.isNaN(calcNet)) {
                resolvedNet = calcNet;
              }
            }
            rawLogs.push({
              ...logItem,
              netValue: resolvedNet,
            });
          }
        }
      };

      appendLogs(wsRes?.logs);
      appendLogs((wsRes as Record<string, unknown>)?.jzcz);
      appendLogs(wsRes?.dtcb);

      setAllWorkspaceLogs(rawLogs as unknown as ValueCreationLog[]);

      const selfLogs = rawLogs.filter((l) => {
        const cid = String(l.recordedCollectorId || '');
        return (
          cid !== '' &&
          (cid === mergedUser.id ||
            cid === mergedUser.userId ||
            cid === currentMe.id ||
            cid === currentMe.userId)
        );
      });

      selfLogs.sort((a, b) => {
        const da = resolveLogDate(a);
        const db = resolveLogDate(b);
        if (da !== db) return db.localeCompare(da);
        return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0);
      });

      setMyLogs(selfLogs);
      setWorkspaceReady(true);

      // 待办数据源：若无真实 todos 则置空（绝不编造任务列表）
      const wsAny = wsRes as Record<string, unknown>;
      if (Array.isArray(wsAny?.todos)) {
        const myTodos = (wsAny.todos as Record<string, unknown>[])
          .filter(isSelfRow)
          .map((t, idx) => ({
            id: String(t.id || idx),
            title: String(t.title || '待办事项'),
            miningId: String(t.miningId || '—'),
            plannedPackage:
              typeof t.plannedPackage === 'number' ? t.plannedPackage : undefined,
          }));
        setTodos(myTodos);
      } else {
        setTodos([]);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '网络请求失败，请检查连接后重试';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // 判断角色类别：产专 vs 款专
  const roleKind = useMemo<'value' | 'revenue'>(() => {
    const cat = fullUser?.category || me?.category || '';
    if (cat.includes('款专') || me?.role === 'revenue_collector') {
      return 'revenue';
    }
    return 'value';
  }, [fullUser, me]);

  // ==========================================
  // 4. 净值口径聚合计算（严格使用 netValue）
  // ==========================================
  const aggregatedMetrics = useMemo(() => {
    let cashValuePkg = 0;
    let hasCashValueNet = false;

    let virtualValuePkg = 0;
    let hasVirtualValueNet = false;

    let revenuePkg = 0;
    let hasRevenueNet = false;

    let effectiveMonthCollectionPackage = 0;
    let effectiveMonthProductionPackage = 0;

    let fallbackAB1CostSum = 0;
    let hasAB1Cost = false;

    const valueCreationList: WorkspaceLog[] = [];
    const costConsumptionList: WorkspaceLog[] = [];

    for (const log of myLogs) {
      const isCost = isDynamicCostRecord(log);
      const logMonth = resolveLogBusinessMonth(log as unknown as ValueCreationLog);

      if (isCost) {
        costConsumptionList.push(log);
        const subType = resolveCostSubType(log);
        if (
          logMonth === month &&
          (subType === 'A' || subType === 'B1') &&
          isConfirmedOrApproved(log.status)
        ) {
          if (typeof log.netValue === 'number' && !Number.isNaN(log.netValue)) {
            fallbackAB1CostSum += Math.abs(log.netValue);
            hasAB1Cost = true;
          } else if (
            typeof log.dynamicCost === 'number' &&
            !Number.isNaN(log.dynamicCost)
          ) {
            fallbackAB1CostSum += Math.abs(log.dynamicCost);
            hasAB1Cost = true;
          }
        }
        continue;
      }

      // 产值类流水
      if (isValueCategory(log.category)) {
        valueCreationList.push(log);

        // 严禁拿裸 amount 冒充 netValue
        if (typeof log.netValue === 'number' && !Number.isNaN(log.netValue)) {
          if (isConfirmedOrApproved(log.status)) {
            if (logMonth === month) {
              effectiveMonthProductionPackage += log.netValue;
              cashValuePkg += log.netValue;
              hasCashValueNet = true;
            }
          } else if (
            log.confirmationType === '联动确权' &&
            isPendingStatus(log.status)
          ) {
            if (logMonth === month) {
              virtualValuePkg += log.netValue;
              hasVirtualValueNet = true;
            }
          }
        }
      }

      // 收款类流水
      if (isRevenueCategory(log.category)) {
        if (roleKind === 'revenue') {
          valueCreationList.push(log);
        }
        if (
          typeof log.netValue === 'number' &&
          !Number.isNaN(log.netValue) &&
          isConfirmedOrApproved(log.status)
        ) {
          if (logMonth === month) {
            effectiveMonthCollectionPackage += log.netValue;
            revenuePkg += log.netValue;
            hasRevenueNet = true;
          }
        }
      }
    }

    return {
      cashValuePkg:
        hasCashValueNet || workspaceReady ? cashValuePkg : undefined,
      virtualValuePkg:
        hasVirtualValueNet || workspaceReady ? virtualValuePkg : undefined,
      revenuePkg: hasRevenueNet || workspaceReady ? revenuePkg : undefined,
      effectiveMonthCollectionPackage,
      effectiveMonthProductionPackage,
      fallbackAB1CostSum: hasAB1Cost ? fallbackAB1CostSum : undefined,
      valueCreationList,
      costConsumptionList,
    };
  }, [myLogs, roleKind, month, workspaceReady]);

  // ==========================================
  // 5. CFO 强覆写（附录 N.2.5，与桌面 MyAccount 同轨）
  // ==========================================
  const cfoMetrics = useMemo(() => {
    if (!fullUser || !workspaceReady) return null;
    try {
      return computeCfoKuanMetrics({
        currentUser: fullUser,
        effectiveMonth: month,
        collectionPackage: aggregatedMetrics.effectiveMonthCollectionPackage,
        productionPackage: aggregatedMetrics.effectiveMonthProductionPackage,
        logs: allWorkspaceLogs,
        resources: wsResources,
        users: wsUsers,
      });
    } catch {
      return null;
    }
  }, [
    fullUser,
    workspaceReady,
    month,
    aggregatedMetrics.effectiveMonthCollectionPackage,
    aggregatedMetrics.effectiveMonthProductionPackage,
    allWorkspaceLogs,
    wsResources,
    wsUsers,
  ]);

  // 历史欠产包：以 CFO 强覆写为准；若算不出且无 distribution 字段则展示「—」（禁止默认 0 假装无欠产）
  const historyDebtVal = useMemo<number | undefined>(() => {
    if (
      cfoMetrics &&
      typeof cfoMetrics.historyDebtSigned === 'number' &&
      !Number.isNaN(cfoMetrics.historyDebtSigned)
    ) {
      return cfoMetrics.historyDebtSigned;
    }
    if (myDist) {
      if (typeof myDist.historyDebt === 'number') return myDist.historyDebt;
      if (typeof myDist.historyDebtConfirmed === 'number')
        return myDist.historyDebtConfirmed;
      if (typeof myDist.confirmed?.historyDebt === 'number')
        return myDist.confirmed.historyDebt;
    }
    return undefined;
  }, [cfoMetrics, myDist]);

  // 当前结余（款专）：以 CFO 强覆写 rawSurplus 为准；禁止盲信 API 错误结余
  const currentBalanceVal = useMemo<number | undefined>(() => {
    if (
      cfoMetrics &&
      typeof cfoMetrics.rawSurplus === 'number' &&
      !Number.isNaN(cfoMetrics.rawSurplus)
    ) {
      return cfoMetrics.rawSurplus;
    }
    if (myDist) {
      if (typeof myDist.currentSurplus === 'number')
        return myDist.currentSurplus;
      if (typeof myDist.currentSurplusConfirmed === 'number')
        return myDist.currentSurplusConfirmed;
      if (typeof myDist.confirmed?.currentSurplus === 'number')
        return myDist.confirmed.currentSurplus;
    }
    return undefined;
  }, [cfoMetrics, myDist]);

  // 个人成本包：优先 costPackage 或 aCost+b1Cost 分轨（不单独拿基础包顶替）
  const personalCostPkgVal = useMemo<number | undefined>(() => {
    if (myDist) {
      if (typeof myDist.costPackage === 'number') return myDist.costPackage;
      if (typeof myDist.confirmed?.costPackage === 'number')
        return myDist.confirmed.costPackage;
      const aVal =
        myDist.aCost ?? myDist.aCostConfirmed ?? myDist.confirmed?.aCost;
      const b1Val =
        myDist.b1Cost ?? myDist.bCostConfirmed ?? myDist.confirmed?.b1Cost;
      if (typeof aVal === 'number' || typeof b1Val === 'number') {
        return (Number(aVal) || 0) + (Number(b1Val) || 0);
      }
    }
    if (cfoMetrics) {
      const cfoAB1 = (Number(cfoMetrics.aCost) || 0) + (Number(cfoMetrics.b1Cost) || 0);
      if (cfoAB1 > 0) return cfoAB1;
      if (typeof cfoMetrics.costPackage === 'number') return Math.abs(cfoMetrics.costPackage);
    }
    return aggregatedMetrics.fallbackAB1CostSum;
  }, [myDist, cfoMetrics, aggregatedMetrics.fallbackAB1CostSum]);

  const handleQuickDeclare = () => {
    if (onNavigate) {
      onNavigate('#/dynamic-consumption');
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/dynamic-consumption';
    }
  };

  // ==========================================
  // 6. 渲染辅助
  // ==========================================

  const renderEvaluationTab = () => {
    const rawMonthlyEff = myEval?.monthlyEfficiency;
    const totalScoreDisplay =
      typeof rawMonthlyEff === 'number' && !Number.isNaN(rawMonthlyEff)
        ? Math.round(rawMonthlyEff <= 2 ? rawMonthlyEff * 100 : rawMonthlyEff)
        : null;

    const routeBadgeText = myEval?.tierLabel || myEval?.tier || '—';

    // 真实进度条构建（纯中文文案，仅使用接口真实返回字段）
    const progressBars: Array<{ label: string; display: string; percent: number }> = [];

    if (typeof myEval?.monthlyEfficiency === 'number') {
      const pct = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            myEval.monthlyEfficiency <= 2
              ? myEval.monthlyEfficiency * 100
              : myEval.monthlyEfficiency
          )
        )
      );
      progressBars.push({
        label: '月效率',
        display: `${pct}`,
        percent: pct,
      });
    }

    if (typeof myEval?.yearlyEfficiency === 'number') {
      const pct = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            myEval.yearlyEfficiency <= 2
              ? myEval.yearlyEfficiency * 100
              : myEval.yearlyEfficiency
          )
        )
      );
      progressBars.push({
        label: '年效率',
        display: `${pct}`,
        percent: pct,
      });
    }

    if (typeof myEval?.contribution === 'number') {
      const rawC = myEval.contribution;
      const pct =
        rawC >= 0 && rawC <= 1
          ? Math.round(rawC * 100)
          : rawC >= 0 && rawC <= 100
          ? Math.round(rawC)
          : null;
      if (pct !== null) {
        progressBars.push({
          label: '贡献度',
          display: `${pct}%`,
          percent: pct,
        });
      }
    }

    const estTotalPoints =
      myDist?.theoreticalBonus ??
      myDist?.theoreticalBonusConfirmed ??
      myDist?.confirmed?.theoreticalBonus;
    const basicPts = myDist?.basicPoints ?? myDist?.basePoints;
    const perfPts = myDist?.performancePoints;
    const bonusPts = myDist?.bonusPoints;
    const dividendPts = myDist?.dividendPoints;

    const debtDeduction =
      typeof historyDebtVal === 'number'
        ? historyDebtVal === 0
          ? 0
          : -Math.abs(historyDebtVal)
        : undefined;
    const costDeduction =
      typeof personalCostPkgVal === 'number'
        ? personalCostPkgVal === 0
          ? 0
          : -Math.abs(personalCostPkgVal)
        : undefined;

    return (
      <div className="ma-tab-pane">
        {/* 得分卡片 */}
        <div className="ma-card ma-eval-score-card">
          <div className="ma-eval-header">
            <div>
              <div className="ma-eval-subtitle">综合评价得分</div>
              <div className="ma-eval-score-num">
                {totalScoreDisplay !== null ? totalScoreDisplay : '—'}
              </div>
            </div>
            <span className="ma-route-badge">{routeBadgeText}</span>
          </div>

          <div className="ma-progress-list">
            {progressBars.length === 0 ? (
              <div className="ma-empty-inline">—</div>
            ) : (
              progressBars.map((bar) => (
                <div key={bar.label} className="ma-progress-item">
                  <div className="ma-progress-top">
                    <span>{bar.label}</span>
                    <span className="ma-mono">{bar.display}</span>
                  </div>
                  <div className="ma-progress-track">
                    <div
                      className="ma-progress-fill"
                      style={{ width: `${bar.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 积分分配卡片 */}
        <div className="ma-card ma-alloc-card">
          <div className="ma-alloc-head">
            <span className="ma-alloc-title">本月预估总积分</span>
            <span className="ma-alloc-total ma-mono">{formatPoints(estTotalPoints)}</span>
          </div>

          <div className="ma-alloc-rows">
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">基本积分</span>
              <span className="ma-alloc-val ma-mono">{formatPoints(basicPts)}</span>
            </div>
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">绩效积分</span>
              <span className="ma-alloc-val ma-mono">{formatPoints(perfPts)}</span>
            </div>
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">奖金积分(优先填坑)</span>
              <span className="ma-alloc-val ma-mono">{formatPoints(bonusPts)}</span>
            </div>
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">分红积分</span>
              <span className="ma-alloc-val ma-mono">{formatPoints(dividendPts)}</span>
            </div>
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">历史欠产包抵扣</span>
              <span className="ma-alloc-val ma-mono ma-text-red">
                {formatPoints(debtDeduction)}
              </span>
            </div>
            <div className="ma-alloc-row">
              <span className="ma-alloc-label">个人成本消耗</span>
              <span className="ma-alloc-val ma-mono ma-text-red">
                {formatPoints(costDeduction)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ma-container">
      <style>{`
        .ma-container {
          max-width: 414px;
          margin: 0 auto;
          min-height: 100vh;
          background-color: #f4f7fb;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
          padding-bottom: 84px;
          box-sizing: border-box;
          position: relative;
        }
        .ma-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }
        /* 顶部深蓝 Header */
        .ma-header {
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          color: #ffffff;
          padding: 24px 20px 64px 20px;
          border-bottom-left-radius: 24px;
          border-bottom-right-radius: 24px;
        }
        .ma-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ma-user-name {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .ma-role-tag {
          display: inline-block;
          margin-top: 6px;
          padding: 3px 10px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          color: #e0f2fe;
        }
        .ma-month-pill {
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
          background: rgba(15, 23, 42, 0.45);
          padding: 4px 10px;
          border-radius: 8px;
        }
        /* 2x2 悬浮核心资产卡 */
        .ma-asset-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 0 16px;
          margin-top: -42px;
        }
        .ma-asset-item {
          background: #ffffff;
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 8px 20px -6px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 92px;
          box-sizing: border-box;
        }
        .ma-asset-label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }
        .ma-asset-value {
          font-size: 20px;
          font-weight: 800;
          margin: 6px 0 4px 0;
        }
        .ma-asset-sub {
          font-size: 11px;
          color: #94a3b8;
        }
        .ma-color-green { color: #059669; }
        .ma-color-orange { color: #d97706; }
        .ma-color-red { color: #dc2626; }
        .ma-color-gray { color: #475569; }
        .ma-text-red { color: #dc2626; }

        /* 主体内容间距 */
        .ma-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* 全宽黑色快捷按钮 */
        .ma-quick-btn {
          width: 100%;
          min-height: 48px;
          background-color: #0f172a;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
          transition: opacity 0.15s ease;
        }
        .ma-quick-btn:active {
          opacity: 0.85;
        }

        /* 通用卡片 */
        .ma-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }
        .ma-section-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 12px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* 待办任务 */
        .ma-todo-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid #f1f5f9;
        }
        .ma-todo-item:first-of-type {
          border-top: none;
          padding-top: 0;
        }
        .ma-todo-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }
        .ma-todo-meta {
          font-size: 11px;
          color: #64748b;
          margin-top: 3px;
        }
        .ma-todo-action {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }

        /* 流水列表 */
        .ma-log-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ma-log-row {
          background: #ffffff;
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ma-log-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ma-log-Sys {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ma-log-date {
          font-size: 11px;
          color: #64748b;
        }
        .ma-status-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
        }
        .ma-status-confirmed {
          background: #ecfdf5;
          color: #059669;
        }
        .ma-status-pending {
          background: #fffbeb;
          color: #d97706;
        }
        .ma-log-right {
          text-align: right;
        }
        .ma-log-net {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }
        .ma-log-unit {
          font-size: 10px;
          color: #94a3b8;
        }

        /* 评价与分配 Tab */
        .ma-tab-pane {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ma-eval-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ma-eval-subtitle {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }
        .ma-eval-score-num {
          font-size: 34px;
          font-weight: 900;
          color: #1d4ed8;
          line-height: 1.1;
          margin-top: 4px;
        }
        .ma-route-badge {
          font-size: 11px;
          font-weight: 800;
          color: #1e40af;
          background: #dbeafe;
          border: 1px solid #93c5fd;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .ma-progress-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ma-progress-top {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }
        .ma-progress-track {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .ma-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #3b82f6);
          border-radius: 999px;
        }
        .ma-alloc-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 10px;
        }
        .ma-alloc-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .ma-alloc-total {
          font-size: 22px;
          font-weight: 900;
          color: #1d4ed8;
        }
        .ma-alloc-rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ma-alloc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
        .ma-alloc-label {
          color: #475569;
          font-weight: 600;
        }
        .ma-alloc-val {
          font-weight: 800;
          color: #0f172a;
        }

        /* 底部固定导航 Tab */
        .ma-bottom-tabs {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 414px;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          padding: 8px 12px;
          box-sizing: border-box;
          z-index: 50;
          box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.05);
        }
        .ma-tab-btn {
          background: transparent;
          border: none;
          padding: 8px 4px;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ma-tab-btn.active {
          color: #1d4ed8;
          background: #eff6ff;
          font-weight: 800;
        }

        /* 状态反馈 */
        .ma-state-box {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          border: 1px solid #e2e8f0;
          margin: 16px;
        }
        .ma-state-text {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 14px;
        }
        .ma-retry-btn {
          padding: 8px 18px;
          background: #1d4ed8;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        .ma-empty-inline {
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
          padding: 16px 0;
        }
      `}</style>

      {/* 1. 顶部深蓝 Header */}
      <header className="ma-header">
        <div className="ma-header-top">
          <div>
            <h1 className="ma-user-name">
              {loading ? '加载中…' : me?.name || '未知用户'}
            </h1>
            <span className="ma-role-tag">
              {loading ? '识别角色…' : fullUser?.category || me?.category || '采集主体'}
            </span>
          </div>
          <div className="ma-month-pill ma-mono">{month}</div>
        </div>
      </header>

      {/* 错误态拦截：不渲染假资产数字 */}
      {errorMsg ? (
        <div className="ma-state-box">
          <div className="ma-state-text">{errorMsg}</div>
          <button type="button" className="ma-retry-btn" onClick={fetchAllData}>
            重新加载
          </button>
        </div>
      ) : loading ? (
        <div className="ma-state-box">
          <div className="ma-state-text">正在同步个人帐户净值与评价数据…</div>
        </div>
      ) : (
        <>
          {/* 2. 核心资产卡（2x2 动态根据 me.category 渲染） */}
          <section className="ma-asset-grid">
            {roleKind === 'value' ? (
              <>
                {/* 情况 A：产专 */}
                <div className="ma-asset-item">
                  <div className="ma-asset-label">产兑包（现金）</div>
                  <div className="ma-asset-value ma-color-green ma-mono">
                    {formatPoints(aggregatedMetrics.cashValuePkg)}
                  </div>
                  <div className="ma-asset-sub">已存档已收款</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">产兑包（虚拟）</div>
                  <div className="ma-asset-value ma-color-orange ma-mono">
                    {formatPoints(aggregatedMetrics.virtualValuePkg)}
                  </div>
                  <div className="ma-asset-sub">已提报，待客户核销</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">历史欠产包</div>
                  <div className="ma-asset-value ma-color-red ma-mono">
                    {formatPoints(historyDebtVal)}
                  </div>
                  <div className="ma-asset-sub">发奖金优先扣除</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">个人成本包</div>
                  <div className="ma-asset-value ma-color-gray ma-mono">
                    {formatPoints(personalCostPkgVal)}
                  </div>
                  <div className="ma-asset-sub">本月已录 A/B1</div>
                </div>
              </>
            ) : (
              <>
                {/* 情况 B：款专 */}
                <div className="ma-asset-item">
                  <div className="ma-asset-label">收款包</div>
                  <div className="ma-asset-value ma-color-green ma-mono">
                    {formatPoints(aggregatedMetrics.revenuePkg)}
                  </div>
                  <div className="ma-asset-sub">已收款</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">历史欠产包</div>
                  <div className="ma-asset-value ma-color-red ma-mono">
                    {formatPoints(historyDebtVal)}
                  </div>
                  <div className="ma-asset-sub">发奖金优先扣除</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">个人成本包</div>
                  <div className="ma-asset-value ma-color-gray ma-mono">
                    {formatPoints(personalCostPkgVal)}
                  </div>
                  <div className="ma-asset-sub">本月已录 A/B1</div>
                </div>

                <div className="ma-asset-item">
                  <div className="ma-asset-label">当前结余</div>
                  <div className="ma-asset-value ma-color-gray ma-mono">
                    {formatPoints(currentBalanceVal)}
                  </div>
                  <div className="ma-asset-sub">收款净值核算结余</div>
                </div>
              </>
            )}
          </section>

          <main className="ma-body">
            {/* 3. 快捷区 */}
            <button
              type="button"
              className="ma-quick-btn"
              onClick={handleQuickDeclare}
            >
              <span>动态消耗申报</span>
            </button>

            {/* 4. 待办任务卡片 */}
            <section className="ma-card">
              <h2 className="ma-section-title">
                <span>待办任务</span>
                <span className="ma-mono" style={{ fontSize: '11px', color: '#64748b' }}>
                  {todos.length} 项
                </span>
              </h2>
              {todos.length === 0 ? (
                <div className="ma-empty-inline">暂无待办</div>
              ) : (
                todos.map((item) => (
                  <div key={item.id} className="ma-todo-item">
                    <div>
                      <div className="ma-todo-title">{item.title}</div>
                      <div className="ma-todo-meta">
                        矿山：{item.miningId} ｜ 计划产兑包：
                        <span className="ma-mono">{formatPoints(item.plannedPackage)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ma-todo-action"
                      onClick={() => handleQuickDeclare()}
                    >
                      去处理
                    </button>
                  </div>
                ))
              )}
            </section>

            {/* 5. 当前选中底部 Tab 内容区 */}
            <section>
              {activeTab === 'value' && (
                <div className="ma-log-list">
                  {aggregatedMetrics.valueCreationList.length === 0 ? (
                    <div className="ma-card ma-empty-inline">暂无产值流水记录</div>
                  ) : (
                    aggregatedMetrics.valueCreationList.map((log) => {
                      const confirmed = isConfirmedOrApproved(log.status);
                      const hasNet =
                        typeof log.netValue === 'number' && !Number.isNaN(log.netValue);
                      return (
                        <div key={log.id} className="ma-log-row">
                          <div className="ma-log-left">
                            <div className="ma-log-Sys">
                              <span className="ma-mono">{log.miningId || '无矿山编号'}</span>
                              <span
                                className={`ma-status-tag ${
                                  confirmed ? 'ma-status-confirmed' : 'ma-status-pending'
                                }`}
                              >
                                {log.status || '待确权'}
                              </span>
                            </div>
                            <div className="ma-log-date ma-mono">
                              业务日：{resolveLogDate(log)}
                            </div>
                          </div>
                          <div className="ma-log-right">
                            <div className="ma-log-net ma-mono">
                              {hasNet ? formatPoints(log.netValue) : '—'}
                            </div>
                            <div className="ma-log-unit">净值积分</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'cost' && (
                <div className="ma-log-list">
                  {aggregatedMetrics.costConsumptionList.length === 0 ? (
                    <div className="ma-card ma-empty-inline">暂无成本流水记录</div>
                  ) : (
                    aggregatedMetrics.costConsumptionList.map((log) => {
                      const confirmed = isConfirmedOrApproved(log.status);
                      const subType = resolveCostSubType(log);
                      const isOrgHedge = subType === 'B2' || subType === 'C';
                      const costVal =
                        typeof log.netValue === 'number' && !Number.isNaN(log.netValue)
                          ? log.netValue
                          : typeof log.dynamicCost === 'number' && !Number.isNaN(log.dynamicCost)
                          ? -Math.abs(log.dynamicCost)
                          : undefined;

                      return (
                        <div key={log.id} className="ma-log-row">
                          <div className="ma-log-left">
                            <div className="ma-log-Sys">
                              <span className="ma-mono">
                                [{subType}类] {log.miningId || '经营单元公摊'}
                              </span>
                              <span
                                className={`ma-status-tag ${
                                  confirmed ? 'ma-status-confirmed' : 'ma-status-pending'
                                }`}
                              >
                                {log.status || '待确权'}
                              </span>
                            </div>
                            <div className="ma-log-date ma-mono">
                              业务日：{resolveLogDate(log)}
                              {isOrgHedge ? ' · 项目对冲不计入个人A/B1合计' : ''}
                            </div>
                          </div>
                          <div className="ma-log-right">
                            <div className="ma-log-net ma-mono">
                              {costVal !== undefined ? formatPoints(costVal) : '—'}
                            </div>
                            <div className="ma-log-unit">净值积分</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'eval' && renderEvaluationTab()}
            </section>
          </main>
        </>
      )}

      {/* 底部三栏切换 Tab */}
      <nav className="ma-bottom-tabs">
        <button
          type="button"
          className={`ma-tab-btn ${activeTab === 'value' ? 'active' : ''}`}
          onClick={() => setActiveTab('value')}
        >
          产值流水
        </button>
        <button
          type="button"
          className={`ma-tab-btn ${activeTab === 'cost' ? 'active' : ''}`}
          onClick={() => setActiveTab('cost')}
        >
          成本流水
        </button>
        <button
          type="button"
          className={`ma-tab-btn ${activeTab === 'eval' ? 'active' : ''}`}
          onClick={() => setActiveTab('eval')}
        >
          评价与分配
        </button>
      </nav>
    </div>
  );
};

export default MobileAccount;

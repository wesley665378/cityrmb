import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useCostPrivacy } from '../src/hooks/useCostPrivacy';
import { CostPrivacyToggle } from '../src/components/CostPrivacyToggle';
import { User, ValueCreationLog, MiningResource } from '../types';
import { computeAllEvaluations, EvaluationResult } from '../src/utils/valueEvaluation';
import { formatAmount, formatRatio } from '../src/utils/formatters';
import { InfoTip } from '../src/components/InfoTip';
import { BusinessDateFilter } from '../src/components/BusinessDateFilter';
import { getLocalMonthString } from '../src/utils/dateUtils';
import { fetchEvaluationData, EvaluationExpertRow } from '../src/api/evaluation';
import { toast } from 'sonner';
import { useTerms } from '../src/hooks/useTerms';

interface EvaluationProps {
  users?: User[];
  logs?: ValueCreationLog[];
  auditLogs?: ValueCreationLog[];
  resources?: MiningResource[];
  currentTime?: Date;
  onFilterMonthChange?: (month: string) => void;
}

const getTierFullText = (tier?: string) => {
  if (tier === 'S') return 'S 档：核心资产 · 重点保护（优先资源倾斜，超额价值分配保护）';
  if (tier === 'A') return 'A 档：核心晋升 · 业务中坚（持续正向价值，核心职级晋升序列）';
  if (tier === 'B') return 'B 档：标准评价 · 持续激励（持续稳定力量，标准激励健康循环）';
  return 'C 档：价值逆差 · 重点赋能（产出小于成本，赋能与工时对冲辅导）';
};

const getTierBadgeClass = (tier?: string) => {
  if (tier === 'S') return 'bg-slate-900 text-white border-slate-900';
  if (tier === 'A') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (tier === 'B') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-rose-50 text-rose-600 border-rose-200';
};

const Evaluation: React.FC<EvaluationProps> = ({ users = [], logs = [], auditLogs, resources = [], onFilterMonthChange }) => {
  const { t } = useTerms();
  const { maskMoney } = useCostPrivacy();
  const effectiveLogs = auditLogs || logs;
  const isLocalEmbedded = import.meta.env.VITE_USE_LOCAL_AUTH === 'true';

  const [filterMonth, setFilterMonth] = useState<string>(() => getLocalMonthString());
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // 服务端 API 数据状态
  const [serverEvaluations, setServerEvaluations] = useState<EvaluationExpertRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 加载服务端评价数据
  const loadEvaluationData = useCallback(() => {
    if (isLocalEmbedded) {
      setServerEvaluations(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const params = (filterStartDate && filterEndDate)
      ? { startDate: filterStartDate, endDate: filterEndDate }
      : { month: filterMonth || getLocalMonthString() };

    fetchEvaluationData(params)
      .then(res => {
        setServerEvaluations(res.experts || []);
      })
      .catch(err => {
        console.error('加载价值评价数据失败:', err);
        const msg = err?.message || '无法加载价值评价数据';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filterMonth, filterStartDate, filterEndDate, isLocalEmbedded]);

  useEffect(() => {
    loadEvaluationData();
  }, [loadEvaluationData]);

  // 自定义查询状态（模糊搜索、等级、类别）
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  const [showTierDescriptions, setShowTierDescriptions] = useState<boolean>(false);
  const [expandedCosts, setExpandedCosts] = useState<Set<string>>(new Set());
  const [expandedProdCashRows, setExpandedProdCashRows] = useState<Set<string>>(new Set());

  const toggleCost = (id: string) => {
    setExpandedCosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProdCashRow = (id: string) => {
    setExpandedProdCashRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 核心评价数据：线上以服务端为准，本地开发模式兜底走 computeAllEvaluations
  const evaluations: (EvaluationExpertRow | EvaluationResult)[] = useMemo(() => {
    if (isLocalEmbedded) {
      return computeAllEvaluations(users, effectiveLogs, resources, filterMonth, filterStartDate, filterEndDate);
    }
    return serverEvaluations || [];
  }, [isLocalEmbedded, serverEvaluations, users, effectiveLogs, resources, filterMonth, filterStartDate, filterEndDate]);

  // 过滤后的评价数据
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter(e => {
      const matchQuery = !searchQuery.trim() || 
        e.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        String(e.userId).toLowerCase().includes(searchQuery.toLowerCase());
      const matchTier = selectedTier === 'ALL' || e.tier === selectedTier;
      const matchCategory = selectedCategory === 'ALL' || e.category.includes(selectedCategory);

      return matchQuery && matchTier && matchCategory;
    });
  }, [evaluations, searchQuery, selectedTier, selectedCategory]);

  type SortField = 'userName' | 'monthlyIncome' | 'monthlyCost' | 'contribution' | 'monthlyEfficiency' | 'yearlyContribution' | 'yearlyEfficiency' | 'tier' | null;
  type SortOrder = 'asc' | 'desc' | null;

  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === 'desc') {
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortField(null);
        setSortOrder(null);
      } else {
        setSortOrder('desc');
      }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getTierRank = (tier?: string) => {
    if (tier === 'S') return 4;
    if (tier === 'A') return 3;
    if (tier === 'B') return 2;
    if (tier === 'C') return 1;
    return 0;
  };

  const sortedEvaluations = useMemo(() => {
    const list = [...filteredEvaluations];
    if (!sortField || !sortOrder) return list;

    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'userName':
          valA = a.userName || '';
          valB = b.userName || '';
          break;
        case 'monthlyIncome':
          valA = a.monthlyIncomeUpper ?? a.monthlyIncome ?? 0;
          valB = b.monthlyIncomeUpper ?? b.monthlyIncome ?? 0;
          break;
        case 'monthlyCost':
          valA = a.monthlyCost ?? 0;
          valB = b.monthlyCost ?? 0;
          break;
        case 'contribution':
          valA = a.contributionUpper ?? a.contribution ?? 0;
          valB = b.contributionUpper ?? b.contribution ?? 0;
          break;
        case 'monthlyEfficiency':
          valA = a.monthlyEfficiencyUpper ?? a.monthlyEfficiency ?? 0;
          valB = b.monthlyEfficiencyUpper ?? b.monthlyEfficiency ?? 0;
          break;
        case 'yearlyContribution':
          valA = a.yearlyContributionUpper ?? a.yearlyContribution ?? ((a.yearlyIncomeUpper ?? a.yearlyIncome) - a.yearlyCost);
          valB = b.yearlyContributionUpper ?? b.yearlyContribution ?? ((b.yearlyIncomeUpper ?? b.yearlyIncome) - b.yearlyCost);
          break;
        case 'yearlyEfficiency':
          valA = a.yearlyEfficiencyUpper ?? a.yearlyEfficiency ?? 0;
          valB = b.yearlyEfficiencyUpper ?? b.yearlyEfficiency ?? 0;
          break;
        case 'tier':
          valA = getTierRank(a.tierUpper || a.tier);
          valB = getTierRank(b.tierUpper || b.tier);
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const res = valA.localeCompare(valB, 'zh-CN');
        return sortOrder === 'asc' ? res : -res;
      } else {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        if (numA === numB) return 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
    });

    return list;
  }, [filteredEvaluations, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    const isActive = sortField === field;
    return (
      <span className={`inline-flex flex-col ml-1 align-middle transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}>
        <ChevronUp className={`w-3.5 h-3.5 -mb-1 ${isActive && sortOrder === 'asc' ? 'text-blue-600' : 'text-slate-400'}`} />
        <ChevronDown className={`w-3.5 h-3.5 ${isActive && sortOrder === 'desc' ? 'text-blue-600' : 'text-slate-400'}`} />
      </span>
    );
  };

  const renderCostBreakdown = (e: EvaluationExpertRow | EvaluationResult) => (
    <div className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded p-2 space-y-1 text-[11px] text-slate-600 text-right">
      <div className="flex justify-between items-center">
        <span className="text-slate-500">刚性基数</span>
        <span className="font-mono text-slate-800">{maskMoney(e.baseSalary || 0)}</span>
      </div>
      {e.isRevenueExpert && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">A类消耗</span>
          <span className="font-mono text-slate-800">{maskMoney(e.aCost || 0)}</span>
        </div>
      )}
      {e.isProdExpert && (
        <div className="flex justify-between items-center">
          <span className="text-slate-500">B1类消耗</span>
          <span className="font-mono text-slate-800">{maskMoney(e.b1Cost || 0)}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-slate-500">D类分摊</span>
        <span className="font-mono text-slate-800">{maskMoney(e.dCost || 0)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-slate-500">非效对冲</span>
        <span className="font-mono text-slate-800">-{maskMoney(e.nonEffectiveDeduction || 0)}</span>
      </div>
    </div>
  );

  const sortFieldLabel = sortField === 'userName' ? '采集主体'
    : sortField === 'monthlyIncome' ? '收产包'
    : sortField === 'monthlyCost' ? '成本包'
    : sortField === 'contribution' ? '月损益'
    : sortField === 'monthlyEfficiency' ? '月效率'
    : sortField === 'yearlyContribution' ? '年损益'
    : sortField === 'yearlyEfficiency' ? '年效率'
    : '决策路由';

  return (
    <div className="w-full p-4 sm:p-6 bg-white border border-slate-200 rounded-sm font-sans space-y-5">
      {/* 顶部标题 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base md:text-lg font-bold text-slate-900">全员{t('value_evaluation', '价值评价')}贡献矩阵</h3>
          <InfoTip
            title="价值评价口径"
            content="按当期收产包与成本包核算月损益、月效率及年度累计效率，自动映射 S / A / B / C 四档管理决策路由。"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowTierDescriptions(prev => !prev)}
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          {showTierDescriptions ? '收起档位说明 ▲' : '档位说明 ▼'}
        </button>
      </div>

      {/* 四档卡片墙：统一白底 + 左侧色条区分 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        {[
          {
            tier: 'S',
            name: '卓越级 (S)',
            range: '效率 > 2.5',
            headline: '核心资产 · 重点保护',
            description: '优先资源倾斜，超额价值分配保护',
            count: evaluations.filter(e => (e.tierUpper || e.tier) === 'S').length,
            leftBar: 'border-l-slate-900',
          },
          {
            tier: 'A',
            name: '进取级 (A)',
            range: '效率 1.5 ~ 2.5',
            headline: '核心晋升 · 业务中坚',
            description: '持续正向价值，核心职级晋升序列',
            count: evaluations.filter(e => (e.tierUpper || e.tier) === 'A').length,
            leftBar: 'border-l-blue-600',
          },
          {
            tier: 'B',
            name: '稳健级 (B)',
            range: '效率 1.2 ~ 1.5',
            headline: '标准评价 · 持续激励',
            description: '持续稳定力量，标准激励健康循环',
            count: evaluations.filter(e => (e.tierUpper || e.tier) === 'B').length,
            leftBar: 'border-l-emerald-600',
          },
          {
            tier: 'C',
            name: '改进级 (C)',
            range: '效率 < 1.2',
            headline: '价值逆差 · 重点赋能',
            description: '产出小于成本，赋能与工时对冲辅导',
            count: evaluations.filter(e => (e.tierUpper || e.tier) === 'C').length,
            leftBar: 'border-l-amber-500',
          },
        ].map((tierItem) => {
          const isSelected = selectedTier === tierItem.tier;
          const percentage = evaluations.length > 0 ? ((tierItem.count / evaluations.length) * 100).toFixed(1) : '0.0';

          return (
            <div
              key={tierItem.tier}
              onClick={() => setSelectedTier(selectedTier === tierItem.tier ? 'ALL' : tierItem.tier)}
              title={`${tierItem.headline}：${tierItem.description}`}
              className={`p-3.5 bg-white border border-slate-200 border-l-4 ${tierItem.leftBar} rounded-sm transition-all cursor-pointer hover:border-slate-300 ${
                isSelected ? 'ring-2 ring-blue-600/20 border-blue-500 bg-blue-50/10' : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{tierItem.name}</span>
                <span className="font-mono text-[11px] text-slate-400">{tierItem.range}</span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-slate-900">{tierItem.count}</span>
                  <span className="text-xs text-slate-500">人</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{percentage}%</span>
              </div>

              {showTierDescriptions && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
                  <div className="font-medium text-slate-700">{tierItem.headline}</div>
                  <div>{tierItem.description}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全员评价明细表 */}
      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        {/* 表区标题条 */}
        <div className="bg-slate-50/70 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">价值贡献明细</span>
            <span className="text-xs text-slate-500">
              {loading ? (
                '正在同步数据...'
              ) : error ? (
                <span className="text-rose-600">{error}</span>
              ) : sortField ? (
                <span>
                  按{sortFieldLabel}{sortOrder === 'asc' ? '升序' : '降序'}
                  <button
                    type="button"
                    onClick={() => { setSortField(null); setSortOrder(null); }}
                    className="ml-1.5 text-slate-400 hover:text-slate-700"
                  >
                    清除
                  </button>
                </span>
              ) : (
                `共 ${sortedEvaluations.length} 人`
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadEvaluationData}
              disabled={loading}
              title="刷新数据"
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 筛选条 */}
        <div className="p-3.5 bg-white border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 时间筛选 */}
            <div className="flex items-center">
              <BusinessDateFilter 
                month={filterStartDate || filterEndDate ? '' : filterMonth}
                onMonthChange={(m) => {
                  setFilterMonth(m);
                  setFilterStartDate('');
                  setFilterEndDate('');
                  if (onFilterMonthChange) onFilterMonthChange(m);
                }}
                startDate={filterStartDate}
                endDate={filterEndDate}
                onDateRangeChange={(s, e) => {
                  setFilterStartDate(s);
                  setFilterEndDate(e);
                  setFilterMonth('');
                }}
                onClear={() => {
                  const nowM = getLocalMonthString();
                  setFilterMonth(nowM);
                  setFilterStartDate('');
                  setFilterEndDate('');
                  if (onFilterMonthChange) onFilterMonthChange(nowM);
                }}
              />
            </div>

            {/* 姓名/编号搜索 */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索姓名或编号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-white border border-slate-200 rounded pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* 更多筛选开关 */}
            <button
              type="button"
              onClick={() => setShowMoreFilters(prev => !prev)}
              className={`h-9 px-3 text-xs border rounded flex items-center gap-1.5 transition-colors ${
                showMoreFilters || selectedTier !== 'ALL' || selectedCategory !== 'ALL'
                  ? 'bg-slate-100 border-slate-300 text-slate-800 font-medium'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>更多筛选</span>
              {(selectedTier !== 'ALL' || selectedCategory !== 'ALL') && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </button>

            {(searchQuery || selectedTier !== 'ALL' || selectedCategory !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTier('ALL');
                  setSelectedCategory('ALL');
                }}
                className="h-9 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 transition-colors"
              >
                重置
              </button>
            )}
          </div>

          {(showMoreFilters || selectedTier !== 'ALL' || selectedCategory !== 'ALL') && (
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">评价等级</span>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="h-8 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                >
                  <option value="ALL">全部等级</option>
                  <option value="S">S - 卓越级</option>
                  <option value="A">A - 进取级</option>
                  <option value="B">B - 稳健级</option>
                  <option value="C">C - 改进级</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">角色分类</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                >
                  <option value="ALL">全部类别</option>
                  <option value="款专">收款专家 (款专)</option>
                  <option value="产专">产值专家 (产专)</option>
                  <option value="经管员">经管员</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th 
                  onClick={() => handleSort('userName')}
                  className="group py-2.5 px-4 text-left whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center">
                    采集主体 {renderSortIcon('userName')}
                  </span>
                </th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap">
                  统计口径
                </th>
                <th 
                  onClick={() => handleSort('monthlyIncome')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-end w-full">
                    收产包 {renderSortIcon('monthlyIncome')}
                  </span>
                </th>
                <th 
                  onClick={() => handleSort('monthlyCost')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="inline-flex items-center">
                      成本包 {renderSortIcon('monthlyCost')}
                    </span>
                    <InfoTip 
                      title="成本包口径" 
                      content="刚性基数（单月刚性成本）+ 对应职级消耗成本（款专：A类；产专：B1类）+ D类分摊 − 非效对冲。" 
                    />
                    <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center ml-0.5">
                      <CostPrivacyToggle size="sm" showLabel={false} />
                    </div>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('contribution')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-end w-full gap-1">
                    <span>月损益 {renderSortIcon('contribution')}</span>
                    <InfoTip title="月损益口径" content="该行收产包 − 成本包。正值代表正向净收益，负值代表损益逆差。" />
                  </span>
                </th>
                <th 
                  onClick={() => handleSort('monthlyEfficiency')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-end w-full gap-1">
                    <span>月效率 {renderSortIcon('monthlyEfficiency')}</span>
                    <InfoTip title="效率与分档口径" content="月效率 = 收产包 ÷ 成本包；年效率 = 当年累计收产包 ÷ 当年累计成本包。>2.5 为 S 档，1.5~2.5 为 A 档，1.2~1.5 为 B 档，<1.2 为 C 档。" />
                  </span>
                </th>
                <th 
                  onClick={() => handleSort('yearlyContribution')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-end w-full">
                    年损益 {renderSortIcon('yearlyContribution')}
                  </span>
                </th>
                <th 
                  onClick={() => handleSort('yearlyEfficiency')}
                  className="group py-2.5 px-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-end w-full">
                    年效率 {renderSortIcon('yearlyEfficiency')}
                  </span>
                </th>
                <th 
                  onClick={() => handleSort('tier')}
                  className="group py-2.5 px-4 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                >
                  <span className="inline-flex items-center justify-center">
                    决策路由 {renderSortIcon('tier')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && evaluations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 text-xs">
                    正在加载价值评价数据...
                  </td>
                </tr>
              ) : error && evaluations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-rose-600 text-xs">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span>{error || '数据加载失败'}</span>
                      <button
                        type="button"
                        onClick={loadEvaluationData}
                        className="mt-1 px-3 py-1 bg-white border border-rose-200 rounded text-rose-600 text-xs hover:bg-rose-50 transition-colors"
                      >
                        重新加载
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sortedEvaluations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 text-xs">
                    暂无符合条件的评价记录
                  </td>
                </tr>
              ) : (
                sortedEvaluations.map(e => {
                  const isProd = e.isProdExpert ?? (e.category?.includes('产专') || e.category === '经管员高产专');

                  if (isProd) {
                    const incomeUpper = e.monthlyIncomeUpper ?? ((e.confirmedValueConfirmed || 0) + (e.pendingValueConfirmed || 0));
                    const incomeLower = e.monthlyIncomeLower ?? (e.confirmedValueConfirmed || 0);
                    const contribUpper = e.contributionUpper ?? (incomeUpper - e.monthlyCost);
                    const contribLower = e.contributionLower ?? (incomeLower - e.monthlyCost);
                    const effUpper = e.monthlyEfficiencyUpper ?? (e.monthlyCost > 0 ? incomeUpper / e.monthlyCost : 0);
                    const effLower = e.monthlyEfficiencyLower ?? (e.monthlyCost > 0 ? incomeLower / e.monthlyCost : 0);
                    const yrEffUpper = e.yearlyEfficiencyUpper ?? e.yearlyEfficiency;
                    const yrEffLower = e.yearlyEfficiencyLower ?? e.yearlyEfficiency;
                    const yrContribUpper = e.yearlyContributionUpper ?? ((e.yearlyIncomeUpper ?? e.yearlyIncome) - e.yearlyCost);
                    const yrContribLower = e.yearlyContributionLower ?? ((e.yearlyIncomeLower ?? e.yearlyIncome) - e.yearlyCost);
                    const tierUpper = e.tierUpper || e.tier || 'C';
                    const tierLower = e.tierLower || e.tier || 'C';
                    const isCashExpanded = expandedProdCashRows.has(e.userId);

                    return (
                      <React.Fragment key={e.userId}>
                        {/* 主口径行：产兑包（虚拟） */}
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td rowSpan={isCashExpanded ? 2 : 1} className="py-2.5 px-4 text-left whitespace-nowrap align-top">
                            <div className="font-medium text-xs text-slate-900">{e.userName}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{e.category} · <span className="font-mono">{e.userId}</span></div>
                          </td>
                          <td className="py-2.5 px-3 text-left whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-700">产兑包(虚拟)</span>
                              <button
                                type="button"
                                onClick={() => toggleProdCashRow(e.userId)}
                                className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
                                title={isCashExpanded ? '收起现金口径行' : '展开现金口径行'}
                              >
                                {isCashExpanded ? '收起现金 ▲' : '+现金口径'}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-900">
                            {formatAmount(incomeUpper)}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap align-top">
                            <div className="flex flex-col items-end w-full min-w-[120px]">
                              <div className="flex items-center justify-end gap-1.5 w-full">
                                <span className="font-mono text-xs text-slate-900">{maskMoney(e.monthlyCost)}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleCost(e.userId)}
                                  className="text-slate-400 hover:text-slate-700 transition-colors flex items-center text-[11px]"
                                >
                                  明细 {expandedCosts.has(e.userId) ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                                </button>
                              </div>
                              {expandedCosts.has(e.userId) && renderCostBreakdown(e)}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                            <span className={contribUpper >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                              {contribUpper > 0 ? `+${formatAmount(contribUpper)}` : formatAmount(contribUpper)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                            <span className={effUpper >= 1.2 ? 'text-slate-900' : 'text-rose-600'}>
                              {formatRatio(effUpper)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                            <span className={yrContribUpper >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                              {yrContribUpper > 0 ? `+${formatAmount(yrContribUpper)}` : formatAmount(yrContribUpper)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                            <span className={yrEffUpper >= 1.2 ? 'text-slate-900' : 'text-rose-600'}>
                              {formatRatio(yrEffUpper)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span
                              title={getTierFullText(tierUpper)}
                              className={`inline-block px-2 py-0.5 text-xs font-medium rounded border cursor-help ${getTierBadgeClass(tierUpper)}`}
                            >
                              {tierUpper} 档
                            </span>
                          </td>
                        </tr>

                        {/* 展开次行：产兑包（现金），共享主行成本明细开关 */}
                        {isCashExpanded && (
                          <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-left whitespace-nowrap">
                              <span className="text-xs text-slate-500">产兑包(现金)</span>
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-700">
                              {formatAmount(incomeLower)}
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-400">
                              {maskMoney(e.monthlyCost)}
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs">
                              <span className={contribLower >= 0 ? 'text-slate-700' : 'text-rose-600'}>
                                {contribLower > 0 ? `+${formatAmount(contribLower)}` : formatAmount(contribLower)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                              <span className={effLower >= 1.2 ? 'text-slate-700' : 'text-rose-600'}>
                                {formatRatio(effLower)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs">
                              <span className={yrContribLower >= 0 ? 'text-slate-700' : 'text-rose-600'}>
                                {yrContribLower > 0 ? `+${formatAmount(yrContribLower)}` : formatAmount(yrContribLower)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                              <span className={yrEffLower >= 1.2 ? 'text-slate-700' : 'text-rose-600'}>
                                {formatRatio(yrEffLower)}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-center whitespace-nowrap">
                              <span
                                title={getTierFullText(tierLower)}
                                className={`inline-block px-2 py-0.5 text-xs font-medium rounded border cursor-help ${getTierBadgeClass(tierLower)}`}
                              >
                                {tierLower} 档
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  // 款专 (单行)
                  const kuanTier = e.tier || 'C';
                  const yrContrib = e.yearlyContribution ?? (e.yearlyIncome - e.yearlyCost);
                  return (
                    <tr key={e.userId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-left whitespace-nowrap align-top">
                        <div className="font-medium text-xs text-slate-900">{e.userName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{e.category} · <span className="font-mono">{e.userId}</span></div>
                      </td>
                      <td className="py-2.5 px-3 text-left whitespace-nowrap">
                        <span className="text-xs text-slate-600">当期收款包</span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-900">
                        {formatAmount(e.monthlyIncome)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap align-top">
                        <div className="flex flex-col items-end w-full min-w-[120px]">
                          <div className="flex items-center justify-end gap-1.5 w-full">
                            <span className="font-mono text-xs text-slate-900">{maskMoney(e.monthlyCost)}</span>
                            <button
                              type="button"
                              onClick={() => toggleCost(e.userId)}
                              className="text-slate-400 hover:text-slate-700 transition-colors flex items-center text-[11px]"
                            >
                              明细 {expandedCosts.has(e.userId) ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                            </button>
                          </div>
                          {expandedCosts.has(e.userId) && renderCostBreakdown(e)}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                        <span className={e.contribution >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                          {e.contribution > 0 ? `+${formatAmount(e.contribution)}` : formatAmount(e.contribution)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                        <span className={e.monthlyEfficiency >= 1.2 ? 'text-slate-900' : 'text-rose-600'}>
                          {formatRatio(e.monthlyEfficiency)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs">
                        <span className={yrContrib >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                          {yrContrib > 0 ? `+${formatAmount(yrContrib)}` : formatAmount(yrContrib)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono text-xs font-medium">
                        <span className={e.yearlyEfficiency >= 1.2 ? 'text-slate-900' : 'text-rose-600'}>
                          {formatRatio(e.yearlyEfficiency)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span
                          title={getTierFullText(kuanTier)}
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded border cursor-help ${getTierBadgeClass(kuanTier)}`}
                        >
                          {kuanTier} 档
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Evaluation;

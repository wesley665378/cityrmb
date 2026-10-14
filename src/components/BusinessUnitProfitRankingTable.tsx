import React, { useState, useMemo, useEffect } from 'react';
import { User, ValueCreationLog, MiningResource, InternalTransaction } from '../../types';
import { computeBusinessUnitProfitRanking, UnitRankingRow } from '../utils/businessUnitProfitRanking';
import { useCostPrivacy } from '../hooks/useCostPrivacy';
import { CostPrivacyToggle } from './CostPrivacyToggle';
import { formatMoney } from '../utils/formatMoney';
import { Card } from './UI';
import { UI_TOKENS } from '../constants/uiTokens';
import { 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown
} from 'lucide-react';

export interface BusinessUnitProfitRankingTableProps {
  units: string[];
  selectedMonth: string; // YYYY-MM
  users: User[];
  auditLogs: ValueCreationLog[];
  logs?: ValueCreationLog[];
  resources: MiningResource[];
  transactions: InternalTransaction[];
  currentUser?: User;
  startDate?: string;
  endDate?: string;
  defaultExpanded?: boolean;
}

export type RankingSortField = 
  | 'rank'
  | 'unitName'
  | 'managers'
  | 'revenuePackage'
  | 'confirmedValuePackage'
  | 'incomeValuePackage'
  | 'costPackage'
  | 'monthlyProfit'
  | 'yearlyProfit';

export const BusinessUnitProfitRankingTable: React.FC<BusinessUnitProfitRankingTableProps> = ({
  units,
  selectedMonth,
  users,
  auditLogs,
  logs,
  resources,
  transactions,
  startDate,
  endDate,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewMode, setViewMode] = useState<'cash' | 'virtual'>('cash');
  const [sortField, setSortField] = useState<RankingSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  // 复选框多选状态
  const [selectedUnitNames, setSelectedUnitNames] = useState<string[]>([]);

  const { maskMoney } = useCostPrivacy();

  // 1. 流水注入：若 auditLogs 为空，回退到 logs
  const effectiveAuditLogs = useMemo(() => {
    return (auditLogs?.length ? auditLogs : logs) || [];
  }, [auditLogs, logs]);

  // 2. 原始计算榜单数据 (CFO 主表口径)
  const calculatedRankingRows = useMemo(() => {
    return computeBusinessUnitProfitRanking(
      units,
      selectedMonth,
      users,
      effectiveAuditLogs,
      resources,
      transactions,
      startDate,
      endDate
    );
  }, [units, selectedMonth, users, effectiveAuditLogs, resources, transactions, startDate, endDate]);

  // 3. 动态计算视图下各列的真实渲染数值（计算公式完全保持现有逻辑不变）
  // 现金视图 vs 虚拟视图：
  // 现金视图：
  //   收款包 = revenuePackage
  //   产兑包 = confirmedValuePackage (现金)
  //   收产包 = incomeValuePackage (= 收款包 + 产兑包)
  //   成本包 = costPackage
  //   月损益 = monthlyProfit (= 收产包 - 成本包)
  //   年损益 = yearlyProfit (= 当年累计收产包 - 累计成本包)
  // 虚拟视图：
  //   收款包 = revenuePackage
  //   产兑包 = confirmedValuePackage + inTransitValuePackage (虚拟产兑包)
  //   成本包 = costPackage
  //   月损益 = inTransitMonthlyProfit (= 虚拟收产包 - 成本包)
  //   年损益 = inTransitYearlyProfit ?? (yearlyProfit + inTransitValuePackage)
  const rowsWithViewData = useMemo(() => {
    return calculatedRankingRows.map(row => {
      if (viewMode === 'cash') {
        const rev = row.revenuePackage || 0;
        const val = row.confirmedValuePackage || 0;
        const inc = row.incomeValuePackage ?? (rev + val);
        const cost = row.costPackage ?? row.totalCostOffset ?? 0;
        const mProfit = row.monthlyProfit ?? (inc - cost);
        const yProfit = row.yearlyProfit || 0;

        return {
          ...row,
          displayRevenue: rev,
          displayValue: val,
          displayIncome: inc,
          displayCost: cost,
          displayMonthlyProfit: mProfit,
          displayYearlyProfit: yProfit,
        };
      } else {
        // 虚拟收产包视图
        const rev = row.revenuePackage || 0;
        const inTransitVal = row.inTransitValuePackage || 0;
        const val = (row.confirmedValuePackage || 0) + inTransitVal; // 虚拟产兑包 = 确认产兑 + 在途产兑
        const inc = row.inTransitIncomePackage ?? (row.incomeValuePackage + inTransitVal); // 虚拟收产包 = 现金收产包 + 在途产兑
        const cost = row.costPackage ?? row.totalCostOffset ?? 0;
        const mProfit = row.inTransitMonthlyProfit ?? (inc - cost); // 虚拟月损益 = 虚拟收产包 - 成本包
        const yProfit = row.inTransitYearlyProfit ?? ((row.yearlyProfit || 0) + inTransitVal);

        return {
          ...row,
          displayRevenue: rev,
          displayValue: val,
          displayIncome: inc,
          displayCost: cost,
          displayMonthlyProfit: mProfit,
          displayYearlyProfit: yProfit,
        };
      }
    });
  }, [calculatedRankingRows, viewMode]);

  // 4. 排序处理
  const sortedRows = useMemo(() => {
    const list = [...rowsWithViewData];

    // 默认排序 (若无自定义排序，按 displayMonthlyProfit 降序)
    if (!sortField || !sortOrder) {
      list.sort((a, b) => b.displayMonthlyProfit - a.displayMonthlyProfit);
      return list.map((r, idx) => ({ ...r, displayRank: idx + 1 }));
    }

    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 'rank':
          valA = typeof a.rank === 'number' ? a.rank : 999999;
          valB = typeof b.rank === 'number' ? b.rank : 999999;
          break;
        case 'unitName':
          valA = a.unitName || '';
          valB = b.unitName || '';
          break;
        case 'managers':
          valA = a.managers || '';
          valB = b.managers || '';
          break;
        case 'revenuePackage':
          valA = a.displayRevenue;
          valB = b.displayRevenue;
          break;
        case 'confirmedValuePackage':
          valA = a.displayValue;
          valB = b.displayValue;
          break;
        case 'incomeValuePackage':
          valA = a.displayIncome;
          valB = b.displayIncome;
          break;
        case 'costPackage':
          valA = a.displayCost;
          valB = b.displayCost;
          break;
        case 'monthlyProfit':
          valA = a.displayMonthlyProfit;
          valB = b.displayMonthlyProfit;
          break;
        case 'yearlyProfit':
          valA = a.displayYearlyProfit;
          valB = b.displayYearlyProfit;
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

    return list.map((r, idx) => ({ ...r, displayRank: idx + 1 }));
  }, [rowsWithViewData, sortField, sortOrder]);

  const handleSort = (field: RankingSortField) => {
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
      setSortOrder(field === 'rank' || field === 'unitName' || field === 'managers' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (field: RankingSortField) => {
    const isActive = sortField === field;
    if (!isActive) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300 opacity-60 group-hover:opacity-100 group-hover:text-slate-500 transition-opacity shrink-0" />;
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1 text-blue-600 font-bold shrink-0" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1 text-blue-600 font-bold shrink-0" />;
  };

  const formatAmount = (val: number | null, isCostField = false) => {
    if (val === null || val === undefined) return '—';
    if (isCostField) {
      return maskMoney(val);
    }
    return formatMoney(val);
  };

  // 多选逻辑
  const isAllSelected = useMemo(() => {
    if (sortedRows.length === 0) return false;
    return sortedRows.every(r => selectedUnitNames.includes(r.unitName));
  }, [sortedRows, selectedUnitNames]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUnitNames([]);
    } else {
      setSelectedUnitNames(sortedRows.map(r => r.unitName));
    }
  };

  const toggleSelectRow = (unitName: string) => {
    setSelectedUnitNames(prev => 
      prev.includes(unitName)
        ? prev.filter(name => name !== unitName)
        : [...prev, unitName]
    );
  };

  return (
    <Card className={`${UI_TOKENS.RADIUS_PANEL} bg-white border border-slate-100 shadow-xl overflow-hidden transition-all duration-300`}>
      {/* 顶部工具栏与折叠控制 */}
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* 左侧：标题与视图切换按钮 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 保留页面标题 */}
            <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
              经营单元排名
            </h3>

            {/* 一.1 & 2: 双视图切换按钮 */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-inner">
              <button
                onClick={() => setViewMode('cash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cash'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
                title="切换至现金收产包视图"
              >
                现金收产包视图
              </button>
              <button
                onClick={() => setViewMode('virtual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'virtual'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
                title="切换至虚拟收产包视图"
              >
                虚拟收产包视图
              </button>
            </div>

            {/* 四.3: 筛选时间标签 */}
            <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
              筛选：{startDate && endDate ? `${startDate} 至 ${endDate}` : selectedMonth}
            </span>

            {/* 排序重置状态 */}
            {sortField && (
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold flex items-center gap-1 whitespace-nowrap">
                按 [{sortField}] {sortOrder === 'asc' ? '升序' : '降序'}
                <button
                  onClick={() => {
                    setSortField(null);
                    setSortOrder(null);
                  }}
                  className="ml-1 text-blue-400 hover:text-blue-800 font-bold cursor-pointer"
                  title="重置排序"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          {/* 右侧：保留脱敏明文显示与展开/折叠按钮 */}
          <div className="flex items-center gap-2.5">
            {/* 四.2: 脱敏明文显示开关 */}
            <CostPrivacyToggle size="sm" />

            {/* 四.2: 折叠/展开按纽 */}
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all flex items-center space-x-1 cursor-pointer h-9"
            >
              <span className="text-xs font-black px-1">{isExpanded ? '折叠' : '展开'}</span>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 四.5: 横向滚动与自适应表格 */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-6 md:p-8 space-y-6 animate-fadeIn">
          {/* 表格容器加横向滚动 (overflow-x: auto) */}
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {/* 四.4: 复选框列 */}
                  <th className="py-4 px-3 text-center w-10 whitespace-nowrap rounded-tl-xl select-none">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      title="全选 / 取消全选"
                    />
                  </th>

                  {/* 排名 */}
                  <th 
                    onClick={() => handleSort('rank')}
                    className="group py-4 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-center">
                      排名 {renderSortIcon('rank')}
                    </span>
                  </th>

                  {/* 经营单元 (统一文案) */}
                  <th 
                    onClick={() => handleSort('unitName')}
                    className="group py-4 px-4 text-left whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center">
                      经营单元 {renderSortIcon('unitName')}
                    </span>
                  </th>

                  {/* 负责人 */}
                  <th 
                    onClick={() => handleSort('managers')}
                    className="group py-4 px-4 text-left whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center">
                      负责人 {renderSortIcon('managers')}
                    </span>
                  </th>

                  {/* 收款包 */}
                  <th 
                    onClick={() => handleSort('revenuePackage')}
                    className="group py-4 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      收款包 {renderSortIcon('revenuePackage')}
                    </span>
                  </th>

                  {/* 产兑包 */}
                  <th 
                    onClick={() => handleSort('confirmedValuePackage')}
                    className="group py-4 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      产兑包 {renderSortIcon('confirmedValuePackage')}
                    </span>
                  </th>

                  {/* 收产包 (仅现金收产包视图展示，虚拟视图不显示) */}
                  {viewMode === 'cash' && (
                    <th 
                      onClick={() => handleSort('incomeValuePackage')}
                      className="group py-4 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                      title="点击排序"
                    >
                      <span className="inline-flex items-center justify-end w-full">
                        收产包 {renderSortIcon('incomeValuePackage')}
                      </span>
                    </th>
                  )}

                  {/* 成本包 */}
                  <th 
                    onClick={() => handleSort('costPackage')}
                    className="group py-4 px-3 text-right text-rose-600 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      成本包 {renderSortIcon('costPackage')}
                    </span>
                  </th>

                  {/* 月损益 */}
                  <th 
                    onClick={() => handleSort('monthlyProfit')}
                    className="group py-4 px-3 text-right text-blue-600 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      月损益 {renderSortIcon('monthlyProfit')}
                    </span>
                  </th>

                  {/* 年损益 */}
                  <th 
                    onClick={() => handleSort('yearlyProfit')}
                    className={`group py-4 px-3 text-right text-indigo-600 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none rounded-tr-xl`}
                    title="点击排序"
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      年损益 {renderSortIcon('yearlyProfit')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === 'cash' ? 10 : 9} className="py-8 text-center text-slate-400 font-sans">
                      暂无符合条件的经营单元数据
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    const isSelected = selectedUnitNames.includes(row.unitName);

                    return (
                      <tr 
                        key={row.unitName} 
                        className={`transition-colors border-b border-slate-200/60 ${
                          isSelected ? 'bg-blue-50/50 hover:bg-blue-50/70' : isEven ? 'bg-white' : 'bg-slate-50/30'
                        } hover:bg-blue-50/30 group`}
                      >
                        {/* 四.4: 复选框 */}
                        <td className="py-4 px-3 align-middle text-center w-10 whitespace-nowrap border-r border-slate-100">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.unitName)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* 排名 */}
                        <td className="py-4 px-3 align-middle border-r border-slate-100 text-center font-black whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black shadow-2xs ${
                            row.displayRank === 1 ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300' :
                            row.displayRank === 2 ? 'bg-slate-200 text-slate-800' :
                            row.displayRank === 3 ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {row.displayRank}
                          </span>
                        </td>

                        {/* 经营单元 */}
                        <td className="py-4 px-4 align-middle border-r border-slate-100 font-black text-slate-900 whitespace-nowrap font-sans max-w-[200px]">
                          <div className="flex items-center space-x-2" title={row.unitName}>
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            <span className="text-sm font-black truncate">{row.unitName}</span>
                          </div>
                        </td>

                        {/* 负责人 */}
                        <td className="py-4 px-4 align-middle border-r border-slate-100 text-slate-600 font-bold whitespace-nowrap font-sans max-w-[180px]">
                          <div title={row.managers} className="truncate">{row.managers}</div>
                        </td>

                        {/* 收款包 */}
                        <td className="py-4 px-3 align-middle text-right font-bold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                          {formatAmount(row.displayRevenue)}
                        </td>

                        {/* 产兑包 */}
                        <td className="py-4 px-3 align-middle text-right font-bold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                          {formatAmount(row.displayValue)}
                        </td>

                        {/* 收产包 (仅现金视图) */}
                        {viewMode === 'cash' && (
                          <td className="py-4 px-3 align-middle text-right font-black text-slate-900 border-r border-slate-100 whitespace-nowrap bg-slate-50/20">
                            {formatAmount(row.displayIncome)}
                          </td>
                        )}

                        {/* 成本包 */}
                        <td className="py-4 px-3 align-middle text-right font-bold text-rose-600 border-r border-slate-100 whitespace-nowrap">
                          {formatAmount(row.displayCost, true)}
                        </td>

                        {/* 月损益 */}
                        <td className="py-4 px-3 align-middle text-right font-black text-blue-600 border-r border-slate-100 whitespace-nowrap bg-blue-50/10 text-sm">
                          {formatAmount(row.displayMonthlyProfit)}
                        </td>

                        {/* 年损益 */}
                        <td className="py-4 px-3 align-middle text-right font-black text-indigo-600 border-r border-slate-100 whitespace-nowrap">
                          {formatAmount(row.displayYearlyProfit)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 表格底部统计 */}
          <div className="text-xs text-slate-500 font-sans flex items-center justify-between px-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">已选中: {selectedUnitNames.length} 项</span>
              {selectedUnitNames.length > 0 && (
                <button
                  onClick={() => setSelectedUnitNames([])}
                  className="text-blue-600 hover:underline cursor-pointer text-xs"
                >
                  取消全选
                </button>
              )}
            </div>
            <div className="font-mono text-slate-400">
              共 {sortedRows.length} 个经营单元
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

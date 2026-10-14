/**
 * 城市守护者 · 前端术语 SSOT 常量表 (Single Source of Truth)
 * 涵盖：价值评价、价值确权、价值流转沙盘、矿山资源、人事权限、通用模块以及历史废弃文案
 */

export type TermGroupKey = 'all' | 'evaluation' | 'confirm' | 'sandbox' | 'mine' | 'perm' | 'common';

export interface TermGroupMeta {
  key: TermGroupKey;
  label: string;          // 显示标签
  name: string;           // 分组名
  color: string;          // 文本色
  bgColor: string;        // 背景色
  borderColor: string;    // 边框色
  badgeColor: string;     // 徽章组合样式
  description: string;    // 组别口径范畴
}

export const TERM_GROUPS: Record<string, TermGroupMeta> = {
  all: {
    key: 'all',
    label: '全部分组',
    name: '全部分组',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    description: '系统内全部已登记标准术语与业务口径'
  },
  evaluation: {
    key: 'evaluation',
    label: '价值评价',
    name: '价值评价模块',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: '多维综合贡献、月/年绩效效率度量与星级评定'
  },
  confirm: {
    key: 'confirm',
    label: '价值确权',
    name: '价值确权模块',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: '收款、产值、联动及消耗确权双轨核验与入库'
  },
  sandbox: {
    key: 'sandbox',
    label: '价值流转沙盘',
    name: '价值流转沙盘模块',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: '六元水库调控、推演模拟与资金资产流转协同'
  },
  mine: {
    key: 'mine',
    label: '矿山资源',
    name: '矿山资源模块',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: '矿山编号、收款/产值容量、对冲折减与资产基石'
  },
  perm: {
    key: 'perm',
    label: '人事权限',
    name: '人事权限模块',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: '人事矩阵、用户角色、安全凭证与业务授权'
  },
  common: {
    key: 'common',
    label: '通用模块',
    name: '通用系统模块',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: '经营看板、动态消耗、内部交易、价值分配与全平台基础'
  }
};

export const TERM_CATEGORIES = [
  '全部',
  '业务模块',
  '核心维度',
  '确权状态',
  '对冲计算',
  '人员角色',
  '其他'
] as const;

export interface TermItem {
  id: string;
  term_key: string;              // 模块前缀 + 全大写下划线（如 EVAL_MONTH_CONTRIBUTION）
  term_value: string;            // 标准文案
  term_group: TermGroupKey;      // evaluation / confirm / sandbox / mine / perm / common
  description: string;           // 口径说明
  status: 'active' | 'deprecated' | 'disabled'; // 状态: active(正常启用) | deprecated(已废弃) | disabled(停用)
  sort_order: number;            // 排序序号
  // 兼容字段（保证系统其他模块无缝调用）
  key: string;
  name: string;
  category: string;
  updatedAt: string;
  deprecated?: boolean;
}

export type Term = TermItem;

export interface TermChangeLog {
  id: string;
  termKey: string;
  termName: string;
  action: 'create' | 'update' | 'enable' | 'disable' | 'delete';
  operator: string;
  timestamp: string;
  details: string;
}

/**
 * 完整标准活跃术语定义列表
 */
export const ACTIVE_TERMS_LIST: TermItem[] = [
  // 1. evaluation (价值评价)
  {
    id: 't_eval_title',
    term_key: 'EVAL_MODULE_TITLE',
    term_value: '价值评价',
    term_group: 'evaluation',
    description: '多维综合价值评价体系，用于全面度量经营单元与成员的综合绩效与贡献成果。',
    status: 'active',
    sort_order: 10,
    key: 'value_evaluation',
    name: '价值评价',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_month_contrib',
    term_key: 'EVAL_MONTH_CONTRIBUTION',
    term_value: '月度贡献值',
    term_group: 'evaluation',
    description: '当月收产包减去当期成本包的月度净贡献额度。',
    status: 'active',
    sort_order: 11,
    key: 'monthly_contribution',
    name: '月度贡献值',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_year_contrib',
    term_key: 'EVAL_YEAR_CONTRIBUTION',
    term_value: '年度贡献值',
    term_group: 'evaluation',
    description: '当年累计收产包减去当年累计成本包（历史非标旧称「年损益」）。',
    status: 'active',
    sort_order: 12,
    key: 'yearly_contribution',
    name: '年度贡献值',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_month_eff',
    term_key: 'EVAL_MONTH_EFFICIENCY',
    term_value: '月效率',
    term_group: 'evaluation',
    description: '月度收产包与月度成本包的比值（>2.5 卓越，>=1.5 进取，>=1.2 稳健）。',
    status: 'active',
    sort_order: 13,
    key: 'monthly_efficiency',
    name: '月效率',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_year_eff',
    term_key: 'EVAL_YEAR_EFFICIENCY',
    term_value: '年效率',
    term_group: 'evaluation',
    description: '当年累计收产包与当年累计成本包的投入产出比值。',
    status: 'active',
    sort_order: 14,
    key: 'yearly_efficiency',
    name: '年效率',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_star',
    term_key: 'EVAL_STAR_RATING',
    term_value: '星级评估',
    term_group: 'evaluation',
    description: '基于综合贡献与投入产出效率的多维量化星级评定（1~5星）。',
    status: 'active',
    sort_order: 15,
    key: 'star_rating',
    name: '星级评估',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_income_pkg',
    term_key: 'EVAL_INCOME_PACKAGE',
    term_value: '收产包',
    term_group: 'evaluation',
    description: '实收现金流提炼（收款包）与已确权产值提炼（产兑包）的合并净值（Income & Value Package）。',
    status: 'active',
    sort_order: 16,
    key: 'income_package',
    name: '收产包',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_cost_pkg',
    term_key: 'EVAL_COST_PACKAGE',
    term_value: '成本包',
    term_group: 'evaluation',
    description: '人员工资、日常开销及动态对冲分摊的综合成本汇总。',
    status: 'active',
    sort_order: 17,
    key: 'cost_package',
    name: '成本包',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_deficit_sub',
    term_key: 'EVAL_DEFICIT_SUBSIDY',
    term_value: '缺口补足',
    term_group: 'evaluation',
    description: '收产包不足以抵扣成本包时的组织抗风险调控机制。',
    status: 'active',
    sort_order: 18,
    key: 'deficit_subsidy',
    name: '缺口补足',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_audit_eff',
    term_key: 'EVAL_EFFICIENCY_AUDIT',
    term_value: '效率审计',
    term_group: 'evaluation',
    description: '对经营单元与采集主体投入产出比的全面量化复核。',
    status: 'active',
    sort_order: 19,
    key: 'efficiency_audit',
    name: '效率审计',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_perf_score',
    term_key: 'EVAL_PERF_SCORE',
    term_value: '绩效评分',
    term_group: 'evaluation',
    description: '综合效率、贡献度与项目执行质量的加权量化评分。',
    status: 'active',
    sort_order: 20,
    key: 'performance_score',
    name: '绩效评分',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_eval_lean',
    term_key: 'EVAL_RESOURCE_LEANING',
    term_value: '资源倾斜',
    term_group: 'evaluation',
    description: '优先资源调配机制，保障高价值卓越单元的扩张与激励。',
    status: 'active',
    sort_order: 21,
    key: 'resource_leaning',
    name: '资源倾斜',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },

  // 2. confirm (价值确权)
  {
    id: 't_confirm_title',
    term_key: 'CONFIRM_MODULE_TITLE',
    term_value: '价值确权',
    term_group: 'confirm',
    description: '提炼价值与收益的合规核验通道，负责双轨溯源与确权审批（历史旧称「确权审核」）。',
    status: 'active',
    sort_order: 30,
    key: 'value_audit',
    name: '价值确权',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_rev_audit',
    term_key: 'CONFIRM_REVENUE_AUDIT',
    term_value: '收款确权',
    term_group: 'confirm',
    description: '企业实际款项现金流提炼的凭据审核与入库。',
    status: 'active',
    sort_order: 31,
    key: 'revenue_audit',
    name: '收款确权',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_link_audit',
    term_key: 'CONFIRM_LINKED_AUDIT',
    term_value: '联动确权',
    term_group: 'confirm',
    description: '产值提炼与收款进度绑定的系统自动化核验通道（历史旧称「自动确权」）。',
    status: 'active',
    sort_order: 32,
    key: 'linked_audit',
    name: '联动确权',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_cost_audit',
    term_key: 'CONFIRM_CONSUMPTION_AUDIT',
    term_value: '消耗确权',
    term_group: 'confirm',
    description: '动态对冲费用与内部服务成本冲减的核销审核。',
    status: 'active',
    sort_order: 33,
    key: 'consumption_audit',
    name: '消耗确权',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_st_confirmed',
    term_key: 'CONFIRM_STATUS_CONFIRMED',
    term_value: '已确权',
    term_group: 'confirm',
    description: '核验已通过并已记入当期收产包损益的正常状态。',
    status: 'active',
    sort_order: 34,
    key: 'status_confirmed',
    name: '已确权',
    category: '确权状态',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_st_pending',
    term_key: 'CONFIRM_STATUS_PENDING',
    term_value: '待确权',
    term_group: 'confirm',
    description: '已提交申报但尚未完成核验审批的在途流水状态。',
    status: 'active',
    sort_order: 35,
    key: 'status_pending',
    name: '待确权',
    category: '确权状态',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_st_rejected',
    term_key: 'CONFIRM_STATUS_REJECTED',
    term_value: '已驳回',
    term_group: 'confirm',
    description: '核验不合规或数据有误已被退回重报的单据。',
    status: 'active',
    sort_order: 36,
    key: 'status_rejected',
    name: '已驳回',
    category: '确权状态',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_records',
    term_key: 'CONFIRM_RECORD_LIST',
    term_value: '确权记录',
    term_group: 'confirm',
    description: '全平台已通过核验并转入当期损益的历史确权流水归档。',
    status: 'active',
    sort_order: 37,
    key: 'audit_records',
    name: '确权记录',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_rev_pkg',
    term_key: 'CONFIRM_REVENUE_PACKAGE',
    term_value: '收款包',
    term_group: 'confirm',
    description: '实收现金流提炼经合规核验入库的现金净值（严禁错写为「收户包」）。',
    status: 'active',
    sort_order: 38,
    key: 'revenue_package',
    name: '收款包',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_val_pkg',
    term_key: 'CONFIRM_VALUE_PACKAGE',
    term_value: '产兑包',
    term_group: 'confirm',
    description: '已核验入库的产值折算兑现额度（不含联动待确权部分）。',
    status: 'active',
    sort_order: 39,
    key: 'value_package',
    name: '产兑包',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_dual_track',
    term_key: 'CONFIRM_DUAL_TRACK',
    term_value: '双轨核验',
    term_group: 'confirm',
    description: '收款轨（资金到账）与产值轨（履约交付）并行独立的闭环确权机制。',
    status: 'active',
    sort_order: 40,
    key: 'dual_track_audit',
    name: '双轨核验',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_confirm_storage',
    term_key: 'CONFIRM_STORAGE_TIME',
    term_value: '预计入库',
    term_group: 'confirm',
    description: '流水单据预计核验生效并计入报表的时间节点。',
    status: 'active',
    sort_order: 41,
    key: 'storage_time',
    name: '预计入库',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },

  // 3. sandbox (价值流转沙盘)
  {
    id: 't_sandbox_title',
    term_key: 'SANDBOX_MODULE_TITLE',
    term_value: '价值流转沙盘',
    term_group: 'sandbox',
    description: '六元水库资金与资产跨单元调配与推演中心（历史旧称「交易流转」）。',
    status: 'active',
    sort_order: 50,
    key: 'value_flow_sandbox',
    name: '价值流转沙盘',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_six_res',
    term_key: 'SANDBOX_SIX_RESERVOIRS',
    term_value: '六元水库',
    term_group: 'sandbox',
    description: '由蓄水池、刚性池、统筹池、研发池、激励池与风险池组成的循环水库体系。',
    status: 'active',
    sort_order: 51,
    key: 'six_reservoirs',
    name: '六元水库',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_cap_pool',
    term_key: 'SANDBOX_CAPITAL_POOL',
    term_value: '资金水库',
    term_group: 'sandbox',
    description: '全平台沉淀收益与可调配流动资金的总蓄水池。',
    status: 'active',
    sort_order: 52,
    key: 'capital_reservoir',
    name: '资金水库',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_rigid_pool',
    term_key: 'SANDBOX_RIGID_SALARY_POOL',
    term_value: '刚性工资池',
    term_group: 'sandbox',
    description: '保障全员基本薪资与法定刚性底线支出的专用蓄水储备池。',
    status: 'active',
    sort_order: 53,
    key: 'rigid_salary_pool',
    name: '刚性工资池',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_plan_pool',
    term_key: 'SANDBOX_OVERALL_PLAN_POOL',
    term_value: '统筹池',
    term_group: 'sandbox',
    description: '组织级公共资源协同与亏损单元兜底支撑调控池。',
    status: 'active',
    sort_order: 54,
    key: 'overall_plan_pool',
    name: '统筹池',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_buffer_res',
    term_key: 'SANDBOX_BUFFER_RESERVOIR',
    term_value: '蓄水池',
    term_group: 'sandbox',
    description: '平抑经营月度波动与盈亏周期的组织级抗风险缓冲水池。',
    status: 'active',
    sort_order: 55,
    key: 'buffer_reservoir',
    name: '蓄水池',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_sim',
    term_key: 'SANDBOX_FLOW_SIMULATION',
    term_value: '流转推演',
    term_group: 'sandbox',
    description: '基于沙盘数学模型的跨单元资金流转、额度模拟与抗压试算。',
    status: 'active',
    sort_order: 56,
    key: 'flow_simulation',
    name: '流转推演',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_cb',
    term_key: 'SANDBOX_CIRCUIT_BREAKER',
    term_value: '熔断保护',
    term_group: 'sandbox',
    description: '防止超额借调或资源过载透支的系统强制阻断机制。',
    status: 'active',
    sort_order: 57,
    key: 'circuit_breaker',
    name: '熔断保护',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_metrics',
    term_key: 'SANDBOX_WATER_METRICS',
    term_value: '水位指标',
    term_group: 'sandbox',
    description: '度量各水库当前蓄水容量充盈度与流动性安全边界的动态百分比。',
    status: 'active',
    sort_order: 58,
    key: 'water_metrics',
    name: '水位指标',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_sandbox_inject',
    term_key: 'SANDBOX_BOTTOM_SUPPORT',
    term_value: '统筹池兜底',
    term_group: 'sandbox',
    description: '当单元收产包不足以覆盖刚性工资包时，由统筹池定向补足的注资操作。',
    status: 'active',
    sort_order: 59,
    key: 'bottom_support',
    name: '统筹池兜底',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },

  // 4. mine (矿山资源)
  {
    id: 't_mine_title',
    term_key: 'MINE_MODULE_TITLE',
    term_value: '矿山资源',
    term_group: 'mine',
    description: '平台业务与资产基石载体（历史简称「矿山」，已全面规范为「矿山资源」）。',
    status: 'active',
    sort_order: 70,
    key: 'mining_resource',
    name: '矿山资源',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_code',
    term_key: 'MINE_CODE',
    term_value: '矿山编号',
    term_group: 'mine',
    description: '全平台唯一项目/矿山资产数字编码（如 MK-001）。',
    status: 'active',
    sort_order: 71,
    key: 'mining_code',
    name: '矿山编号',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_collector',
    term_key: 'MINE_COLLECTOR',
    term_value: '采集主体',
    term_group: 'mine',
    description: '注入原始积分与提炼价值的业务责任主体（User.id，禁止写职级ID）。',
    status: 'active',
    sort_order: 72,
    key: 'collector',
    name: '采集主体',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_rev_init',
    term_key: 'MINE_REVENUE_INITIAL',
    term_value: '款初',
    term_group: 'mine',
    description: '矿山初始收款净额容量上限（初始配额）。',
    status: 'active',
    sort_order: 73,
    key: 'revenue_initial',
    name: '款初',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_rev_hedged',
    term_key: 'MINE_REVENUE_HEDGED',
    term_value: '款当',
    term_group: 'mine',
    description: '扣减C类对冲折减后的当前实时可用收款容量。',
    status: 'active',
    sort_order: 74,
    key: 'revenue_hedged',
    name: '款当',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_val_init',
    term_key: 'MINE_VALUE_INITIAL',
    term_value: '产初',
    term_group: 'mine',
    description: '矿山初始产值容量上限（初始配额）。',
    status: 'active',
    sort_order: 75,
    key: 'value_initial',
    name: '产初',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_val_hedged',
    term_key: 'MINE_VALUE_HEDGED',
    term_value: '产当',
    term_group: 'mine',
    description: '扣减C类与B2类对冲后的当前实时可用产值容量。',
    status: 'active',
    sort_order: 76,
    key: 'value_hedged',
    name: '产当',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_cw',
    term_key: 'MINE_C_WEIGHT',
    term_value: 'C权',
    term_group: 'mine',
    description: '跨单元或指定矿山对冲折减权重：(N − ΣC) / N。',
    status: 'active',
    sort_order: 77,
    key: 'c_weight',
    name: 'C权',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_b2w',
    term_key: 'MINE_B2_WEIGHT',
    term_value: 'B2权',
    term_group: 'mine',
    description: '产专运维对冲折减权重：(N − ΣC − ΣB2) / (N − ΣC)。',
    status: 'active',
    sort_order: 78,
    key: 'b2_weight',
    name: 'B2权',
    category: '对冲计算',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_status',
    term_key: 'MINE_PROJECT_STATUS',
    term_value: '项目状态',
    term_group: 'mine',
    description: '矿山生命周期状态：运营中、静置中、已封存。',
    status: 'active',
    sort_order: 79,
    key: 'project_status',
    name: '项目状态',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_st_running',
    term_key: 'MINE_STATUS_RUNNING',
    term_value: '运营中',
    term_group: 'mine',
    description: '矿山处于正常业务流转与对冲确权周期。',
    status: 'active',
    sort_order: 80,
    key: 'status_running',
    name: '运营中',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_st_resting',
    term_key: 'MINE_STATUS_RESTING',
    term_value: '静置中',
    term_group: 'mine',
    description: '矿山达到产款平衡或周期性暂停业务注入。',
    status: 'active',
    sort_order: 81,
    key: 'status_resting',
    name: '静置中',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_mine_st_archived',
    term_key: 'MINE_STATUS_ARCHIVED',
    term_value: '已封存',
    term_group: 'mine',
    description: '矿山周期终结，数据固化不可变更。',
    status: 'active',
    sort_order: 82,
    key: 'status_archived',
    name: '已封存',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },

  // 5. perm (人事权限)
  {
    id: 't_perm_title',
    term_key: 'PERM_MODULE_TITLE',
    term_value: '人事矩阵',
    term_group: 'perm',
    description: '人员组织架构、岗位权责与人员库基础信息维护。',
    status: 'active',
    sort_order: 90,
    key: 'personnel_pool',
    name: '人事矩阵',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_login_acc',
    term_key: 'PERM_LOGIN_ACCOUNT',
    term_value: '登录账号',
    term_group: 'perm',
    description: '用户登录认证所使用的平台系统账户标识。',
    status: 'active',
    sort_order: 91,
    key: 'login_account',
    name: '登录账号',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_user_rank',
    term_key: 'PERM_USER_RANK',
    term_value: '职级',
    term_group: 'perm',
    description: '人员专业职级（如初产专、资深产专、款专等）。',
    status: 'active',
    sort_order: 92,
    key: 'user_rank',
    name: '职级',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_biz_unit',
    term_key: 'PERM_BUSINESS_UNIT',
    term_value: '经营单元',
    term_group: 'perm',
    description: '独立核算业务单元（如城安一中心、低空技术中心等）。',
    status: 'active',
    sort_order: 93,
    key: 'business_unit',
    name: '经营单元',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_account',
    term_key: 'PERM_MY_ACCOUNT',
    term_value: '个人中心',
    term_group: 'perm',
    description: '登录用户的个人基本档案、安全凭证与业务配额概览。',
    status: 'active',
    sort_order: 94,
    key: 'my_account',
    name: '个人中心',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_sys_doc',
    term_key: 'PERM_SYS_INSTRUCTIONS',
    term_value: '系统说明',
    term_group: 'perm',
    description: '规则中枢、计算口径标准与操作指南文档中心。',
    status: 'active',
    sort_order: 95,
    key: 'system_instructions',
    name: '系统说明',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_role_admin',
    term_key: 'PERM_ROLE_ADMIN',
    term_value: '系统管理员',
    term_group: 'perm',
    description: '拥有全平台治理、参数配置与熔断应急权限的角色。',
    status: 'active',
    sort_order: 96,
    key: 'role_admin',
    name: '系统管理员',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_role_dir',
    term_key: 'PERM_ROLE_DIRECTOR',
    term_value: '经营单元负责人',
    term_group: 'perm',
    description: '负责本单元经营指标考核、提炼确权申报与内部交易审批。',
    status: 'active',
    sort_order: 97,
    key: 'role_director',
    name: '经营单元负责人',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_role_col',
    term_key: 'PERM_ROLE_COLLECTOR',
    term_value: '采集责任人',
    term_group: 'perm',
    description: '负责一线矿山资源积分注入与业务流水提炼的核心主体。',
    status: 'active',
    sort_order: 98,
    key: 'role_collector',
    name: '采集责任人',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_perm_role_agent',
    term_key: 'PERM_ROLE_AGENT',
    term_value: '智能体帐户',
    term_group: 'perm',
    description: '参与协同流转的自动化服务或虚拟执行角色。',
    status: 'active',
    sort_order: 99,
    key: 'role_agent',
    name: '智能体帐户',
    category: '人员角色',
    updatedAt: '2026-10-13 10:00:00'
  },

  // 6. common (通用模块)
  {
    id: 't_com_dashboard',
    term_key: 'COMMON_DASHBOARD',
    term_value: '经营看板',
    term_group: 'common',
    description: '六元价值循环全景经营驾驶舱（历史旧称「月报盘」）。',
    status: 'active',
    sort_order: 110,
    key: 'business_dashboard',
    name: '经营看板',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_dyn_cost',
    term_key: 'COMMON_DYNAMIC_CONSUMPTION',
    term_value: '动态消耗',
    term_group: 'common',
    description: '刚性工资包冲减与各类项目运营费用的动态对冲管理（历史旧称「对冲消耗」）。',
    status: 'active',
    sort_order: 111,
    key: 'dynamic_consumption',
    name: '动态消耗',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_internal_tx',
    term_key: 'COMMON_INTERNAL_TRANSACTION',
    term_value: '内部交易',
    term_group: 'common',
    description: '经营单元之间的额度借调、服务采购与资源流转结算通道。',
    status: 'active',
    sort_order: 112,
    key: 'internal_transaction',
    name: '内部交易',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_val_dist',
    term_key: 'COMMON_VALUE_DISTRIBUTION',
    term_value: '价值分配',
    term_group: 'common',
    description: '期末分红结算、专家激励包兑现及组织奖金派发。',
    status: 'active',
    sort_order: 113,
    key: 'value_distribution',
    name: '价值分配',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_val_create',
    term_key: 'COMMON_VALUE_CREATION',
    term_value: '价值创造',
    term_group: 'common',
    description: '采集主体注入原始积分并提炼价值的业务申报入口。',
    status: 'active',
    sort_order: 114,
    key: 'value_creation',
    name: '价值创造',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_resv_mgmt',
    term_key: 'COMMON_RESERVOIR_MGMT',
    term_value: '水库管理',
    term_group: 'common',
    description: '六元水库资金与蓄水池调控，提供组织抗风险缓冲垫。',
    status: 'active',
    sort_order: 115,
    key: 'reservoir_management',
    name: '水库管理',
    category: '业务模块',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_in_transit',
    term_key: 'COMMON_IN_TRANSIT_VALUE',
    term_value: '在途产值',
    term_group: 'common',
    description: '已申报但在确权审批流程中尚未完成核验的在途额度。',
    status: 'active',
    sort_order: 116,
    key: 'in_transit_value',
    name: '在途产值',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_sealed',
    term_key: 'COMMON_SEALED_ARCHIVE',
    term_value: '封存归档',
    term_group: 'common',
    description: '期末核算完毕后固化历史数据不可篡改的安全操作。',
    status: 'active',
    sort_order: 117,
    key: 'sealed_archive',
    name: '封存归档',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_cost_priv',
    term_key: 'COMMON_COST_PRIVACY',
    term_value: '成本隐私',
    term_group: 'common',
    description: '敏感财务与成本数据脱敏展示切换开关。',
    status: 'active',
    sort_order: 118,
    key: 'cost_privacy',
    name: '成本隐私',
    category: '其他',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_watermark',
    term_key: 'COMMON_WATERMARK',
    term_value: '安全水印',
    term_group: 'common',
    description: '全系统防泄密动态背景水印保护。',
    status: 'active',
    sort_order: 119,
    key: 'security_watermark',
    name: '安全水印',
    category: '其他',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_export_excel',
    term_key: 'COMMON_EXPORT_EXCEL',
    term_value: '导出Excel',
    term_group: 'common',
    description: '标准表格与报表数据向外部安全电子表格导出的功能。',
    status: 'active',
    sort_order: 120,
    key: 'export_excel',
    name: '导出Excel',
    category: '其他',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_com_biz_date',
    term_key: 'COMMON_BUSINESS_DATE',
    term_value: '业务日期',
    term_group: 'common',
    description: '流水归属的考核月份与财务记账实际生效日期。',
    status: 'active',
    sort_order: 121,
    key: 'business_date',
    name: '业务日期',
    category: '核心维度',
    updatedAt: '2026-10-13 10:00:00'
  },
  {
    id: 't_admin_module',
    term_key: 'ADMIN_MODULE_TITLE',
    term_value: '后台管理',
    term_group: 'common',
    description: '系统后台管理中心，用于统筹资金调控、蓄水池治理与核心平台参数设置。',
    status: 'active',
    sort_order: 122,
    key: 'admin_management',
    name: '后台管理',
    category: '系统管理',
    updatedAt: '2026-10-13 10:00:00'
  }
];

/**
 * 废弃文案列表（严格识别并标记 deprecated）
 */
export const DEPRECATED_TERMS: TermItem[] = [
  {
    id: 'dep_1',
    term_key: 'DEP_MONTHLY_REPORT_PANEL',
    term_value: '月报盘',
    term_group: 'common',
    description: '历史旧称，曾用作月度经营看板或核算盘，现统一规范为「经营看板」或「月度经营总览」。',
    status: 'deprecated',
    sort_order: 201,
    key: 'old_monthly_report',
    name: '月报盘',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_2',
    term_key: 'DEP_YEARLY_PNL',
    term_value: '年损益',
    term_group: 'evaluation',
    description: '历史旧称，当年累计收产包减去成本包，现统一规范为「年度利润」或「年度贡献值」。',
    status: 'deprecated',
    sort_order: 202,
    key: 'old_yearly_pnl',
    name: '年损益',
    category: '核心维度',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_3',
    term_key: 'DEP_MANUAL_AUDIT',
    term_value: '手动确权',
    term_group: 'confirm',
    description: '历史业务旧称，现统一规范为「提炼价值申报」或「人工确权审核」。',
    status: 'deprecated',
    sort_order: 203,
    key: 'old_manual_audit',
    name: '手动确权',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_4',
    term_key: 'DEP_AUTO_AUDIT',
    term_value: '自动确权',
    term_group: 'confirm',
    description: '历史旧称，系统根据规则自动入库核验，现统一规范为「联动确权」或「系统自动核验」。',
    status: 'deprecated',
    sort_order: 204,
    key: 'old_auto_audit',
    name: '自动确权',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_5',
    term_key: 'DEP_REVENUE_RECEIVE_PKG',
    term_value: '收户包',
    term_group: 'confirm',
    description: '历史错别字与非标口径，现统一规范为「收款包」。',
    status: 'deprecated',
    sort_order: 205,
    key: 'old_shouhu_pkg',
    name: '收户包',
    category: '核心维度',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_6',
    term_key: 'DEP_CAPACITY_LIMIT',
    term_value: '容量上限',
    term_group: 'mine',
    description: '历史简称，矿山初始容量上限，现明确细分为「初始收款净额容量 (款初)」与「初始产值容量 (产初)」或「配额上限」。',
    status: 'deprecated',
    sort_order: 206,
    key: 'old_capacity_limit',
    name: '容量上限',
    category: '对冲计算',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_7',
    term_key: 'DEP_MINE_RAW',
    term_value: '矿山',
    term_group: 'mine',
    description: '历史简称，现已全面规范为「矿山资源」。',
    status: 'deprecated',
    sort_order: 207,
    key: 'old_mine_raw',
    name: '矿山',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_8',
    term_key: 'DEP_CONFIRM_AUDIT_OLD',
    term_value: '确权审核',
    term_group: 'confirm',
    description: '历史称谓，现已全面规范为「价值确权」。',
    status: 'deprecated',
    sort_order: 208,
    key: 'old_cost_audit',
    name: '确权审核',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_9',
    term_key: 'DEP_HEDGE_COST_OLD',
    term_value: '对冲消耗',
    term_group: 'common',
    description: '历史称谓，现已全面规范为「动态消耗」。',
    status: 'deprecated',
    sort_order: 209,
    key: 'old_hedge_cost',
    name: '对冲消耗',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_10',
    term_key: 'DEP_TRADE_FLOW_OLD',
    term_value: '交易流转',
    term_group: 'sandbox',
    description: '历史称谓，现已全面规范为「价值流转沙盘」。',
    status: 'deprecated',
    sort_order: 210,
    key: 'old_flow',
    name: '交易流转',
    category: '业务模块',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  },
  {
    id: 'dep_11',
    term_key: 'DEP_RANK_ID_FIELD',
    term_value: '职级ID',
    term_group: 'perm',
    description: '历史存库字段名，实际存采集主体ID，UI禁止使用，统一使用「采集主体」。',
    status: 'deprecated',
    sort_order: 211,
    key: 'old_rank_id',
    name: '职级ID',
    category: '人员角色',
    updatedAt: '2026-10-11 12:00:00',
    deprecated: true
  }
];

/**
 * 全量术语列表（含正常启用与历史废弃）
 */
export const DEFAULT_TERMS_LIST: TermItem[] = [
  ...ACTIVE_TERMS_LIST,
  ...DEPRECATED_TERMS
];

/**
 * 导出 DEFAULT_TERMS 对象（包含所有术语 key-value 映射）
 * 包含全大写标准 Key 与既有驼峰/下划线兼容 Key
 */
export const DEFAULT_TERMS: Record<string, string> = {
  // evaluation
  EVAL_MODULE_TITLE: '价值评价',
  EVAL_MONTH_CONTRIBUTION: '月度贡献值',
  EVAL_YEAR_CONTRIBUTION: '年度贡献值',
  EVAL_MONTH_EFFICIENCY: '月效率',
  EVAL_YEAR_EFFICIENCY: '年效率',
  EVAL_STAR_RATING: '星级评估',
  EVAL_INCOME_PACKAGE: '收产包',
  EVAL_COST_PACKAGE: '成本包',
  EVAL_DEFICIT_SUBSIDY: '缺口补足',
  EVAL_EFFICIENCY_AUDIT: '效率审计',
  EVAL_PERF_SCORE: '绩效评分',
  EVAL_RESOURCE_LEANING: '资源倾斜',

  // confirm
  CONFIRM_MODULE_TITLE: '价值确权',
  CONFIRM_REVENUE_AUDIT: '收款确权',
  CONFIRM_LINKED_AUDIT: '联动确权',
  CONFIRM_CONSUMPTION_AUDIT: '消耗确权',
  CONFIRM_STATUS_CONFIRMED: '已确权',
  CONFIRM_STATUS_PENDING: '待确权',
  CONFIRM_STATUS_REJECTED: '已驳回',
  CONFIRM_RECORD_LIST: '确权记录',
  CONFIRM_REVENUE_PACKAGE: '收款包',
  CONFIRM_VALUE_PACKAGE: '产兑包',
  CONFIRM_DUAL_TRACK: '双轨核验',
  CONFIRM_STORAGE_TIME: '预计入库',

  // sandbox
  SANDBOX_MODULE_TITLE: '价值流转沙盘',
  SANDBOX_SIX_RESERVOIRS: '六元水库',
  SANDBOX_CAPITAL_POOL: '资金水库',
  SANDBOX_RIGID_SALARY_POOL: '刚性工资池',
  SANDBOX_OVERALL_PLAN_POOL: '统筹池',
  SANDBOX_BUFFER_RESERVOIR: '蓄水池',
  SANDBOX_FLOW_SIMULATION: '流转推演',
  SANDBOX_CIRCUIT_BREAKER: '熔断保护',
  SANDBOX_WATER_METRICS: '水位指标',
  SANDBOX_BOTTOM_SUPPORT: '统筹池兜底',

  // mine
  MINE_MODULE_TITLE: '矿山资源',
  MINE_CODE: '矿山编号',
  MINE_COLLECTOR: '采集主体',
  MINE_REVENUE_INITIAL: '款初',
  MINE_REVENUE_HEDGED: '款当',
  MINE_VALUE_INITIAL: '产初',
  MINE_VALUE_HEDGED: '产当',
  MINE_C_WEIGHT: 'C权',
  MINE_B2_WEIGHT: 'B2权',
  MINE_PROJECT_STATUS: '项目状态',
  MINE_STATUS_RUNNING: '运营中',
  MINE_STATUS_RESTING: '静置中',
  MINE_STATUS_ARCHIVED: '已封存',

  // perm
  PERM_MODULE_TITLE: '人事矩阵',
  PERM_LOGIN_ACCOUNT: '登录账号',
  PERM_USER_RANK: '职级',
  PERM_BUSINESS_UNIT: '经营单元',
  PERM_MY_ACCOUNT: '个人中心',
  PERM_SYS_INSTRUCTIONS: '系统说明',
  PERM_ROLE_ADMIN: '系统管理员',
  PERM_ROLE_DIRECTOR: '经营单元负责人',
  PERM_ROLE_COLLECTOR: '采集责任人',
  PERM_ROLE_AGENT: '智能体帐户',

  // common
  COMMON_DASHBOARD: '经营看板',
  COMMON_DYNAMIC_CONSUMPTION: '动态消耗',
  COMMON_INTERNAL_TRANSACTION: '内部交易',
  COMMON_VALUE_DISTRIBUTION: '价值分配',
  COMMON_VALUE_CREATION: '价值创造',
  COMMON_RESERVOIR_MGMT: '水库管理',
  COMMON_IN_TRANSIT_VALUE: '在途产值',
  COMMON_SEALED_ARCHIVE: '封存归档',
  COMMON_COST_PRIVACY: '成本隐私',
  COMMON_WATERMARK: '安全水印',
  COMMON_EXPORT_EXCEL: '导出Excel',
  COMMON_BUSINESS_DATE: '业务日期',
  ADMIN_MODULE_TITLE: '后台管理',
  admin_management: '后台管理',
  admin_backend: '后台管理',

  // deprecated
  DEP_MONTHLY_REPORT_PANEL: '月报盘',
  DEP_YEARLY_PNL: '年损益',
  DEP_MANUAL_AUDIT: '手动确权',
  DEP_AUTO_AUDIT: '自动确权',
  DEP_REVENUE_RECEIVE_PKG: '收户包',
  DEP_CAPACITY_LIMIT: '容量上限',
  DEP_MINE_RAW: '矿山',
  DEP_CONFIRM_AUDIT_OLD: '确权审核',
  DEP_HEDGE_COST_OLD: '对冲消耗',
  DEP_TRADE_FLOW_OLD: '交易流转',
  DEP_RANK_ID_FIELD: '职级ID',

  // 现有代码兼容器件映射 (保持原有 t('business_dashboard', ...) 等调用正常)
  value_evaluation: '价值评价',
  value_audit: '价值确权',
  value_flow_sandbox: '价值流转沙盘',
  mining_resource: '矿山资源',
  value_creation: '价值创造',
  dynamic_consumption: '动态消耗',
  internal_transaction: '内部交易',
  value_distribution: '价值分配',
  reservoir_management: '水库管理',
  business_dashboard: '经营看板',
  personnel_pool: '人事矩阵',
  collectors_pool: '采集主体',
  my_account: '个人中心',
  system_instructions: '系统说明',
  c_weight: 'C权',
  b2_weight: 'B2权',
  revenue_initial: '款初',
  revenue_hedged: '款当',
  value_initial: '产初',
  value_hedged: '产当',
  status_confirmed: '已确权',
  status_pending: '待确权',
  status_rejected: '已驳回',
  collector: '采集主体',
  mining_code: '矿山编号',
  production_value: '产值',
  revenue: '收款',
  revenue_package: '收款包',
  value_package: '产兑包',
  status_approved: '入库',
  audit_records: '确权记录',
  audit_review: '确权审核'
};

export const DEFAULT_CHANGE_LOGS: TermChangeLog[] = [
  {
    id: 'log_1',
    termKey: 'MINE_MODULE_TITLE',
    termName: '矿山资源',
    action: 'update',
    operator: '系统管理员',
    timestamp: '2026-10-11 14:20:00',
    details: '全系统文案规范：将原「矿山」统一规范为标准术语「矿山资源」。'
  },
  {
    id: 'log_2',
    termKey: 'CONFIRM_MODULE_TITLE',
    termName: '价值确权',
    action: 'update',
    operator: '系统管理员',
    timestamp: '2026-10-11 15:00:00',
    details: '全系统文案规范：将原「确权审核」统一规范为标准术语「价值确权」。'
  },
  {
    id: 'log_3',
    termKey: 'SANDBOX_MODULE_TITLE',
    termName: '价值流转沙盘',
    action: 'update',
    operator: '系统管理员',
    timestamp: '2026-10-12 09:30:00',
    details: '全系统文案规范：将原「交易流转/水库流转」升级为标准术语「价值流转沙盘」。'
  },
  {
    id: 'log_4',
    termKey: 'EVAL_MODULE_TITLE',
    termName: '价值评价',
    action: 'create',
    operator: '系统管理员',
    timestamp: '2026-10-12 11:00:00',
    details: '新增「价值评价」标准术语，作为多维综合贡献量化模块名称。'
  },
  {
    id: 'log_5',
    termKey: 'CONFIRM_LINKED_AUDIT',
    termName: '联动确权',
    action: 'update',
    operator: '系统管理员',
    timestamp: '2026-10-13 09:00:00',
    details: '全系统文案规范：废弃「自动确权」，统一规范为「联动确权」。'
  },
  {
    id: 'log_6',
    termKey: 'EVAL_YEAR_CONTRIBUTION',
    termName: '年度贡献值',
    action: 'update',
    operator: '系统管理员',
    timestamp: '2026-10-13 09:30:00',
    details: '全系统文案规范：废弃「年损益」，统一规范为「年度贡献值」。'
  }
];

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../src/components/UI';
import { UI_TOKENS } from '../src/constants/uiTokens';
import { 
  Zap, 
  Layers, 
  TrendingUp, 
  ShieldCheck, 
  Scale, 
  Users, 
  Bookmark, 
  Search, 
  Download, 
  FileText, 
  Info, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  AlertTriangle,
  X,
  Plus,
  Edit2,
  Power,
  PowerOff,
  Trash2,
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import { 
  DEFAULT_TERMS_LIST, 
  TERM_GROUPS, 
  TermGroupKey, 
  TermItem 
} from '../src/constants/terms';
import { useTerms } from '../src/hooks/useTerms';
import { exportJsonToExcel, buildExcelFilename } from '../src/utils/excelIo';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

/**
 * 针对字符串的转义，确保用于正则表达式安全
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 子序列模糊匹配判定 (如 "emc" 匹配 "EVAL_MONTH_CONTRIBUTION", "0933" 匹配 "0.933")
 */
function isSubsequenceMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  let qIdx = 0;
  for (let i = 0; i < lowerText.length && qIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === lowerQuery.length;
}

/**
 * 全维模糊匹配检测 (同时校验 Key、标准文案及口径说明)
 */
function isTermFuzzyMatched(item: TermItem, query: string): boolean {
  if (!query || !query.trim()) return true;
  const cleanQ = query.trim().toLowerCase();

  const keyStr = `${item.term_key || ''} ${item.key || ''}`.toLowerCase();
  const nameStr = `${item.term_value || ''} ${item.name || ''}`.toLowerCase();
  const descStr = (item.description || '').toLowerCase();
  const combinedAll = `${keyStr} ${nameStr} ${descStr}`;

  // 1. 直连子串命中 (Key, 标准文案, 口径说明任一包含即命中)
  if (keyStr.includes(cleanQ) || nameStr.includes(cleanQ) || descStr.includes(cleanQ)) {
    return true;
  }

  // 2. 多词元复合模糊匹配 (支持空格拆分多个关键词)
  const tokens = cleanQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokensHit = tokens.every(tok => combinedAll.includes(tok));
    if (allTokensHit) return true;
  }

  // 3. 口径说明专有子序列模糊搜索 (重点支持口径说明长文本的模糊字母/缩写/符号匹配)
  if (isSubsequenceMatch(descStr, cleanQ)) {
    return true;
  }

  // 4. Key 及文案子序列模糊匹配
  if (isSubsequenceMatch(keyStr, cleanQ) || isSubsequenceMatch(nameStr, cleanQ)) {
    return true;
  }

  return false;
}

/**
 * 实时高亮匹配组件：对 Key、标准文案与口径说明中匹配到的关键词与模糊字符进行醒目高亮渲染
 */
const HighlightMatch: React.FC<{ text: string; query: string; className?: string }> = ({ 
  text, 
  query, 
  className 
}) => {
  if (!text) return null;
  const cleanQ = query.trim();
  if (!cleanQ) return <span className={className}>{text}</span>;

  // 1. 尝试多关键词/整词正则拆分高亮
  const tokens = cleanQ.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const escaped = tokens.map(escapeRegex);
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    if (pattern.test(text)) {
      const parts = text.split(pattern);
      return (
        <span className={className}>
          {parts.map((part, index) => {
            const isMatch = tokens.some(tok => tok.toLowerCase() === part.toLowerCase());
            return isMatch ? (
              <mark 
                key={index} 
                className="bg-amber-200 text-amber-950 font-black px-0.5 rounded-xs transition-colors shadow-2xs"
              >
                {part}
              </mark>
            ) : (
              <React.Fragment key={index}>{part}</React.Fragment>
            );
          })}
        </span>
      );
    }
  }

  // 2. 降级：如果为子序列模糊匹配，针对匹配到的字符按顺序逐字高亮
  const lowerText = text.toLowerCase();
  const lowerQ = cleanQ.toLowerCase();
  let qIdx = 0;
  const matchedSet = new Set<number>();
  for (let i = 0; i < lowerText.length; i++) {
    if (qIdx < lowerQ.length && lowerText[i] === lowerQ[qIdx]) {
      matchedSet.add(i);
      qIdx++;
    }
  }

  if (matchedSet.size === lowerQ.length && lowerQ.length > 0) {
    return (
      <span className={className}>
        {Array.from(text).map((char, idx) => 
          matchedSet.has(idx) ? (
            <mark 
              key={idx} 
              className="bg-amber-200 text-amber-950 font-black px-0.5 rounded-xs transition-colors shadow-2xs"
            >
              {char}
            </mark>
          ) : (
            <React.Fragment key={idx}>{char}</React.Fragment>
          )
        )}
      </span>
    );
  }

  return <span className={className}>{text}</span>;
};

const SystemInstructions: React.FC = () => {
  // Tab: 说明正文 / 术语表 (遵从规范五：在现有组件中增加 Tab：说明正文 / 术语表)
  const [activeTab, setActiveTab] = useState<'instructions' | 'terms'>('instructions');

  // 全局术语状态与操作能力
  const { 
    terms, 
    addTerm, 
    updateTerm, 
    toggleTermStatus, 
    deleteTerm 
  } = useTerms();

  // 术语全量数据源 (优先使用 useTerms 响应式数据，兜底使用 DEFAULT_TERMS_LIST)
  const allTerms = useMemo<TermItem[]>(() => {
    return terms && terms.length > 0 ? terms : DEFAULT_TERMS_LIST;
  }, [terms]);

  // 术语筛选与搜索状态
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deprecated'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 弹窗状态与表单字段
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);

  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formGroup, setFormGroup] = useState<TermGroupKey>('common');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'deprecated' | 'disabled'>('active');
  const [formSortOrder, setFormSortOrder] = useState<number>(100);

  // 二次确认弹窗数据
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '城市守护者',
    subtitle: '',
    message: '',
    onConfirm: () => {}
  });

  // 操作菜单弹出控制
  const [openMenuTermId, setOpenMenuTermId] = useState<string | null>(null);

  // 点击外部区域或按 ESC 键自动关闭操作菜单
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuTermId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuTermId(null);
    };
    if (openMenuTermId) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [openMenuTermId]);

  // 弹窗打开时锁定背景滚动 (遵从平台弹窗规范)
  useEffect(() => {
    if (isEditModalOpen || confirmModalData.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isEditModalOpen, confirmModalData.isOpen]);

  // 统计概览指标
  const metrics = useMemo(() => {
    const total = allTerms.length;
    const activeCount = allTerms.filter(t => t.status === 'active').length;
    const deprecatedCount = allTerms.filter(t => t.status === 'deprecated' || t.status === 'disabled').length;
    const groupCount = Object.keys(TERM_GROUPS).filter(k => k !== 'all').length;
    return { total, activeCount, deprecatedCount, groupCount };
  }, [allTerms]);

  // 过滤后的术语列表 (包含对 Key、标准文案及“口径说明”的全维模糊匹配)
  const filteredTerms = useMemo(() => {
    return allTerms.filter(item => {
      // 1. 分组筛选
      if (selectedGroup !== 'all' && item.term_group !== selectedGroup) {
        return false;
      }
      // 2. 状态筛选
      if (statusFilter === 'active' && item.status !== 'active') {
        return false;
      }
      if (statusFilter === 'deprecated' && item.status !== 'deprecated' && item.status !== 'disabled') {
        return false;
      }
      // 3. 关键词全维模糊搜索 (同时匹配 Key、标准文案和口径说明内容)
      if (searchKeyword.trim()) {
        if (!isTermFuzzyMatched(item, searchKeyword)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => a.sort_order - b.sort_order);
  }, [allTerms, selectedGroup, statusFilter, searchKeyword]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredTerms.length / PAGE_SIZE));
  const paginatedTerms = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTerms.slice(start, start + PAGE_SIZE);
  }, [filteredTerms, currentPage]);

  // 切换筛选时重置页码
  const handleGroupChange = (groupKey: string) => {
    setSelectedGroup(groupKey);
    setCurrentPage(1);
  };

  const handleStatusChange = (status: 'all' | 'active' | 'deprecated') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchKeyword(val);
    setCurrentPage(1);
  };

  // 打开新增弹窗
  const handleOpenCreateModal = (presetGroup?: TermGroupKey) => {
    setIsCreating(true);
    setEditingTerm(null);
    setFormKey('');
    setFormValue('');
    setFormGroup(presetGroup || (selectedGroup !== 'all' ? (selectedGroup as TermGroupKey) : 'common'));
    setFormDescription('');
    setFormStatus('active');
    setFormSortOrder((allTerms.length + 1) * 10);
    setIsEditModalOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEditModal = (term: TermItem) => {
    setIsCreating(false);
    setEditingTerm(term);
    setFormKey(term.term_key || term.key || '');
    setFormValue(term.term_value || term.name || '');
    setFormGroup((term.term_group || 'common') as TermGroupKey);
    setFormDescription(term.description || '');
    setFormStatus(term.status || 'active');
    setFormSortOrder(term.sort_order || 100);
    setIsEditModalOpen(true);
  };

  // 停用 / 启用状态切换交互
  const handleToggleStatus = (term: TermItem) => {
    const isCurrentlyActive = term.status === 'active';
    if (isCurrentlyActive) {
      // 停用操作属于危险重要动作，弹出二次确认弹窗
      setConfirmModalData({
        isOpen: true,
        title: '城市守护者',
        subtitle: '确认停用术语',
        message: `确定要停用标准术语「${term.term_value || term.name}」(${term.term_key || term.key}) 吗？停用后该术语将在全局被标识为停用状态。`,
        confirmText: '确认停用',
        isDanger: true,
        onConfirm: async () => {
          await toggleTermStatus(term.id);
          setConfirmModalData(prev => ({ ...prev, isOpen: false }));
          toast.success(`术语「${term.term_value || term.name}」已成功停用`);
        }
      });
    } else {
      // 启用操作
      setConfirmModalData({
        isOpen: true,
        title: '城市守护者',
        subtitle: '确认启用术语',
        message: `确定要重新启用标准术语「${term.term_value || term.name}」(${term.term_key || term.key}) 吗？启用后该术语将重新恢复为活跃 SSOT 标准。`,
        confirmText: '确认启用',
        isDanger: false,
        onConfirm: async () => {
          await toggleTermStatus(term.id);
          setConfirmModalData(prev => ({ ...prev, isOpen: false }));
          toast.success(`术语「${term.term_value || term.name}」已重新启用`);
        }
      });
    }
  };

  // 删除术语
  const handleDeleteTerm = (term: TermItem) => {
    setConfirmModalData({
      isOpen: true,
      title: '城市守护者',
      subtitle: '确认删除术语',
      message: `确定要彻底删除标准术语「${term.term_value || term.name}」(${term.term_key || term.key}) 吗？此操作无法撤销。`,
      confirmText: '确认删除',
      isDanger: true,
      onConfirm: async () => {
        await deleteTerm(term.id);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
        toast.success(`术语「${term.term_value || term.name}」已彻底删除`);
      }
    });
  };

  // 保存术语 (新增或编辑)
  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = formKey.trim().toUpperCase();
    const cleanValue = formValue.trim();
    if (!cleanKey) {
      toast.error('请输入 Key 键名');
      return;
    }
    if (!cleanValue) {
      toast.error('请输入标准文案');
      return;
    }

    // 冲突检查
    if (isCreating) {
      const exists = allTerms.some(t => 
        (t.term_key || '').toUpperCase() === cleanKey || 
        (t.key || '').toUpperCase() === cleanKey
      );
      if (exists) {
        toast.error(`Key [${cleanKey}] 已存在，请更换唯一的键名`);
        return;
      }
    } else if (editingTerm) {
      const exists = allTerms.some(t => 
        t.id !== editingTerm.id && 
        ((t.term_key || '').toUpperCase() === cleanKey || (t.key || '').toUpperCase() === cleanKey)
      );
      if (exists) {
        toast.error(`Key [${cleanKey}] 已被其他术语占用，请更换`);
        return;
      }
    }

    if (isCreating) {
      await addTerm({
        term_key: cleanKey,
        term_value: cleanValue,
        term_group: formGroup,
        description: formDescription.trim(),
        status: formStatus,
        sort_order: Number(formSortOrder) || (allTerms.length + 1) * 10,
        key: cleanKey.toLowerCase(),
        name: cleanValue,
        category: TERM_GROUPS[formGroup]?.label || formGroup,
      });
      toast.success(`标准术语「${cleanValue}」新增成功`);
    } else if (editingTerm) {
      await updateTerm({
        ...editingTerm,
        term_key: cleanKey,
        term_value: cleanValue,
        term_group: formGroup,
        description: formDescription.trim(),
        status: formStatus,
        sort_order: Number(formSortOrder) || editingTerm.sort_order,
        key: cleanKey.toLowerCase(),
        name: cleanValue,
        category: TERM_GROUPS[formGroup]?.label || formGroup,
      });
      toast.success(`标准术语「${cleanValue}」更新成功`);
    }

    setIsEditModalOpen(false);
  };

  // 导出 Excel 功能
  const handleExportExcel = () => {
    try {
      const exportRows = filteredTerms.map((item, idx) => ({
        '序号': idx + 1,
        'Key': item.term_key || item.key,
        '标准文案': item.term_value || item.name,
        '建议分组': TERM_GROUPS[item.term_group]?.label || item.term_group,
        '口径说明': item.description,
        '状态': item.status === 'active' ? '正常启用' : '已停用/废弃',
        '排序序号': item.sort_order,
      }));

      const filename = buildExcelFilename('城市守护者_前端标准术语表');
      exportJsonToExcel(exportRows, '前端术语表', filename);
      toast.success(`成功导出 ${exportRows.length} 条术语数据至 Excel`);
    } catch (err) {
      console.error('导出 Excel 失败:', err);
      toast.error('导出 Excel 发生异常，请稍后重试');
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部深色控制台 Header (遵从平台规范：深色顶栏，平坦卡片底色，现代企业级 B 端中枢风格) */}
      <div className={`relative ${UI_TOKENS.RADIUS_PANEL} bg-gradient-to-br from-slate-900 to-indigo-950 p-6 md:p-8 overflow-hidden shadow-2xl border border-slate-800`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">
                城市守护者 · 规则与标准中枢
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              {activeTab === 'instructions' ? '城市守护者价值循环 · 系统说明书' : '全平台前端标准术语表 · SSOT'}
            </h1>
            <p className="text-xs text-slate-400 font-medium max-w-2xl leading-relaxed">
              统一业务模型底座、计算口径标准与前端交互文案规范，提供全平台单一事实来源（SSOT）治理。
            </p>
          </div>

          {/* Tab 切换栏：说明正文 / 术语表 */}
          <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 shrink-0 self-start md:self-center">
            <button 
              onClick={() => setActiveTab('instructions')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                activeTab === 'instructions' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileText size={15} />
              <span>说明正文</span>
            </button>
            <button 
              onClick={() => setActiveTab('terms')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                activeTab === 'terms' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bookmark size={15} />
              <span>术语表</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================== Tab 1: 术语表 Tab ===================== */}
      {activeTab === 'terms' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 术语表统计卡片看板 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">登记总术语数</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-slate-900">{metrics.total}</span>
                <span className="text-[11px] text-slate-400 font-medium">个词条</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">标准正常启用</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-emerald-600">{metrics.activeCount}</span>
                <span className="text-[11px] text-emerald-500 font-medium">SSOT 标准</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">历史已废弃/停用</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-amber-600">{metrics.deprecatedCount}</span>
                <span className="text-[11px] text-amber-500 font-medium">已识别规范</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">业务分组覆盖</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-indigo-600">{metrics.groupCount}</span>
                <span className="text-[11px] text-indigo-500 font-medium">大核心模块</span>
              </div>
            </div>
          </div>

          {/* 术语表主卡片 */}
          <Card className="bg-white border border-slate-200 shadow-sm" noPadding>
            {/* 顶部工具栏：分组筛选、状态筛选、关键词搜索、新增术语、导出 Excel */}
            <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* 分组筛选下拉 */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">业务分组:</span>
                  <select 
                    value={selectedGroup}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[36px]"
                  >
                    <option value="all">全部分组 ({allTerms.length})</option>
                    {Object.entries(TERM_GROUPS).filter(([k]) => k !== 'all').map(([k, meta]) => {
                      const count = allTerms.filter(t => t.term_group === k).length;
                      return (
                        <option key={k} value={k}>
                          {meta.label} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 状态筛选 */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">状态:</span>
                  <select 
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[36px]"
                  >
                    <option value="all">全部状态</option>
                    <option value="active">正常启用 (active)</option>
                    <option value="deprecated">历史废弃/停用</option>
                  </select>
                </div>

                {/* 关键词搜索框 (支持 Key、标准文案及口径说明多字段模糊匹配) */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="模糊搜索 Key、标准文案、口径说明..." 
                    value={searchKeyword}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[36px]"
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                      title="清空搜索词"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {searchKeyword.trim() && (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-200 shrink-0 flex items-center space-x-1 animate-fadeIn">
                    <Sparkles size={12} className="text-blue-500" />
                    <span>匹配到 {filteredTerms.length} 条</span>
                  </span>
                )}
              </div>

              {/* 操作按钮区：新增术语 + 导出 Excel */}
              <div className="flex items-center space-x-3 shrink-0">
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-md transition-all shadow-xs min-h-[36px]"
                  title="一键将术语表导出为 Excel 文件"
                >
                  <Download size={14} className="text-slate-500" />
                  <span>导出 Excel</span>
                </button>

                <button 
                  onClick={() => handleOpenCreateModal()}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md transition-all shadow-sm min-h-[36px]"
                  title="新增标准术语"
                >
                  <Plus size={14} />
                  <span>新增术语</span>
                </button>
              </div>
            </div>

            {/* 分组快捷标签胶囊条 */}
            <div className="px-4 md:px-6 py-2.5 bg-slate-50/30 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">快速切换:</span>
              <button
                onClick={() => handleGroupChange('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all shrink-0 ${
                  selectedGroup === 'all' 
                    ? 'bg-slate-800 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                全部 ({allTerms.length})
              </button>
              {Object.entries(TERM_GROUPS).filter(([k]) => k !== 'all').map(([k, meta]) => {
                const count = allTerms.filter(t => t.term_group === k).length;
                const isSelected = selectedGroup === k;
                return (
                  <button
                    key={k}
                    onClick={() => handleGroupChange(k)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all shrink-0 border ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{meta.label}</span>
                    <span className="ml-1 opacity-75 font-mono text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* 术语列表展示表格 (包含操作列与交互菜单) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3 min-w-[50px] text-center">序号</th>
                    <th className="px-4 py-3 min-w-[180px]">Key (键名)</th>
                    <th className="px-4 py-3 min-w-[130px]">标准文案</th>
                    <th className="px-4 py-3 min-w-[110px]">建议分组</th>
                    <th className="px-4 py-3 min-w-[260px]">口径说明</th>
                    <th className="px-4 py-3 min-w-[90px] text-center">状态</th>
                    <th className="px-4 py-3 min-w-[130px]">演进备注 / SSOT</th>
                    <th className="px-4 py-3 min-w-[140px] text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedTerms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
                        未检索到符合条件的术语条目，请调整搜索词或分组筛选
                      </td>
                    </tr>
                  ) : (
                    paginatedTerms.map((term, index) => {
                      const groupMeta = TERM_GROUPS[term.term_group] || TERM_GROUPS.common;
                      const globalIndex = (currentPage - 1) * PAGE_SIZE + index + 1;
                      const isInactive = term.status === 'deprecated' || term.status === 'disabled';

                      return (
                        <tr 
                          key={term.id || term.term_key} 
                          className={`hover:bg-slate-50/80 transition-colors ${isInactive ? 'bg-amber-50/20' : ''}`}
                        >
                          {/* 序号 */}
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 text-center font-bold">
                            {globalIndex}
                          </td>

                          {/* Key (键名) */}
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[11px]">
                            <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block font-mono tracking-tight select-all">
                              <HighlightMatch text={term.term_key || term.key} query={searchKeyword} />
                            </span>
                          </td>

                          {/* 标准文案 */}
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <span className={`px-2.5 py-1 rounded-md border font-black inline-block ${
                              isInactive 
                                ? 'line-through text-slate-400 bg-slate-100 border-slate-200' 
                                : 'text-blue-700 bg-blue-50/80 border-blue-200/80'
                            }`}>
                              <HighlightMatch text={term.term_value || term.name} query={searchKeyword} />
                            </span>
                          </td>

                          {/* 业务分组 */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${groupMeta.badgeColor}`}>
                              {groupMeta.label}
                            </span>
                          </td>

                          {/* 口径说明 (支持模糊搜索匹配与实时精准高亮，带 title 溢出保护) */}
                          <td 
                            className={`px-4 py-3 text-slate-600 leading-relaxed max-w-sm md:max-w-md ${searchKeyword.trim() ? 'break-words' : 'truncate'}`} 
                            title={term.description}
                          >
                            <HighlightMatch text={term.description || '—'} query={searchKeyword} />
                          </td>

                          {/* 状态 */}
                          <td className="px-4 py-3 text-center">
                            {isInactive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span>
                                {term.status === 'deprecated' ? '已废弃' : '已停用'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                                正常启用
                              </span>
                            )}
                          </td>

                          {/* 备注 */}
                          <td className="px-4 py-3 text-[11px] text-slate-500">
                            {isInactive ? (
                              <span className="text-amber-700 font-semibold flex items-center space-x-1">
                                <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                                <span>历史非标文案，禁止UI新建</span>
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium">SSOT 标准术语</span>
                            )}
                          </td>

                          {/* 操作列交互菜单 (支持新增、编辑、停用/启用功能) */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5 relative">
                              {/* 快捷编辑按钮 */}
                              <button 
                                type="button"
                                onClick={() => handleOpenEditModal(term)}
                                className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded text-xs font-bold transition-all flex items-center space-x-1"
                                title="编辑术语"
                              >
                                <Edit2 size={13} />
                                <span>编辑</span>
                              </button>

                              {/* 快捷停用/启用按钮 */}
                              <button 
                                type="button"
                                onClick={() => handleToggleStatus(term)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center space-x-1 ${
                                  term.status === 'active' 
                                    ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700' 
                                    : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                                title={term.status === 'active' ? '停用此术语' : '启用此术语'}
                              >
                                {term.status === 'active' ? <PowerOff size={13} /> : <Power size={13} />}
                                <span>{term.status === 'active' ? '停用' : '启用'}</span>
                              </button>

                              {/* 操作交互下拉菜单 */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuTermId(openMenuTermId === term.id ? null : term.id);
                                  }}
                                  className={`px-2 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold transition-all flex items-center space-x-1 ${
                                    openMenuTermId === term.id ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300' : ''
                                  }`}
                                  title="展开操作交互菜单"
                                >
                                  <span>操作</span>
                                  <ChevronDown size={12} className={`transition-transform duration-200 ${openMenuTermId === term.id ? 'rotate-180' : ''}`} />
                                </button>

                                {openMenuTermId === term.id && (
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute right-0 ${
                                      index >= paginatedTerms.length - 2 && paginatedTerms.length > 2 
                                        ? 'bottom-full mb-1.5' 
                                        : 'top-full mt-1.5'
                                    } w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-fadeIn`}
                                  >
                                    <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                      <span>操作菜单</span>
                                      <span className="text-[9px] font-mono text-slate-400">SSOT</span>
                                    </div>

                                    {/* 1. 新增功能：同组新增术语 */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTermId(null);
                                        handleOpenCreateModal(term.term_group);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center space-x-2 transition-colors text-left"
                                    >
                                      <Plus size={13} className="text-emerald-600 shrink-0" />
                                      <span>新增同组术语</span>
                                    </button>

                                    {/* 2. 编辑功能：编辑术语 */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTermId(null);
                                        handleOpenEditModal(term);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center space-x-2 transition-colors text-left"
                                    >
                                      <Edit2 size={13} className="text-blue-600 shrink-0" />
                                      <span>编辑术语</span>
                                    </button>

                                    {/* 3. 停用 / 启用功能 */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTermId(null);
                                        handleToggleStatus(term);
                                      }}
                                      className={`w-full px-3 py-2 text-xs font-bold flex items-center space-x-2 transition-colors text-left ${
                                        term.status === 'active' 
                                          ? 'text-amber-700 hover:bg-amber-50' 
                                          : 'text-emerald-700 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {term.status === 'active' ? (
                                        <>
                                          <PowerOff size={13} className="text-amber-600 shrink-0" />
                                          <span>停用此术语</span>
                                        </>
                                      ) : (
                                        <>
                                          <Power size={13} className="text-emerald-600 shrink-0" />
                                          <span>启用此术语</span>
                                        </>
                                      )}
                                    </button>

                                    <div className="my-1 border-t border-slate-100"></div>

                                    {/* 4. 删除功能 */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuTermId(null);
                                        handleDeleteTerm(term);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors text-left"
                                    >
                                      <Trash2 size={13} className="text-rose-600 shrink-0" />
                                      <span>删除术语</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页控制区 */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-bold">
              <div>
                共计 <span className="font-mono text-slate-800">{filteredTerms.length}</span> 条术语，
                当前展示第 <span className="font-mono text-slate-800">{currentPage}</span> / <span className="font-mono text-slate-800">{totalPages}</span> 页
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 min-h-[32px]"
                >
                  <ChevronLeft size={13} />
                  <span>上一页</span>
                </button>
                <div className="px-2 font-mono text-slate-700">
                  {currentPage} / {totalPages}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 min-h-[32px]"
                >
                  <span>下一页</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===================== Tab 2: 说明正文 Tab (保持现有内容完全不变) ===================== */}
      {activeTab === 'instructions' && (
        <div className="space-y-8 animate-fadeIn">
          {/* 核心机制与四大系统运算一致性规范 (四大金刚规则) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 规则 1 */}
            <Card className={`p-6 bg-white border border-slate-100 ${UI_TOKENS.RADIUS_CARD} shadow-md flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Zap size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">0.933 收益提纯准则</h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    扣除 6.7% 折耗率的财务逻辑闭环
                  </p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  系统内所有提报点数及矿山收益在<strong>加载或确权入库时</strong>已完成了 <span className="font-bold text-slate-900">0.933 提纯提炼</span>（已扣除 6.7% 的法定损耗与税折率）。后续进行利益分红对冲、指标运算或作为 B2 成本核算时，必须严格直接引用纯净值，<span className="text-rose-600 font-bold">严禁在任何下游环节进行重复折算折减</span>。
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs font-black text-blue-600 uppercase tracking-wider">
                <CheckCircle2 size={14} />
                <span>保障系统数据运算不出现双重折损</span>
              </div>
            </Card>

            {/* 规则 2 */}
            <Card className={`p-6 bg-white border border-slate-100 ${UI_TOKENS.RADIUS_CARD} shadow-md flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">C类消耗与 B2 耗散归一机制</h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    计量基数平面对齐，防止异常熔断
                  </p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  当经营单元发生 C 级动态折损对冲、或 B2 级消耗系数变动时，折算计算扣减的基数，<strong>必须与矿山的总容量、待确权水位完全处于同一基准面之上</strong>（统一采用税后纯净积分或统一原始积分）。防止两端由于基数不对齐引起的水位高估，从而造成虚假熔断报警。
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs font-black text-amber-600 uppercase tracking-wider">
                <CheckCircle2 size={14} />
                <span>保证动态消耗系数对冲处于同等平面</span>
              </div>
            </Card>

            {/* 规则 3 */}
            <Card className={`p-6 bg-white border border-slate-100 ${UI_TOKENS.RADIUS_CARD} shadow-md flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">未确权进度占比公式标准</h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    消除多象限看板视觉割裂的数学锚定
                  </p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  规定表达未确权进度的全量财务公式为：
                  <span className="block my-2 p-2 bg-slate-50 rounded-xl font-mono text-xs text-slate-800 border border-slate-200/60 text-center font-bold">
                    Unconfirmed = Max(0, Capacity - Confirmed - Pending - Mined)
                  </span>
                  各处看板（主仪表盘、矿山资源页、进度四象限）在计算未确权水位、进度比率时，其分母与分子取值逻辑已严格统一，防范逻辑脱节。
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs font-black text-indigo-600 uppercase tracking-wider">
                <CheckCircle2 size={14} />
                <span>确保仪表盘四象限与个人进度一致</span>
              </div>
            </Card>

            {/* 规则 4 */}
            <Card className={`p-6 bg-white border border-slate-100 ${UI_TOKENS.RADIUS_CARD} shadow-md flex flex-col justify-between`}>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">内部交易越界保护与防误熔断</h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    考虑提纯折耗引起的帐户水位偏差
                  </p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  内部流转交易（如承兑额度交易）在进行跨帐户转移与扣划限额验证时，均已精准内嵌入 6.7% 折耗的损耗抵消。这防止了由于未考虑纯净提纯转换导致高估帐户余额，而在高频额度变动时发生额度异常报错或触发系统交易误锁死。
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs font-black text-rose-600 uppercase tracking-wider">
                <CheckCircle2 size={14} />
                <span>在安全合规转移额度的前提下杜绝误锁</span>
              </div>
            </Card>
          </div>

          {/* 水库盈利排名榜双行口径说明 */}
          <Card className={`${UI_TOKENS.RADIUS_PANEL} bg-white border border-slate-100 shadow-xl overflow-hidden`}>
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    经营单元排名双口径对账基准
                  </h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    「已确权」与「已确权+待确权」口径拆解
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                为精细化评估经营单元的静态已实现成果与动态潜在盈亏，排名榜采用<strong>双行口径机制</strong>进行严密呈递。榜单的<strong>总体排名名次完全基于第二行口径的月损益结果</strong>。
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="p-5 bg-blue-50/40 border border-blue-100 rounded-2xl space-y-3">
                  <div className="inline-block px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded">
                    第一行：已确权
                  </div>
                  <ul className="text-slate-600 text-xs font-bold space-y-2">
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-blue-500">▪</span>
                      <span>产兑包：仅统计完全「已确权」的产出日志。</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-blue-500">▪</span>
                      <span>收产包：等于「收款包」+「第一行产兑包」。</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-blue-500">▪</span>
                      <span>月损益：仅以已确权收产包减去本月各级成本。</span>
                    </li>
                  </ul>
                </div>

                <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl space-y-3">
                  <div className="inline-block px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded">
                    第二行：已确权+待确权
                  </div>
                  <ul className="text-slate-600 text-xs font-bold space-y-2">
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-amber-600">▪</span>
                      <span>产兑包：等于「已确权」+「联动待确权」之和。</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-amber-600">▪</span>
                      <span>收款包两行同值，确保在途流动性对账精准。</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5 mt-0.5 text-amber-600">▪</span>
                      <span>各列都出数：收产、成本包、月损益/年损益第二行均全部填出，不要任何横杠。</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex items-start space-x-3 text-xs font-bold text-slate-500">
                <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-700 font-black">联动待确权与非联动判定规则：</p>
                  <p className="mt-1">
                    联动待确权产兑包（即收款背书在途）会作为合理的在途收益计入第二行；任何状态为待确权但确权方式属于手动人工审核的（非联动待审记录），<strong>一律不计入任何计算中</strong>，防范虚假资产注水。
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 2% 与 5% 专项包挂载说明 */}
          <Card className={`${UI_TOKENS.RADIUS_PANEL} bg-white border border-slate-100 shadow-xl overflow-hidden`}>
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    专项特殊政策包挂载展示规范
                  </h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">
                    经管员款专与产专职责绑定的金库与蓄水池
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                在价值分配列表（`Distribution.tsx`）中，系统动态展示了分配给专家所负责矿山对应的两类高额专项激励包的累计剩余额度，保障分红与调节时拥有真实的数据背书：
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-emerald-100 rounded-2xl bg-emerald-50/20 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="font-black text-slate-900 text-sm">款专 2% 专项金库</span>
                  </div>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    针对分类或职责标为高级<strong>「款专」</strong>的用户行，实时穿透汇总所有由其在资源中负责的矿山（`assignedToRevenue` 为其 ID）名下的收款 2% 专项累计余额。并于行内高亮呈递“收款2%金库：{'{coll2_Sum}'}”的高对比度暗绿色徽标。
                  </p>
                </div>

                <div className="p-5 border border-amber-100 rounded-2xl bg-amber-50/20 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="font-black text-slate-900 text-sm">产专 5% 专项蓄水池</span>
                  </div>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">
                    针对分类或职责标为高级<strong>「产专」</strong>的用户行，实时汇总该专家管理的矿山（`assignedToValue` 为其 ID）名下的 5% 产值专项包余额。于分配行内呈现“产值5%蓄水：{'{out5_Sum}'}”的精美琥珀色微章，控制手动超标派发。
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===================== 弹窗 1：编辑 / 新增术语弹窗 ===================== */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* 头部 (Fixed Header) */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2.5">
                <Bookmark size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">城市守护者</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isCreating ? '新增标准术语' : '编辑标准术语'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>

            {/* 内容体 (Scrollable Body) */}
            <form id="term-form" onSubmit={handleSaveTerm} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Key (唯一标识) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <span>Key (模块前缀全大写)</span>
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="例如: EVAL_MONTH_CONTRIBUTION"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[38px]"
                />
                <p className="text-[10px] text-slate-400 font-medium">模块前缀 + 全大写下划线，如 EVAL_MONTH_CONTRIBUTION、CONFIRM_AUDIT 等。</p>
              </div>

              {/* 标准文案 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <span>标准文案</span>
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <input 
                  type="text"
                  required
                  placeholder="例如: 月度贡献值"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 min-h-[38px]"
                />
              </div>

              {/* 业务分组 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">业务分组</label>
                <select 
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value as TermGroupKey)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-blue-600 min-h-[38px]"
                >
                  {Object.entries(TERM_GROUPS).filter(([k]) => k !== 'all').map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label} ({meta.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* 口径说明 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">口径说明</label>
                <textarea 
                  rows={3}
                  placeholder="说明计算口径、统计边界或业务规范..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* 状态与排序序号 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">状态</label>
                  <div className="flex items-center space-x-4 pt-1.5">
                    <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="radio" 
                        name="status" 
                        value="active" 
                        checked={formStatus === 'active'}
                        onChange={() => setFormStatus('active')}
                        className="text-blue-600"
                      />
                      <span>正常启用</span>
                    </label>
                    <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 cursor-pointer">
                      <input 
                        type="radio" 
                        name="status" 
                        value="disabled" 
                        checked={formStatus === 'disabled' || formStatus === 'deprecated'}
                        onChange={() => setFormStatus('disabled')}
                        className="text-slate-400"
                      />
                      <span>停用</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">排序序号</label>
                  <input 
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-blue-600 min-h-[38px]"
                  />
                </div>
              </div>
            </form>

            {/* 底部 (Fixed Footer) */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md text-xs font-bold transition-all min-h-[36px]"
              >
                取消
              </button>
              <button 
                type="submit"
                form="term-form"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all shadow-sm min-h-[36px]"
              >
                保存
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===================== 弹窗 2：二次确认通用弹窗（停用 / 启用 / 删除） ===================== */}
      {confirmModalData.isOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle size={18} className={confirmModalData.isDanger ? 'text-rose-600' : 'text-blue-600'} />
                <div>
                  <h3 className="text-base font-bold text-slate-900">{confirmModalData.title || '城市守护者'}</h3>
                  {confirmModalData.subtitle && (
                    <p className="text-xs text-slate-500 font-medium">{confirmModalData.subtitle}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                {confirmModalData.message}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3 shrink-0">
              <button 
                type="button"
                onClick={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md text-xs font-bold transition-all min-h-[36px]"
              >
                取消
              </button>
              <button 
                type="button"
                onClick={confirmModalData.onConfirm}
                className={`px-5 py-2 text-white rounded-md text-xs font-bold transition-all shadow-sm min-h-[36px] ${
                  confirmModalData.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModalData.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SystemInstructions;

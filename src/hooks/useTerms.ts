import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Term, DEFAULT_TERMS, DEFAULT_TERMS_LIST, TermChangeLog, DEFAULT_CHANGE_LOGS } from '../constants/terms';

const LOCAL_STORAGE_TERMS_KEY = 'shihe_terms_db';
const LOCAL_STORAGE_LOGS_KEY = 'shihe_terms_changelogs';

interface TermsContextType {
  terms: Term[];
  changeLogs: TermChangeLog[];
  t: (key: string, fallback?: string) => string;
  getTerm: (key: string) => Term | undefined;
  updateTerm: (term: Term, operator?: string) => Promise<boolean>;
  addTerm: (term: Omit<Term, 'id' | 'updatedAt'>, operator?: string) => Promise<boolean>;
  toggleTermStatus: (id: string, operator?: string) => Promise<boolean>;
  deleteTerm: (id: string, operator?: string) => Promise<boolean>;
  reloadTerms: () => Promise<void>;
}

const TermsContext = createContext<TermsContextType | undefined>(undefined);

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const TermsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [terms, setTerms] = useState<Term[]>(() => {
    // 优先读取本地持久化数据兜底
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TERMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 与默认术语合并，以确保新增的 key 不遗漏
          const map = new Map<string, Term>();
          DEFAULT_TERMS_LIST.forEach(item => map.set(item.term_key || item.key, item));
          parsed.forEach((item: Term) => {
            const k = item.term_key || item.key;
            if (item && k) map.set(k, item);
          });
          return Array.from(map.values());
        }
      }
    } catch {
      // 容错处理
    }
    return DEFAULT_TERMS_LIST;
  });

  const [changeLogs, setChangeLogs] = useState<TermChangeLog[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // 容错
    }
    return DEFAULT_CHANGE_LOGS;
  });

  // 启动时调用 GET /api/terms 与 DEFAULT_TERMS_LIST 合并（数据库优先）
  const fetchAndMergeTerms = useCallback(async () => {
    try {
      const res = await fetch('/api/terms');
      if (res.ok) {
        const serverTerms = await res.json();
        if (Array.isArray(serverTerms) && serverTerms.length > 0) {
          const mergedMap = new Map<string, Term>();
          // 先放入默认术语
          DEFAULT_TERMS_LIST.forEach(t => mergedMap.set(t.term_key || t.key, t));
          // 数据库优先覆盖
          serverTerms.forEach((st: Term) => {
            const k = st.term_key || st.key;
            if (st && k) {
              mergedMap.set(k, st);
            }
          });
          const merged = Array.from(mergedMap.values());
          setTerms(merged);
          try {
            localStorage.setItem(LOCAL_STORAGE_TERMS_KEY, JSON.stringify(merged));
          } catch {}
          return;
        }
      }
    } catch (e) {
      console.warn('GET /api/terms not available, using local terms store:', e);
    }
  }, []);

  useEffect(() => {
    fetchAndMergeTerms();
  }, [fetchAndMergeTerms]);

  // 快捷术语查询缓存 (同时索引 key 与 term_key)
  const termsMap = useMemo(() => {
    const map = new Map<string, Term>();
    terms.forEach(t => {
      if (t) {
        if (t.term_key) map.set(t.term_key, t);
        if (t.key) map.set(t.key, t);
      }
    });
    return map;
  }, [terms]);

  // t(key, fallback): 如果术语存在且处于 active 状态，返回术语 name / term_value；否则返回 fallback
  const t = useCallback((key: string, fallback?: string): string => {
    const item = termsMap.get(key) || termsMap.get(key.toUpperCase());
    if (item) {
      if ((item.status as string) === 'disabled' || (item.status as string) === 'deprecated') {
        return fallback !== undefined ? fallback : (item.term_value || item.name);
      }
      return item.term_value || item.name || (fallback !== undefined ? fallback : key);
    }
    // 降级查询 DEFAULT_TERMS 常量对象
    if (DEFAULT_TERMS[key]) return DEFAULT_TERMS[key];
    if (DEFAULT_TERMS[key.toUpperCase()]) return DEFAULT_TERMS[key.toUpperCase()];
    return fallback !== undefined ? fallback : key;
  }, [termsMap]);

  const getTerm = useCallback((key: string): Term | undefined => {
    return termsMap.get(key);
  }, [termsMap]);

  const recordChangeLog = useCallback((log: Omit<TermChangeLog, 'id' | 'timestamp'>) => {
    const newLog: TermChangeLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formatNow()
    };
    setChangeLogs(prev => {
      const updated = [newLog, ...prev];
      try {
        localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const saveTermsState = useCallback((newTerms: Term[]) => {
    setTerms(newTerms);
    try {
      localStorage.setItem(LOCAL_STORAGE_TERMS_KEY, JSON.stringify(newTerms));
    } catch {}
    // 异步尝试同步后端，不阻塞前端
    fetch('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTerms)
    }).catch(() => {});
  }, []);

  const updateTerm = useCallback(async (updatedTerm: Term, operator: string = '系统管理员'): Promise<boolean> => {
    const oldTerm = terms.find(t => t.id === updatedTerm.id);
    const stampedTerm: Term = {
      ...updatedTerm,
      updatedAt: formatNow()
    };
    const nextTerms = terms.map(t => t.id === stampedTerm.id ? stampedTerm : t);
    saveTermsState(nextTerms);

    recordChangeLog({
      termKey: stampedTerm.key,
      termName: stampedTerm.name,
      action: 'update',
      operator,
      details: oldTerm 
        ? `文案修改：由「${oldTerm.name}」更新为「${stampedTerm.name}」；说明修改：由「${oldTerm.description}」更新为「${stampedTerm.description}」`
        : `修改术语 [${stampedTerm.name}]`
    });
    return true;
  }, [terms, saveTermsState, recordChangeLog]);

  const addTerm = useCallback(async (newTermData: Omit<Term, 'id' | 'updatedAt'>, operator: string = '系统管理员'): Promise<boolean> => {
    const id = `term_${Date.now()}`;
    const newTerm: Term = {
      ...newTermData,
      id,
      updatedAt: formatNow()
    };
    const nextTerms = [newTerm, ...terms];
    saveTermsState(nextTerms);

    recordChangeLog({
      termKey: newTerm.key,
      termName: newTerm.name,
      action: 'create',
      operator,
      details: `新增术语 [${newTerm.name}]（Key: ${newTerm.key}，分组: ${newTerm.category}）`
    });
    return true;
  }, [terms, saveTermsState, recordChangeLog]);

  const toggleTermStatus = useCallback(async (id: string, operator: string = '系统管理员'): Promise<boolean> => {
    const target = terms.find(t => t.id === id || t.term_key === id || t.key === id);
    if (!target) return false;
    const nextStatus: 'active' | 'disabled' = target.status === 'active' ? 'disabled' : 'active';
    const updatedTerm: Term = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow()
    };
    const nextTerms = terms.map(t => (t.id === target.id || (t.term_key && t.term_key === target.term_key)) ? updatedTerm : t);
    saveTermsState(nextTerms);

    recordChangeLog({
      termKey: target.key,
      termName: target.name,
      action: nextStatus === 'active' ? 'enable' : 'disable',
      operator,
      details: nextStatus === 'active' ? `启用术语 [${target.name}]` : `停用术语 [${target.name}]`
    });
    return true;
  }, [terms, saveTermsState, recordChangeLog]);

  const deleteTerm = useCallback(async (id: string, operator: string = '系统管理员'): Promise<boolean> => {
    const target = terms.find(t => t.id === id || t.term_key === id || t.key === id);
    if (!target) return false;
    const nextTerms = terms.filter(t => t.id !== target.id && (!target.term_key || t.term_key !== target.term_key));
    saveTermsState(nextTerms);

    recordChangeLog({
      termKey: target.key,
      termName: target.name,
      action: 'delete',
      operator,
      details: `删除术语 [${target.name}]（Key: ${target.key}）`
    });
    return true;
  }, [terms, saveTermsState, recordChangeLog]);

  const reloadTerms = useCallback(async () => {
    await fetchAndMergeTerms();
  }, [fetchAndMergeTerms]);

  const contextValue = useMemo(() => ({
    terms,
    changeLogs,
    t,
    getTerm,
    updateTerm,
    addTerm,
    toggleTermStatus,
    deleteTerm,
    reloadTerms
  }), [terms, changeLogs, t, getTerm, updateTerm, addTerm, toggleTermStatus, deleteTerm, reloadTerms]);

  return React.createElement(TermsContext.Provider, { value: contextValue }, children);
};

export const useTerms = () => {
  const context = useContext(TermsContext);
  if (!context) {
    throw new Error('useTerms must be used within a TermsProvider');
  }
  return context;
};

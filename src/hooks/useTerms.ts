import React, { createContext, useContext, useState, useEffect } from 'react';
import { Term, DEFAULT_TERMS } from '../constants/terms';

interface TermsContextType {
  terms: Term[];
  updateTerm: (term: Term) => void;
  deleteTerm: (id: string) => void;
}

const TermsContext = createContext<TermsContextType | undefined>(undefined);

export const TermsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [terms, setTerms] = useState<Term[]>(DEFAULT_TERMS);

  useEffect(() => {
    // 启动时调用 GET /api/terms (若接口未就绪，使用默认值)
    fetch('/api/terms')
      .then(res => res.json())
      .then(data => setTerms(data))
      .catch(() => console.warn('Terms API not ready, using defaults'));
  }, []);

  const updateTerm = (updatedTerm: Term) => {
    setTerms(prev => prev.map(t => t.id === updatedTerm.id ? updatedTerm : t));
  };

  const deleteTerm = (id: string) => {
    setTerms(prev => prev.filter(t => t.id !== id));
  };

  return (
    React.createElement(TermsContext.Provider, { value: { terms, updateTerm, deleteTerm } }, children)
  );
};

export const useTerms = () => {
  const context = useContext(TermsContext);
  if (!context) {
    throw new Error('useTerms must be used within a TermsProvider');
  }
  return context;
};

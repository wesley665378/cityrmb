export interface Term {
  id: string;
  key: string;
  name: string;
  description: string;
  category: '基础' | '业务' | '状态' | '其他';
  deprecated?: boolean;
}

export const DEFAULT_TERMS: Term[] = [
  { id: 't1', key: 'mining', name: '矿山资源', description: '价值创造的源头，用于提炼收款或产值。', category: '基础' },
  { id: 't2', key: 'revenue', name: '收款', description: '实际经营收款价值。', category: '业务' },
  { id: 't3', key: 'production', name: '产值', description: '经营产出价值。', category: '业务' },
  { id: 't4', key: 'status_confirmed', name: '已确认', description: '价值已获确权。', category: '状态' },
];

export const DEPRECATED_TERMS: Term[] = [
  { id: 'd1', key: 'old_val', name: '旧系统值', description: '已废弃字段。', category: '其他', deprecated: true },
];

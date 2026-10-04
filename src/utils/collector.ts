import { User, Role, SYS_C, SYS_B2, LEGACY_SYSTEM_B2 } from '../../types';

export function getUserRankName(userOrRole?: User | Role | string): string {
  if (!userOrRole) return '';
  if (typeof userOrRole === 'object') {
    if (userOrRole.category) return userOrRole.category;
    return getUserRankName(userOrRole.role);
  }
  switch (userOrRole) {
    case Role.Admin:
    case 'admin':
      return '系统管理员';
    case Role.Rank:
    case 'rank':
      return '经营单元负责人';
    case Role.Operator:
    case 'operator':
      return '经管员';
    case Role.npcxie:
    case 'npcxie':
    case Role.NPC:
    case 'NPC':
    case 'npc':
      return 'NPC';
    case Role.RevenueCollector:
    case 'revenue_collector':
      return '收款专家';
    case Role.ValueCollector:
    case 'value_collector':
      return '产值专家';
    case Role.ReservoirManager:
    case 'reservoir_manager':
      return '水库管理员';
    case Role.Collector:
    case 'collector':
      return '采集主体';
    default:
      return String(userOrRole);
  }
}

export function getUserCompletenessScore(u: User | undefined | null): number {
  if (!u) return -1;
  let score = 0;
  const name = String(u.name || '').trim().toLowerCase();
  const id = String(u.id || '').trim().toLowerCase();
  const userId = String(u.userId || '').trim().toLowerCase();
  const category = String(u.category || '').trim();

  // 名字存在且不是裸工号/裸ID
  if (name && name !== id && name !== userId) {
    score += 100;
  } else if (name) {
    score += 10;
  }

  if (category) {
    score += 50;
  }

  if (u.role && u.role !== Role.Collector) {
    score += 5;
  }

  return score;
}

/**
 * 解析采集人用户对象（与 formatCollectorDisplay 同口径）
 * 匹配顺序: id → userId(loginId) → name / userName（大小写不敏感）；同键保留「有姓名+职级」更完整记录
 */
export function resolveCollector(
  userOrId: User | string | undefined | null,
  users: User[] = []
): User | undefined {
  if (!userOrId) return undefined;

  let targetIdStr = '';
  if (typeof userOrId === 'object' && userOrId !== null) {
    if (userOrId.name && userOrId.name !== userOrId.id && userOrId.name !== userOrId.userId && (userOrId.category || userOrId.role)) {
      return userOrId;
    }
    targetIdStr = String(userOrId.id || userOrId.userId || (userOrId as any).loginId || userOrId.name || '').trim();
  } else {
    targetIdStr = String(userOrId).trim();
  }

  if (!targetIdStr || targetIdStr === '-' || targetIdStr === '—' || targetIdStr === 'undefined' || targetIdStr === 'null') {
    return undefined;
  }
  if (targetIdStr === LEGACY_SYSTEM_B2 || targetIdStr === SYS_B2 || targetIdStr === SYS_C || targetIdStr === 'sys_B2' || targetIdStr === 'sys_C') {
    return undefined;
  }

  const idLower = targetIdStr.toLowerCase();
  const namePart = targetIdStr.includes('|') ? targetIdStr.split('|')[0].trim().toLowerCase() : 
                   targetIdStr.includes('·') ? targetIdStr.split('·')[0].trim().toLowerCase() : '';

  const candidates: User[] = [];

  for (const u of users) {
    if (!u) continue;
    const uId = String(u.id || '').trim().toLowerCase();
    const uUserId = String(u.userId || '').trim().toLowerCase();
    const uLoginId = String((u as any).loginId || '').trim().toLowerCase();
    const uCode = String((u as any).code || (u as any).userCode || '').trim().toLowerCase();
    const uName = String(u.name || '').trim().toLowerCase();
    const uUserName = String((u as any).userName || '').trim().toLowerCase();

    if (
      (uId && uId === idLower) ||
      (uUserId && uUserId === idLower) ||
      (uLoginId && uLoginId === idLower) ||
      (uCode && uCode === idLower) ||
      (uName && uName === idLower) ||
      (uUserName && uUserName === idLower) ||
      (namePart && (uName === namePart || uUserName === namePart))
    ) {
      candidates.push(u);
    }
  }

  if (candidates.length === 0) {
    for (const u of users) {
      if (!u) continue;
      const uId = String(u.id || '').trim().toLowerCase();
      const uUserId = String(u.userId || '').trim().toLowerCase();
      const uName = String(u.name || '').trim().toLowerCase();
      if ((uId && uId.includes(idLower)) || (uUserId && uUserId.includes(idLower)) || (uName && uName.includes(idLower))) {
        candidates.push(u);
      }
    }
  }

  if (candidates.length === 0) {
    return typeof userOrId === 'object' ? userOrId : undefined;
  }

  candidates.sort((a, b) => getUserCompletenessScore(b) - getUserCompletenessScore(a));
  return candidates[0];
}

/**
 * 展示归一：将采集主体统一展示为 “姓名 | 职级”
 * 示例：
 *   唐恒 | 中产专
 *   王成 | 中产专
 *   张立 | 高产专
 */
export function formatCollectorDisplay(
  userOrId: User | string | undefined | null,
  users: User[] = []
): string {
  if (!userOrId) return '—';

  const id = typeof userOrId === 'object' && userOrId !== null
    ? String(userOrId.id || userOrId.userId || userOrId.name || '').trim()
    : String(userOrId).trim();

  if (!id || id === '—' || id === '-' || id === 'undefined' || id === 'null') return '—';
  if (id === LEGACY_SYSTEM_B2 || id === SYS_B2) return SYS_B2;
  if (id === SYS_C) return SYS_C;
  if (id === 'sys_B2' || id === 'sys_C') return id === 'sys_B2' ? SYS_B2 : SYS_C;

  const foundUser = resolveCollector(userOrId, users);
  if (foundUser) {
    const name = String(foundUser.name || (foundUser as any).userName || foundUser.userId || foundUser.id || '').trim();
    const rank = String(foundUser.category || getUserRankName(foundUser) || '').trim();

    const isRealName = name && name.toLowerCase() !== String(foundUser.id || '').trim().toLowerCase() && name.toLowerCase() !== String(foundUser.userId || '').trim().toLowerCase();

    if (isRealName && rank && rank !== name) {
      return `${name} | ${rank}`;
    } else if (isRealName) {
      return name;
    }
  }

  if (id.includes('|') || id.includes('·')) {
    return id;
  }

  return '—';
}

/** 提交时解析写侧采集码 */
export function resolveSystemCollectorIdForWrite(opts: {
  costCategory?: string;
  valueConsumptionMode?: string;
  recordedCollectorId?: string;
}): string {
  if (opts.costCategory === 'C') return SYS_C;
  if (opts.costCategory === 'B' && opts.valueConsumptionMode === 'B2') return SYS_B2;
  return opts.recordedCollectorId || '';
}

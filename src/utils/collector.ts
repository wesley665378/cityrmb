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

/**
 * 解析采集人用户对象（与 formatCollectorDisplay 同口径）
 * 匹配顺序: id → userId(loginId) → name / userName（兼容历史误存登录名）
 */
export function resolveCollector(
  userOrId: User | string | undefined | null,
  users: User[] = []
): User | undefined {
  if (!userOrId) return undefined;
  if (typeof userOrId === 'object') return userOrId;

  const id = String(userOrId).trim();
  if (!id || id === LEGACY_SYSTEM_B2 || id === SYS_B2 || id === SYS_C || id === 'sys_B2' || id === 'sys_C') {
    return undefined;
  }

  const idLower = id.toLowerCase();

  // 1. 优先按 id 匹配
  const byId = users.find(u => u && u.id && String(u.id).trim().toLowerCase() === idLower);
  if (byId) return byId;

  // 2. 其次按 userId / loginId 匹配（兼容历史误存登录名/工号）
  const byUserId = users.find(u => {
    if (!u) return false;
    if (u.userId && String(u.userId).trim().toLowerCase() === idLower) return true;
    if ((u as any).loginId && String((u as any).loginId).trim().toLowerCase() === idLower) return true;
    return false;
  });
  if (byUserId) return byUserId;

  // 3. 最后按 name / userName 匹配
  const byName = users.find(u => {
    if (!u) return false;
    if (u.name && String(u.name).trim().toLowerCase() === idLower) return true;
    if ((u as any).userName && String((u as any).userName).trim().toLowerCase() === idLower) return true;
    return false;
  });
  if (byName) return byName;

  return undefined;
}

/**
 * 展示归一：将采集主体统一展示为 “姓名 | 职级”
 * 示例：
 *   唐恒 | 中产专
 *   张立 | 高产专
 */
export function formatCollectorDisplay(
  userOrId: User | string | undefined | null,
  users: User[] = []
): string {
  if (!userOrId) return '-';

  if (typeof userOrId === 'object') {
    const name = userOrId.name || (userOrId as any).userName || userOrId.userId || userOrId.id;
    const rank = userOrId.category || getUserRankName(userOrId);
    return rank ? `${name} | ${rank}` : name;
  }

  const id = String(userOrId).trim();
  if (id === LEGACY_SYSTEM_B2 || id === SYS_B2) return SYS_B2;
  if (id === SYS_C) return SYS_C;
  if (id === 'sys_B2' || id === 'sys_C') return id === 'sys_B2' ? SYS_B2 : SYS_C;

  const foundUser = resolveCollector(id, users);
  if (foundUser) {
    const name = foundUser.name || (foundUser as any).userName || foundUser.userId || id;
    const rank = foundUser.category || getUserRankName(foundUser);
    return rank ? `${name} | ${rank}` : name;
  }
  return id;
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

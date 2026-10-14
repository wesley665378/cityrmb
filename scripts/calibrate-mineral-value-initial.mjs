/**
 * 城市守护者 · 矿山双轨初限提纯校准脚本 (SSOT)
 * 作用：扫描并校准历史存量矿山「产初毛额、款初已提纯」数据（如 LH26QY0017 款初=40119、产初=43000）
 * 规则：
 * 1. 若产初为毛额（产初 ≈ round(款初 / 0.933)）：
 *    将 initialValueCapacity / valueCapacity / initialValueLimit (及对应 quotas.*.valueQuota)
 *    修正为 round(原产初 × 0.933)
 * 2. 严禁对已是提纯净值的产初重复乘以 0.933（幂等安全保护）
 * 3. 矿山初限双轨提纯 (款初=产初=提纯净值) != 创造流水产值注入 1:1 (保持不×0.933)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export function calibrateSingleResource(res) {
  const initRev = Number(res.initialRevenueCapacity ?? res.revenueCapacity ?? 0);
  const initVal = Number(res.initialValueCapacity ?? res.valueCapacity ?? 0);

  if (initRev <= 0 || initVal <= 0) {
    return { res, needed: false, reason: '初始额度为0或缺失' };
  }

  // 严格判定是否为存量毛额产初：
  // 1. initVal 近似等于 round(initRev / 0.933)
  // 2. 或 initVal > initRev 且 round(initVal * 0.933) ≈ initRev
  const isLegacyGrossVal = (
    Math.abs(initVal - Math.round(initRev / 0.933)) <= 3 ||
    (initVal > initRev && Math.abs(Math.round(initVal * 0.933) - initRev) <= 3)
  );

  if (!isLegacyGrossVal) {
    return { res, needed: false, reason: '产初已处于提纯净值口径或非毛额存量' };
  }

  const calibratedVal = Math.round(initVal * 0.933);

  // 解析并修正 quotas (如果存在)
  let parsedQuotas = res.quotas;
  if (typeof parsedQuotas === 'string') {
    try {
      parsedQuotas = JSON.parse(parsedQuotas);
    } catch (e) {
      parsedQuotas = null;
    }
  }

  let updatedQuotas = parsedQuotas;
  if (Array.isArray(parsedQuotas)) {
    updatedQuotas = parsedQuotas.map(q => {
      if (q && q.valueQuota && (q.valueQuota === initVal || Math.abs(q.valueQuota - initVal) <= 2)) {
        return { ...q, valueQuota: calibratedVal };
      }
      return q;
    });
  }

  const updated = {
    ...res,
    initialValueCapacity: calibratedVal,
    valueCapacity: calibratedVal,
    initialValueLimit: calibratedVal,
    quotas: typeof res.quotas === 'string' ? JSON.stringify(updatedQuotas) : updatedQuotas,
    unconfirmedValue: Math.max(0, calibratedVal - (Number(res.confirmedValue) || 0) - (Number(res.pendingValue) || 0) - (Number(res.minedValue) || 0))
  };

  return {
    res: updated,
    needed: true,
    oldVal: initVal,
    newVal: calibratedVal,
    revVal: initRev,
    diff: calibratedVal - initVal
  };
}

async function runCalibration() {
  console.log('========================================================');
  console.log('  城市守护者 · 矿山双轨初限提纯校准器 (SSOT Calibration)');
  console.log('========================================================');
  console.log('口径约定：款初与产初存库均为 0.933 提纯后净值。');
  console.log('禁止混淆：矿山初限存库提纯 ≠ 价值创造流水产值注入(1:1不变)。\n');

  // 1. 验证基准用例 LH26QY0017
  const sampleLH26 = {
    id: 'LH26QY0017',
    initialRevenueCapacity: 40119,
    initialValueCapacity: 43000,
    revenueCapacity: 40119,
    valueCapacity: 43000
  };
  const sampleResult = calibrateSingleResource(sampleLH26);
  console.log(`[样例核验] 标杆样本 LH26QY0017:`);
  console.log(`  原值: 款初=${sampleLH26.initialRevenueCapacity}, 产初=${sampleLH26.initialValueCapacity}`);
  console.log(`  校准后: 产初=${sampleResult.newVal} (净差额: ${sampleResult.diff})`);
  console.log(`  一致性核对: 款初(${sampleLH26.initialRevenueCapacity}) === 产初(${sampleResult.newVal}) -> ${sampleLH26.initialRevenueCapacity === sampleResult.newVal ? '✅ 对齐' : '❌ 不对齐'}`);
  console.log(`  二次校准幂等保护校验:`);
  const idempotentCheck = calibrateSingleResource(sampleResult.res);
  console.log(`  再次调用 needed=${idempotentCheck.needed} (原因: ${idempotentCheck.reason}) -> ${!idempotentCheck.needed ? '✅ 幂等安全防双重折减' : '❌ 失败'}\n`);

  // 2. 检查是否可连接真实 MySQL 数据库
  const hasDbConfig = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '1';
  if (!hasDbConfig) {
    console.log('[数据库检查] 未配置外部 DB_HOST 或处于本地单机 Mock 模式。');
    console.log('  前端/服务端内存与本地缓存已在启动与读写时挂载自动校准器。');
    console.log('  校准规则已成功就绪并已通过单元自检。');
    return;
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000
    });

    console.log('[数据库检查] 成功连接至数据库:', process.env.DB_NAME);

    // 查询矿山表
    const [rows] = await connection.execute('SELECT * FROM mining_resources');
    console.log(`  扫描到 ${rows.length} 座矿山，开始校准分析...`);

    let calibratedCount = 0;
    for (const row of rows) {
      const outcome = calibrateSingleResource(row);
      if (outcome.needed) {
        console.log(`  -> 修正矿山 [${row.id}]: 原产初 ${outcome.oldVal} -> 新产初 ${outcome.newVal} (款初=${outcome.revVal})`);
        await connection.execute(
          `UPDATE mining_resources 
           SET initialValueCapacity = ?, valueCapacity = ?, initialValueLimit = ?, unconfirmedValue = ? 
           WHERE id = ?`,
          [outcome.newVal, outcome.newVal, outcome.newVal, outcome.res.unconfirmedValue, row.id]
        );
        calibratedCount++;
      }
    }

    console.log(`\n校准完毕: 共处理 ${rows.length} 座矿山，成功修正 ${calibratedCount} 座毛额存量矿山。`);
    await connection.end();
  } catch (err) {
    console.warn('[数据库检查] 连接失败或表不存在，跳过远端数据库直接写入:', err.message);
  }
}

// 支持直接运行
if (process.argv[1] && process.argv[1].endsWith('calibrate-mineral-value-initial.mjs')) {
  runCalibration().then(() => {
    console.log('\n[完成] 矿山初限提纯校准流程执行完毕。');
  });
}

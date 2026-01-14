// SPDX-License-Identifier: GPL-3.0-or-later
// AEL 评分计算模块

/**
 * 汇总四个槽位的装备数值，仅关心 ATK 与 元素加成
 * 输入是角色 details.equipments
 */
export function getEquipSumStats(equipments) {
  const sum = { IncElementDmg: 0, StatAtk: 0 };
  if (!equipments) return sum;
  for (let slot = 0; slot < 4; slot++) {
    const eqList = Array.isArray(equipments?.[slot]) ? equipments[slot] : [];
    eqList.forEach(({ function_type, function_value }) => {
      const v = typeof function_value === 'number' ? function_value / 100 : 0;
      if (function_type === 'IncElementDmg') sum.IncElementDmg += v;
      if (function_type === 'StatAtk')       sum.StatAtk       += v;
    });
  }
  return sum;
}

/**
 * 判定该角色是否“未拥有/无数据”，与 excel.js 的逻辑一致
 */
export function isUnowned(details) {
  const { limit_break, skill1_level, skill2_level, skill_burst_level, item_rare = "", item_level, equipments } = details || {};
  const hasLB = (typeof limit_break === 'object' && limit_break && typeof limit_break.grade === 'number' && limit_break.grade >= 0)
             || (typeof limit_break === 'number' && limit_break > 0);
  const hasSkills = [skill1_level, skill2_level, skill_burst_level].some(v => typeof v === 'number' && v > 0);
  const hasItem = (item_rare && item_rare !== "") || (typeof item_level === 'number' && item_level > 0);
  const hasEquips = Object.values(equipments || {}).some(arr => Array.isArray(arr) && arr.length > 0);
  return !(hasLB || hasSkills || hasItem || hasEquips);
}

/**
 * 计算 AEL 分数。
 */
export function computeAELScore({ grade = 0, core = 0, atk = 0, elem = 0 }) {
  const score = (1 + 0.9 * atk) * (1 + (elem + 0.10)) * (grade * 0.03 + core * 0.02 + 1);
  return score;
}

/**
 * 遍历整个字典，为每个角色写入 AtkElemLbScore（保留两位小数）。
 */
export function computeAELForDict(dict) {
  if (!dict || !dict.elements) return;
  Object.keys(dict.elements).forEach(elementKey => {
    const arr = Array.isArray(dict.elements[elementKey]) ? dict.elements[elementKey] : [];
    arr.forEach(details => {
      if (isUnowned(details)) return;
      const { limit_break = {}, equipments } = details;
      const grade = typeof limit_break === 'object' ? (limit_break.grade || 0) : 0;
      const core  = typeof limit_break === 'object' ? (limit_break.core  || 0) : 0;
      const { StatAtk: atk, IncElementDmg: elem } = getEquipSumStats(equipments);
      const score = computeAELScore({ grade, core, atk, elem });
      details.AtkElemLbScore = Number(score.toFixed(2));
    });
  });
}

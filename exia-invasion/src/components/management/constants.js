// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 管理页面常量定义 ==========

export const API_BASE_URL = "https://exia-backend.tigertan1998.workers.dev";

// 默认账户行数据结构
export const defaultRow = () => ({
  username: "",
  email: "",
  password: "",
  cookie: "",
  cookieUpdatedAt: null,
  game_uid: "",
  enabled: true
});

// 装备统计键名列表
export const equipStatKeys = [
  "IncElementDmg",    // 属性伤害
  "StatAtk",          // 攻击力
  "StatAmmoLoad",     // 弹药装载
  "StatChargeTime",   // 充能时间
  "StatChargeDamage", // 充能伤害
  "StatCritical",     // 暴击率
  "StatCriticalDamage", // 暴击伤害
  "StatAccuracyCircle", // 精准度
  "StatDef"           // 防御力
];

// 基础列（突破/技能）键名：用于控制 Excel 导出列是否隐藏
export const basicStatKeys = [
  "limit_break",
  "skill1_level",
  "skill2_level",
  "skill_burst_level"
];

// 妮姬列表开关列数量：AEL + 基础(突破/技能) + 装备词条
export const NIKKE_TOGGLE_COL_COUNT = 1 + basicStatKeys.length + equipStatKeys.length;

// 妮姬表格列宽：固定列 + 剩余空间均分给开关列
export const NIKKE_NAME_MIN_WIDTH_PX = 240;
export const NIKKE_PRIORITY_WIDTH_PX = 120;
export const NIKKE_DRAG_HANDLE_WIDTH_PX = 36;
export const NIKKE_TOGGLE_MIN_WIDTH_PX = 40;

// showStats 配置标记：用于区分"旧数据默认基础列全开"与"用户已手动配置"。
// 注意：该标记不代表任何列的显示，导出端会忽略它。
export const SHOW_STATS_CONFIG_MARKER = "__showStatsConfigured";

// 元素翻译键
export const elementTranslationKeys = {
  Electronic: "electronic",
  Fire: "fire",
  Wind: "wind",
  Water: "water",
  Iron: "iron",
  Utility: "utility"
};

// 职业翻译键
export const classTranslationKeys = {
  Attacker: "attacker",
  Defender: "defender",
  Supporter: "supporter"
};

// 企业翻译键
export const corporationTranslationKeys = {
  ELYSION: "elysion",
  MISSILIS: "missilis",
  TETRA: "tetra",
  PILGRIM: "pilgrim",
  ABNORMAL: "abnormal"
};

// 默认角色数据结构
export const defaultCharactersData = {
  elements: {
    Electronic: [],
    Fire: [],
    Wind: [],
    Water: [],
    Iron: [],
    Utility: []
  },
  options: {
    showEquipDetails: true
  }
};

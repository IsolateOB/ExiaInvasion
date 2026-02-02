// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 请求拦截模块 ==========
// 用于动态注册/注销 declarativeNetRequest 规则，实现多账号并发请求时的 Cookie 隔离

// 规则 ID 起始值（避免与其他规则冲突）
const RULE_ID_BASE = 10000;

// 当前已注册的规则 ID 列表
let registeredRuleIds = [];

/**
 * 为账号列表注册请求拦截规则
 * 每个账号会生成一条规则：当请求 URL 包含 _acct_id=<account.game_uid> 时，
 * 将 Cookie 请求头替换为该账号的 Cookie 字符串
 * 
 * @param {Array<{game_uid: string, cookie: string}>} accounts - 账号列表
 * @returns {Promise<void>}
 */
export const registerCookieRules = async (accounts) => {
  // 先清除旧规则
  await unregisterAllRules();
  
  if (!accounts || accounts.length === 0) return;
  
  const rules = [];
  const newRuleIds = [];
  
  accounts.forEach((account, index) => {
    if (!account.game_uid || !account.cookie) return;
    
    const ruleId = RULE_ID_BASE + index;
    newRuleIds.push(ruleId);
    
    rules.push({
      id: ruleId,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: "Cookie",
            operation: "set",
            value: account.cookie
          }
        ]
      },
      condition: {
        // 匹配包含账号标识的 API 请求
        regexFilter: `.*api\\.blablalink\\.com.*[?&]_acct_id=${account.game_uid}.*`,
        resourceTypes: ["xmlhttprequest"]
      }
    });
  });
  
  if (rules.length === 0) return;
  
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [],
      addRules: rules
    });
    registeredRuleIds = newRuleIds;
    console.log(`[RequestInterceptor] 已注册 ${rules.length} 条规则`);
  } catch (error) {
    console.error("[RequestInterceptor] 注册规则失败:", error);
    throw error;
  }
};

/**
 * 清除所有已注册的动态规则
 * 会同时清除内存记录的规则和 Chrome 存储中实际存在的规则
 * @returns {Promise<void>}
 */
export const unregisterAllRules = async () => {
  try {
    // 从 Chrome 存储中获取实际存在的动态规则
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);
    
    // 合并内存记录和实际存在的规则ID，并去重
    const allRuleIds = [...new Set([...registeredRuleIds, ...existingRuleIds])];
    
    if (allRuleIds.length === 0) {
      console.log("[RequestInterceptor] 无规则需要清除");
      return;
    }
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: allRuleIds,
      addRules: []
    });
    console.log(`[RequestInterceptor] 已清除 ${allRuleIds.length} 条规则 (内存记录: ${registeredRuleIds.length}, 实际存在: ${existingRuleIds.length})`);
    registeredRuleIds = [];
  } catch (error) {
    console.error("[RequestInterceptor] 清除规则失败:", error);
    // 即使失败也重置本地记录，避免状态不一致
    registeredRuleIds = [];
  }
};

/**
 * 获取当前已注册的规则数量（调试用）
 * @returns {number}
 */
export const getRegisteredRuleCount = () => registeredRuleIds.length;

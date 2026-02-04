// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 数据爬取 Hook ==========

import { useState, useCallback } from "react";
import JSZip from "jszip";
import saveDictToExcel from "../../../utils/excel.js";
import { computeAELForDict } from "../../../utils/ael.js";
import { getAccounts, setAccounts, getCharacters, getSettings, getAuth, setSyncMeta, getAccountTemplates, getCurrentAccountTemplateId, saveAccountTemplate } from "../../../services/storage.js";
import { applyCookieStr, clearSiteCookies, getCurrentCookies } from "../../../services/cookie.js";
import { loadBaseAccountDict, getRoleName, prefetchMainlineCatalog, validateCookieWithAccount, getOutpostInfoWithAccount, getCampaignProgressWithAccount, getUserCharactersWithAccount, getCharacterDetailsWithAccount } from "../../../services/api.js";
import { registerCookieRules, unregisterAllRules } from "../../../services/requestInterceptor.js";
import { parseGameUidFromCookie, cookieArrToStr } from "../utils.js";
import { BATCH_SIZE, STAGGER_DELAY, API_BASE_URL } from "../constants.js";

const AUTO_SAVE_DATA = true;

/**
 * 数据爬取 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {string} options.lang - 语言
 * @param {boolean} options.saveAsZip - 是否保存为 ZIP
 * @param {boolean} options.exportJson - 是否导出 JSON
 * @param {boolean} options.activateTab - 是否激活标签页
 * @param {string} options.server - 服务器
 */
export function useCrawler({ t, lang, saveAsZip, exportJson, activateTab, server }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cookieLoading, setCookieLoading] = useState(false);

  const addLog = useCallback((msg) => setLogs((prev) => [...prev, msg]), []);
  const clearLogs = useCallback(() => setLogs([]), []);

  // ========== 云同步功能 ==========
  const syncAccountsToCloud = useCallback(async (addLogFn) => {
    try {
      // 获取认证信息
      const auth = await getAuth();
      if (!auth?.token) {
        addLogFn(t("sync.notLoggedIn") || "未登录，跳过云同步");
        return false;
      }

      // 通知管理页开始同步
      await setSyncMeta({ accountsSyncing: true });

      // 获取设置，检查是否同步敏感信息
      const settings = await getSettings();
      const legacySensitive = Boolean(settings?.syncAccountSensitive);
      const syncAccountEmail = settings?.syncAccountEmail ?? legacySensitive;
      const syncAccountPassword = settings?.syncAccountPassword ?? legacySensitive;

      // 获取最新的 accounts 和 accountTemplates
      const [latestAccounts, accountTemplates, currentTemplateId] = await Promise.all([
        getAccounts(),
        getAccountTemplates(),
        getCurrentAccountTemplateId(),
      ]);

      // 如果有当前模板，先更新模板数据以确保包含最新的 accounts
      let updatedAccountTemplates = accountTemplates || [];
      if (currentTemplateId && latestAccounts.length > 0) {
        const templateIndex = updatedAccountTemplates.findIndex((t) => t.id === currentTemplateId);
        if (templateIndex >= 0) {
          // 更新模板数据
          const updatedTemplate = {
            ...updatedAccountTemplates[templateIndex],
            data: latestAccounts,
          };
          updatedAccountTemplates = [
            ...updatedAccountTemplates.slice(0, templateIndex),
            updatedTemplate,
            ...updatedAccountTemplates.slice(templateIndex + 1),
          ];
          // 保存更新后的模板到 storage
          await saveAccountTemplate(updatedTemplate);
        } else if (updatedAccountTemplates.length === 0) {
          // 如果没有模板但有账号，创建默认模板
          updatedAccountTemplates = [{
            id: currentTemplateId || "1",
            name: "默认账号列表",
            data: latestAccounts,
          }];
          await saveAccountTemplate(updatedAccountTemplates[0]);
        }
      } else if (updatedAccountTemplates.length === 0 && latestAccounts.length > 0) {
        // 如果没有模板但有账号，创建默认模板
        updatedAccountTemplates = [{
          id: "1",
          name: "默认账号列表",
          data: latestAccounts,
        }];
        await saveAccountTemplate(updatedAccountTemplates[0]);
      }
      
      // 构建上传数据
      const sanitizeAccounts = (list) => {
        if (!Array.isArray(list)) return [];
        return list
          .map((acc) => ({
            game_uid: acc?.game_uid || acc?.gameUid || "",
            username: acc?.username || "",
            cookie: acc?.cookie || "",
            cookieUpdatedAt: acc?.cookieUpdatedAt ?? acc?.cookie_updated_at ?? null,
            ...(syncAccountEmail ? { email: acc?.email || "" } : {}),
            ...(syncAccountPassword ? { password: acc?.password || "" } : {}),
          }))
          .filter((acc) => acc.game_uid || acc.cookie || acc.username);
      };

      const payload = updatedAccountTemplates.map((item) => ({
        id: String(item?.id ?? ""),
        name: item?.name || "",
        data: sanitizeAccounts(item?.data || item?.accounts || []),
      })).filter((item) => item.id || item.name);

      if (payload.length === 0) {
        await setSyncMeta({ accountsSyncing: false });
        addLogFn(t("sync.success") || "云同步完成" + " (无数据)");
        return true;
      }

      addLogFn(t("sync.uploading") || "正在同步到云端...");

      const res = await fetch(`${API_BASE_URL}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ lists: payload }),
      });

      if (!res.ok) {
        await setSyncMeta({ accountsSyncing: false });
        throw new Error(`Cloud sync failed: ${res.status}`);
      }

      const uploadResp = await res.json();
      const updatedAt = uploadResp?.updated_at ? new Date(uploadResp.updated_at).getTime() : Date.now();
      
      // 更新同步元数据，管理页会通过 storage.onChanged 监听到
      await setSyncMeta({ accountsLastSyncAt: updatedAt, accountsSyncing: false });
      
      addLogFn(`${t("sync.success") || "云同步完成"} ✓`);
      return true;
    } catch (error) {
      console.error("Cloud sync failed:", error);
      await setSyncMeta({ accountsSyncing: false }).catch(() => {});
      addLogFn(`${t("sync.failed") || "云同步失败"}: ${error.message}`);
      return false;
    }
  }, [t]);

  // ========== Cookie 保存功能 ==========
  const handleSaveCookie = useCallback(async () => {
    chrome.cookies.getAll({ url: "https://www.blablalink.com" }, async (cookies) => {
      console.log(cookies);
      const token = cookies.find((c) => c.name === "game_token");
      if (!token) {
        addLog(t("notLogin"));
        return;
      }
      
      // 自动获取用户名
      let autoUsername = "";
      try {
        const roleInfo = await getRoleName();
        autoUsername = roleInfo.role_name || "";
        addLog(`${t("autoGetUsername")}: ${autoUsername}`);
      } catch (error) {
        console.warn("自动获取用户名失败:", error);
        addLog(t("autoGetUsernameFail"));
        autoUsername = t("noName");
      }
      
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      
      // 提取game_uid
      const gameUidCookie = cookies.find(c => c.name === "game_uid");
      const gameUid = gameUidCookie ? gameUidCookie.value : "";
      
      const accounts = await getAccounts();
      
      // 检查是否已存在相同email/game_uid或cookie的账号
      let existingIndex = -1;
      const emailLike = autoUsername && autoUsername.includes("@") ? autoUsername : "";
      if (emailLike) {
        existingIndex = accounts.findIndex(acc => acc.email === emailLike);
      }
      if (gameUid) {
        // 优先按game_uid查找
        if (existingIndex === -1) {
          existingIndex = accounts.findIndex(acc => acc.game_uid === gameUid);
        }
      }
      if (existingIndex === -1) {
        // 如果没有game_uid或找不到，则按cookie查找
        existingIndex = accounts.findIndex(acc => acc.cookie === cookieStr);
      }
      
      const now = Date.now();
      if (existingIndex !== -1) {
        // 更新现有账号
        accounts[existingIndex].cookie = cookieStr;
        accounts[existingIndex].cookieUpdatedAt = now;
        if (autoUsername) accounts[existingIndex].username = autoUsername;
        if (gameUid) accounts[existingIndex].game_uid = gameUid;
        addLog(`${t("accountUpdated")}: ${autoUsername}`);
      } else {
        // 添加新账号
        accounts.push({
          username: autoUsername,
          email: "",
          password: "",
          cookie: cookieStr,
          cookieUpdatedAt: now,
          game_uid: gameUid,
          enabled: true,
        });
        addLog(`${t("accountSaved")}: ${autoUsername}`);
      }
      
      await setAccounts(accounts);
    });
  }, [t, addLog]);

  // ========== 登录并获取 Cookie ==========
  const loginAndGetCookie = useCallback(async (acc, serverFlag) => {
    const LOGIN_COOKIE_TIMEOUT_MS = 20000;
    const LOGIN_COOKIE_MAX_ATTEMPTS = 2;

    const waitForCookie = () => new Promise((resolve, reject) => {
      const onChanged = (chg) => {
        const c = chg.cookie;
        if (
          !chg.removed &&
          c.domain.endsWith("blablalink.com") &&
          c.name === "game_token"
        ) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        chrome.cookies.onChanged.removeListener(onChanged);
        if (timeoutId) clearTimeout(timeoutId);
      };
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("COOKIE_TIMEOUT"));
      }, LOGIN_COOKIE_TIMEOUT_MS);
      chrome.cookies.onChanged.addListener(onChanged);
    });

    for (let attempt = 1; attempt <= LOGIN_COOKIE_MAX_ATTEMPTS; attempt += 1) {
      addLog(t("getCookie"));
      let tab;
      try {
        tab = await chrome.tabs.create({
          url: "https://www.blablalink.com/login",
          active: activateTab,
        });
        
        await new Promise((resolve) => {
          const listener = (id, info) => {
            if (id === tab.id && info.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (loginInfo) => {
            const { email, password, server } = loginInfo;
            const click = (sel) => document.querySelector(sel)?.click();
            click("#onetrust-accept-btn-handler");
            if (server === "hmt") {
              click("body div.w-full ul > li:nth-child(1)");
            } else {
              click("body div.w-full ul > li:nth-child(2)");
            }
            const waitFor = (sel, timeout = 5000) =>
              new Promise((res) => {
                const st = Date.now();
                const timer = setInterval(() => {
                  if (document.querySelector(sel)) {
                    clearInterval(timer);
                    res(true);
                  } else if (Date.now() - st > timeout) {
                    clearInterval(timer);
                    res(false);
                  }
                }, 100);
              });
            (async () => {
              let ok = await waitFor("#loginPwdForm_account", 2000);
              if (!ok) click(".pass-switchLogin__oper");
              await waitFor("#loginPwdForm_account", 5000);
              
              const setVal = (sel, val) => {
                const el = document.querySelector(sel);
                if (el) {
                  el.value = val;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                }
              };
              setVal("#loginPwdForm_account", email);
              setVal("#loginPwdForm_password", password);
              click('#loginPwdForm button[type="submit"]');
            })();
          },
          args: [{ email: acc.email, password: acc.password, server: serverFlag }],
        });
        
        await waitForCookie();
        if (tab?.id) chrome.tabs.remove(tab.id);
        return;
      } catch (err) {
        if (tab?.id) chrome.tabs.remove(tab.id);
        if (attempt < LOGIN_COOKIE_MAX_ATTEMPTS) {
          addLog(`登录超时，重试 ${attempt + 1}/${LOGIN_COOKIE_MAX_ATTEMPTS}`);
          continue;
        }
        throw err;
      }
    }
  }, [t, activateTab, addLog]);

  // ========== 填充角色详情 ==========
  const addCharacterDetailsToDictWithAccount = useCallback(async (dict, account) => {
    const allNameCodes = [];
    Object.values(dict.elements).forEach(characterArray => {
      characterArray.forEach(details => {
        if (details.name_code !== undefined && details.name_code !== null && details.name_code !== "") {
          allNameCodes.push(details.name_code);
        }
      });
    });
    const uniqueNameCodes = Array.from(new Set(allNameCodes));
    if (uniqueNameCodes.length === 0) return;
    
    try {
      const userCharacters = await getUserCharactersWithAccount(account, account.roleInfo.area_id);
      
      const userCharMap = {};
      userCharacters.forEach(char => {
        userCharMap[char.name_code] = char;
      });
      const ownedSet = new Set(userCharacters.map(char => char.name_code));
      const filteredNameCodes = uniqueNameCodes.filter(code => ownedSet.has(code));
      if (filteredNameCodes.length === 0) return;

      const characterDetails = await getCharacterDetailsWithAccount(account, account.roleInfo.area_id, filteredNameCodes);
      
      const detailsMap = {};
      characterDetails.forEach(detail => {
        detailsMap[detail.name_code] = detail;
      });
      
      Object.keys(dict.elements).forEach(elementKey => {
        const characterArray = dict.elements[elementKey];
        characterArray.forEach(details => {
          const charDetail = detailsMap[details.name_code];
          if (charDetail) {
            details.skill1_level = charDetail.skill1_lv;
            details.skill2_level = charDetail.skill2_lv;
            details.skill_burst_level = charDetail.ulti_skill_lv;
            details.item_level = charDetail.favorite_item_lv >= 0 ? charDetail.favorite_item_lv : "";
            
            if (charDetail.favorite_item_tid) {
              const tidStr = charDetail.favorite_item_tid.toString();
              const firstDigit = parseInt(tidStr.charAt(0));
              const lastDigit = parseInt(tidStr.charAt(tidStr.length - 1));
              
              if (firstDigit === 2) {
                details.item_rare = "SSR";
              } else if (firstDigit === 1) {
                details.item_rare = lastDigit === 1 ? "R" : lastDigit === 2 ? "SR" : "";
              } else {
                details.item_rare = "";
              }
            } else {
              details.item_rare = "";
            }
            
            const userChar = userCharMap[details.name_code];
            if (userChar) {
              details.limit_break = { grade: userChar.grade, core: userChar.core };
            } else if (charDetail) {
              details.limit_break = { grade: charDetail.limitBreak?.grade || 0, core: charDetail.limitBreak?.core || 0 };
            } else {
              details.limit_break = { grade: 0, core: 0 };
            }
            
            details.equipments = charDetail.equipments;
            
            if (charDetail.cube_id && charDetail.cube_level) {
              const cube = dict.cubes.find(c => c.cube_id === charDetail.cube_id);
              if (cube && charDetail.cube_level > cube.cube_level) {
                cube.cube_level = charDetail.cube_level;
              }
            }
          }
        });
      });
    } catch (error) {
      console.error("获取角色详情失败:", error);
      throw error;
    }
  }, []);

  // ========== 数据爬取主流程 ==========
  const handleStart = useCallback(async ({ onlyCookie = false } = {}) => {
    clearLogs();
    if (onlyCookie) {
      setCookieLoading(true);
    } else {
      setLoading(true);
    }

    const shouldExportExcel = true;
    const shouldExportJson = exportJson;
    const shouldZip = saveAsZip && (shouldExportExcel || shouldExportJson);
    
    // 保存当前的cookie，以便运行完成后恢复
    let originalCookies = "";
    
    try {
      // 保存原始cookie
      originalCookies = await getCurrentCookies();
      
      // ========== 步骤0: 检查妮姬列表配置 ==========
      if (!onlyCookie) {
        const characters = await getCharacters();
        const allElementsEmpty = Object.values(characters.elements || {}).every(
          elementArray => !elementArray || elementArray.length === 0
        );
        
        if (allElementsEmpty) {
          addLog(t("emptyNikkeList"));
          addLog(t("pleaseAddNikkes"));
          return;
        }
      }
      
      // ========== 步骤1: 读取账号列表 ==========
      const accountsAll = await getAccounts();
      const normalizedAccounts = accountsAll.map((acc) => ({
        ...acc,
        game_uid: acc.game_uid || parseGameUidFromCookie(acc.cookie) || "",
      }));
      if (JSON.stringify(normalizedAccounts) !== JSON.stringify(accountsAll)) {
        await setAccounts(normalizedAccounts);
      }
      let accounts = normalizedAccounts.filter((a) => a.enabled !== false);
      if (onlyCookie) {
        accounts = accounts.filter((a) => a.enabled !== false);
      }
      if (!accounts.length) {
        addLog(t("emptyAccounts"));
        return;
      }
      
      addLog(t("starting"));
      addLog(`共 ${accounts.length} 个账号，开始并发验证...`);
      
      // 预抓取主线目录（仅执行一次）
      let catalogMap = {};
      try {
        catalogMap = await prefetchMainlineCatalog();
      } catch (e) {
        console.warn("预抓取主线目录失败", e);
      }

      const zip = new JSZip();
      let zipHasFiles = false;
      const excelMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      // ========== 阶段1: 账号验证 ==========
      const validAccounts = [];
      const invalidAccounts = [];
      const noCredAccounts = [];

      if (!onlyCookie) {
        addLog(`----------------------------`);
        addLog(`[阶段1] 并发验证 Cookie...`);
        
        // 注册拦截规则
        await registerCookieRules(accounts);
        
        // 分批并发验证
        for (let batchStart = 0; batchStart < accounts.length; batchStart += BATCH_SIZE) {
          const batch = accounts.slice(batchStart, batchStart + BATCH_SIZE);
          
          const batchPromises = batch.map((acc, idx) => {
            const delay = idx * STAGGER_DELAY;
            return (async () => {
              await new Promise(r => setTimeout(r, delay));
              const result = await validateCookieWithAccount(acc);
              return { acc, result };
            })();
          });
          
          const batchResults = await Promise.all(batchPromises);
          
          for (const { acc, result } of batchResults) {
            if (result.valid) {
              validAccounts.push({ ...acc, roleInfo: result.roleInfo });
              addLog(`✓ ${acc.username || acc.name || t("noName")} - Cookie 有效`);
            } else {
              if (acc.password) {
                invalidAccounts.push(acc);
                addLog(`✗ ${acc.username || acc.name || t("noName")} - Cookie 失效，待重登`);
              } else {
                noCredAccounts.push({ acc, reason: result.error || "Cookie 失效且无密码" });
                addLog(`✗ ${acc.username || acc.name || t("noName")} - ${result.error || "Cookie 失效"}，无密码跳过`);
              }
            }
          }
        }
        
        addLog(`验证完成: ${validAccounts.length} 有效, ${invalidAccounts.length} 待重登, ${noCredAccounts.length} 无法处理`);
      } else {
        // 仅更新 Cookie：跳过验证，直接按启用开关强制重登更新
        accounts.forEach((acc) => {
          if (acc.password) {
            invalidAccounts.push(acc);
          } else {
            noCredAccounts.push({ acc, reason: "无密码，无法更新 Cookie" });
            addLog(`✗ ${acc.username || acc.name || t("noName")} - 无密码跳过`);
          }
        });
      }
      
      // ========== 阶段2: 串行重新登录失效账号 ==========
      if (invalidAccounts.length > 0) {
        addLog(`----------------------------`);
        addLog(onlyCookie ? `串行更新 ${invalidAccounts.length} 个账号 Cookie...` : `[阶段2] 串行重新登录 ${invalidAccounts.length} 个账号...`);
        
        for (const acc of invalidAccounts) {
          addLog(`正在登录: ${acc.username || acc.name || acc.email || t("noName")}`);
          
          try {
            // 清除浏览器 Cookie 并执行登录
            await clearSiteCookies();
            await loginAndGetCookie(acc, server);
            
            // 获取新 Cookie
            const cks = (await chrome.cookies.getAll({}))
              .filter(c => c.domain.endsWith("blablalink.com"));
            const newCookieStr = cookieArrToStr(cks);
            acc.cookie = newCookieStr;
            acc.cookieUpdatedAt = Date.now();
            const gameUidCookie = cks.find(c => c.name === "game_uid");
            if (gameUidCookie) acc.game_uid = gameUidCookie.value;
            
            // 验证新 Cookie
            await applyCookieStr(newCookieStr);
            const roleInfo = await getRoleName();
            
            if (roleInfo.area_id) {
              validAccounts.push({ ...acc, roleInfo });
              addLog(`✓ ${acc.username || roleInfo.role_name || t("noName")} - 登录成功`);
              
              // 回写账号信息
              if (AUTO_SAVE_DATA) {
                if (roleInfo.role_name) acc.username = roleInfo.role_name;
                
                const all = await getAccounts();
                const now = Date.now();
                let existingIndex = -1;
                if (acc.email) {
                  existingIndex = all.findIndex((a) => a.email === acc.email);
                }
                if (existingIndex === -1 && acc.game_uid) {
                  existingIndex = all.findIndex((a) => a.game_uid === acc.game_uid);
                }
                if (existingIndex === -1) {
                  existingIndex = all.findIndex((a) => a.cookie === acc.cookie);
                }
                if (existingIndex !== -1) {
                  all[existingIndex] = {
                    ...all[existingIndex],
                    cookie: acc.cookie,
                    cookieUpdatedAt: now,
                    username: acc.username || all[existingIndex].username,
                    game_uid: acc.game_uid || all[existingIndex].game_uid,
                  };
                } else {
                  all.push({
                    ...acc,
                    cookieUpdatedAt: now,
                    enabled: acc.enabled !== false,
                  });
                }
                await setAccounts(all);
              }
            } else {
              noCredAccounts.push({ acc, reason: "登录后 area_id 为空" });
              addLog(`✗ ${acc.username || acc.name || t("noName")} - 登录后验证失败`);
            }
          } catch (err) {
            noCredAccounts.push({ acc, reason: `登录失败: ${err.message}` });
            addLog(`✗ ${acc.username || acc.name || t("noName")} - ${err.message}`);
          }
        }
        
        // 更新拦截规则
        await registerCookieRules(validAccounts);
      }

      if (onlyCookie) {
        addLog(`----------------------------`);
        addLog(t("cookieOnlyDone"));
        
        // Cookie 更新完成后触发云同步
        addLog(`----------------------------`);
        await syncAccountsToCloud(addLog);
        return;
      }
      
      if (validAccounts.length === 0) {
        addLog(`----------------------------`);
        addLog(`没有可用账号，流程结束`);
        return;
      }
      
      // ========== 阶段3: 并发爬取数据 ==========
      addLog(`----------------------------`);
      addLog(`[阶段3] 并发爬取 ${validAccounts.length} 个账号数据...`);
      
      const successAccounts = [];
      const failedAccounts = [...noCredAccounts.map(({ acc, reason }) => ({ name: acc.username || acc.name || t("noName"), reason }))];
      
      // 单个账号的数据爬取函数
      const crawlAccountData = async (acc) => {
        const accountName = acc.roleInfo?.role_name || acc.username || acc.name || t("noName");
        
        try {
          // 构建数据字典
          const dict = await loadBaseAccountDict();
          dict.name = acc.roleInfo.role_name;
          dict.area_id = acc.roleInfo.area_id;
          dict.cookie = acc.cookie || "";
          
          // 解析 game_uid
          const gameUidMatch = acc.cookie?.match(/game_uid=([^;]*)/);
          dict.game_uid = acc.game_uid || (gameUidMatch ? gameUidMatch[1] : "");
          
          // 获取前哨信息
          const { synchroLevel, outpostLevel } = await getOutpostInfoWithAccount(acc, acc.roleInfo.area_id);
          dict.synchroLevel = synchroLevel;
          dict.outpostLevel = outpostLevel;
          
          // 获取主线进度
          const prog = await getCampaignProgressWithAccount(acc, acc.roleInfo.area_id, catalogMap);
          dict.normalProgress = prog.normal || "";
          dict.hardProgress = prog.hard || "";
          
          // 获取角色详情
          await addCharacterDetailsToDictWithAccount(dict, acc);
          
          // 计算 AEL 分
          computeAELForDict(dict);
          
          // 生成 Excel
          const excelBuffer = shouldExportExcel ? await saveDictToExcel(dict, lang) : null;
          
          return { success: true, accountName, dict, excelBuffer, account: acc };
        } catch (err) {
          return { success: false, accountName, error: err.message };
        }
      };
      
      // 分批并发爬取
      for (let batchStart = 0; batchStart < validAccounts.length; batchStart += BATCH_SIZE) {
        const batch = validAccounts.slice(batchStart, batchStart + BATCH_SIZE);
        
        const batchPromises = batch.map((acc, idx) => {
          const delay = idx * STAGGER_DELAY;
          return (async () => {
            await new Promise(r => setTimeout(r, delay));
            return await crawlAccountData(acc);
          })();
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result.success) {
            successAccounts.push(result.accountName);
            addLog(`✓ ${result.accountName} - 数据爬取完成`);

            // 导出文件
            if (shouldExportJson) {
              const jsonName = `${result.accountName}.json`;
              if (shouldZip) {
                zip.file(jsonName, JSON.stringify(result.dict, null, 4));
                zipHasFiles = true;
              } else {
                const blob = new Blob([JSON.stringify(result.dict, null, 4)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                chrome.downloads.download({ url, filename: jsonName }, () => URL.revokeObjectURL(url));
              }
            }
            
            if (shouldExportExcel && result.excelBuffer) {
              if (shouldZip) {
                zip.file(`${result.accountName}.xlsx`, result.excelBuffer);
                zipHasFiles = true;
              } else {
                const url = URL.createObjectURL(new Blob([result.excelBuffer], { type: excelMime }));
                chrome.downloads.download({ url, filename: `${result.accountName}.xlsx` }, () => URL.revokeObjectURL(url));
              }
            }
          } else {
            failedAccounts.push({ name: result.accountName, reason: result.error });
            addLog(`✗ ${result.accountName} - ${result.error}`);
          }
        }
      }
      
      // 清理拦截规则
      await unregisterAllRules();
      
      // 导出 ZIP
      if (shouldZip && zipHasFiles) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        chrome.downloads.download({ url, filename: "accounts.zip" }, () => URL.revokeObjectURL(url));
      }
      
      // 输出统计信息
      addLog(`----------------------------`);
      addLog(`${t("processComplete")}`);
      addLog(`${t("successCount")}: ${successAccounts.length}`);
      if (failedAccounts.length > 0) {
        addLog(`${t("failedCount")}: ${failedAccounts.length}`);
        addLog(`${t("failedAccounts")}:`);
        failedAccounts.forEach(({ name, reason }) => {
          addLog(`  - ${name} (${reason})`);
        });
      }
      
      // 数据爬取完成后触发云同步
      addLog(`----------------------------`);
      await syncAccountsToCloud(addLog);
      
      addLog(t("done"));
    } catch (e) {
      setLogs((l) => [...l, `[异常] ${e}`]);
      addLog(`${t("fail")}${e}`);
      // 确保清理规则
      await unregisterAllRules().catch(() => {});
    } finally {
      // 恢复原始cookie
      if (originalCookies) {
        await clearSiteCookies();
        await applyCookieStr(originalCookies);
      }
      if (onlyCookie) {
        setCookieLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [t, lang, saveAsZip, exportJson, server, clearLogs, addLog, loginAndGetCookie, addCharacterDetailsToDictWithAccount, syncAccountsToCloud]);

  return {
    logs,
    loading,
    cookieLoading,
    addLog,
    handleSaveCookie,
    handleStart,
  };
}

export default useCrawler;

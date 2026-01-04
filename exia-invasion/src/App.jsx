// SPDX-License-Identifier: GPL-3.0-or-later
// ========== Exia Invasion 主应用组件 ==========
// 主要功能：账户管理、数据爬取、Excel导出、文件合并等

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Stack,
  Switch,
  Button,
  FormControlLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MergeIcon from "@mui/icons-material/Merge";
import JSZip from "jszip";
import saveDictToExcel from "./excel.js";
import { computeAELForDict } from "./ael.js";
import TRANSLATIONS from "./translations";
import { getAccounts, setAccounts, getSettings, setSettings, getCharacters, setCharacters } from "./storage";
import { applyCookieStr, clearSiteCookies, getCurrentCookies } from "./cookie.js";
import { loadBaseAccountDict, getRoleName, getOutpostInfo, getCharacterDetails, getUserCharacters, prefetchMainlineCatalog, getCampaignProgress } from "./api.js";
import { mergeWorkbooks, mergeJsons } from "./merge.js";
import { v4 as uuidv4 } from "uuid";

// ========== React 主组件 ==========
export default function App() {
  // ========== 全局状态管理 ==========
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [tab, setTab] = useState("crawler");
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [autoSaveData, setAutoSaveData] = useState(false);
  const [activateTab, setActivateTab] = useState(false);
  const [server, setServer] = useState("global");
  const [sortFlag, setSortFlag] = useState("1");
  const [excelFilesToMerge, setExcelFilesToMerge] = useState([]);
  const [jsonFilesToMerge, setJsonFilesToMerge] = useState([]);
  const [collapseEquipDetails, setCollapseEquipDetails] = useState(false);
  // 移除了不再需要的弹窗相关状态变量
  // const [dlgOpen, setDlgOpen] = useState(false);
  // const [username, setUsername] = useState("");
  // const [pendingCookieStr, setPendingCookieStr] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const addLog = (msg) => setLogs((prev) => [...prev, msg]);
  
  // ========== 初始化设置加载 ==========
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsZip(Boolean(s.saveAsZip));
      setExportJson(Boolean(s.exportJson));
      setAutoSaveData(Boolean(s.autoSaveData || s.cacheCookie)); // 兼容旧设置
      setActivateTab(Boolean(s.activateTab));
      setServer(s.server || "global");
      setSortFlag(s.sortFlag || "1");

      // 读取全局“折叠词条细节”开关（存储为 characters.options.showEquipDetails：true=显示细节，false=折叠隐藏）
      try {
        const chars = await getCharacters();
        setCollapseEquipDetails(chars?.options?.showEquipDetails === false);
      } catch {
        setCollapseEquipDetails(false);
      }
    })();
  }, []);

  const toggleEquipDetail = async (e) => {
    const collapse = e.target.checked;
    setCollapseEquipDetails(collapse);
    try {
      const chars = await getCharacters();
      const next = {
        ...chars,
        options: {
          ...(chars?.options || {}),
          showEquipDetails: !collapse,
        },
      };
      await setCharacters(next);
    } catch {
      // ignore
    }
  };
  
  // 持久化设置到存储
  const persistSettings = (upd) =>
    setSettings({ lang, saveAsZip, exportJson, autoSaveData, activateTab, server, sortFlag, ...upd });
  
  // ========== UI 事件处理函数 ==========
  const handleTabChange = (event, newTab) => {
    if (newTab !== null) {
      setTab(newTab);
    }
  };
  const toggleLang = (e) => {
    const newLang = e.target.checked ? "en" : "zh";
    setLang(newLang);
    persistSettings({ lang: newLang });
  };
  const toggleSaveZip = (e) => {
    const v = e.target.checked;
    setSaveAsZip(v);
    persistSettings({ saveAsZip: v });
  };
  const changeServer = (e) => {
    const v = e.target.value;
    setServer(v);
    persistSettings({ server: v });
  };
  const handleSortChange = (e) => {
    const v = e.target.value;
    setSortFlag(v);
    persistSettings({ sortFlag: v });
  };
  const handleExcelFileSelect = (e) => {
    setExcelFilesToMerge(Array.from(e.target.files));
  };
  const handleJsonFileSelect = (e) => {
    setJsonFilesToMerge(Array.from(e.target.files));
  };
  
  // ========== Cookie 保存功能 ==========
  const handleSaveCookie = async () => {
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
        autoUsername = t("noName"); // 使用默认名称
      }
      
      // 直接保存账号，无需弹窗
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      
      // 提取game_uid
      const gameUidCookie = cookies.find(c => c.name === "game_uid");
      const gameUid = gameUidCookie ? gameUidCookie.value : "";
      
      const accounts = await getAccounts();
      
      // 检查是否已存在相同game_uid或cookie的账号
      let existingIndex = -1;
      if (gameUid) {
        // 优先按game_uid查找
        existingIndex = accounts.findIndex(acc => acc.game_uid === gameUid);
      }
      if (existingIndex === -1) {
        // 如果没有game_uid或找不到，则按cookie查找
        existingIndex = accounts.findIndex(acc => acc.cookie === cookieStr);
      }
      
      if (existingIndex !== -1) {
        // 更新现有账号
        accounts[existingIndex].username = autoUsername;
        accounts[existingIndex].cookie = cookieStr;
        if (gameUid) accounts[existingIndex].game_uid = gameUid;
        addLog(`${t("accountUpdated")}: ${autoUsername}`);
      } else {
        // 添加新账号
        accounts.push({
          id: uuidv4(),
          username: autoUsername,
          email: "",
          password: "",
          cookie: cookieStr,
          game_uid: gameUid,
          enabled: true,
        });
        addLog(`${t("accountSaved")}: ${autoUsername}`);
      }
      
      await setAccounts(accounts);
    });
  };
  
  // ========== 文件合并主流程 ==========
  const handleMerge = async () => {
    if (!excelFilesToMerge.length && !jsonFilesToMerge.length) {
      addLog(t("upload"));
      return;
    }
    setLogs([]);
    setLoading(true);
    try {
      addLog(t("starting"));
      // 如选择了 Excel，则合并并下载 merged.xlsx
      if (excelFilesToMerge.length) {
        addLog(`开始合并 Excel (${excelFilesToMerge.length} 个)`);
        const mergedBuffer = await mergeWorkbooks(excelFilesToMerge, sortFlag, addLog);
        const blob = new Blob([mergedBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url, filename: "merged.xlsx" }, () =>
          URL.revokeObjectURL(url)
        );
        addLog("Excel 合并完成");
      }

      // 如选择了 JSON，则合并并下载 merged.json
      if (jsonFilesToMerge.length) {
        addLog(`开始合并 JSON (${jsonFilesToMerge.length} 个)`);
        const mergedJsonStr = await mergeJsons(jsonFilesToMerge, sortFlag, addLog);
        const blob = new Blob([mergedJsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url, filename: "merged.json" }, () =>
          URL.revokeObjectURL(url)
        );
        addLog("JSON 合并完成");
      }
      addLog(t("done"));
    } catch (e) {
      addLog(`${t("fail")} ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // ========== 数据爬取主流程 ==========
  const handleStart = async () => {
    setLogs([]);
    setLoading(true);
    
    // 保存当前的cookie，以便运行完成后恢复
    let originalCookies = "";
    
    try {
      // 保存原始cookie
      originalCookies = await getCurrentCookies();
      
      // ========== 步骤0: 检查妮姬列表配置 ==========
      const characters = await getCharacters();
      const allElementsEmpty = Object.values(characters.elements || {}).every(
        elementArray => !elementArray || elementArray.length === 0
      );
      
      if (allElementsEmpty) {
        addLog(t("emptyNikkeList"));
        addLog(t("pleaseAddNikkes"));
        return;
      }
      
      // ========== 步骤1: 读取账号列表 ==========
      const accountsAll = await getAccounts();
      const accounts = accountsAll.filter((a) => a.enabled !== false);
      if (!accounts.length) {
        addLog(t("emptyAccounts"));
        return;
      }
      
      addLog(t("starting"));
      
      // 预抓取主线目录（仅执行一次）
      let catalogMap = {};
      try {
        catalogMap = await prefetchMainlineCatalog();
      } catch (e) {
        console.warn("预抓取主线目录失败", e);
      }

      const zip = new JSZip();
      const excelMime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      // 统计成功和失败的账号
      const successAccounts = [];
      const failedAccounts = [];
      
      // ========== 步骤2: 遍历每个账号 ==========
      for (let i = 0; i < accounts.length; ++i) {
        await clearSiteCookies(); // 清除之前的Cookie，避免干扰
        const acc = { ...accounts[i] }; // 浅拷贝，避免直接修改状态
        addLog(`----------------------------`);
        addLog(`${t("processAccount")}${acc.name || acc.username || t("noName")}`);
        
        // 2-1. 获取可用的Cookie——优先本地缓存，其次邮箱/密码登录
        let cookieStr = acc.cookie || "";
        let usedSavedCookie = false;
        
        if (cookieStr) {
          addLog(t("loginWithCookie"));
          await applyCookieStr(cookieStr);
          usedSavedCookie = true;
        }
        
        if (!cookieStr) {
          if (!acc.password) {
            addLog(t("noPwd"));
            failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: t("noPwd") });
            continue;
          }
          addLog(t("loginWithPwd"));
          try {
            await loginAndGetCookie(acc, server);
          } catch (e) {
            addLog(`${t("loginFail")}${e}`);
            failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: t("loginFail") });
            continue;
          }
        }
        
        /* 2-2. 校验 Cookie 是否有效，顺带拿角色名和区域ID */
        let roleInfo = { role_name: "", area_id: "" };
        try {
          roleInfo = await getRoleName();
          console.log(`角色名：${roleInfo.role_name}, 区域ID：${roleInfo.area_id}`);
          // 空昵称不再直接判定为 Cookie 失效
        } catch (err) { // 请求异常才认为 Cookie 失效
          if (usedSavedCookie && acc.password) {
            addLog(t("cookieExpired"));
            try {
              await loginAndGetCookie(acc, server);
              roleInfo = await getRoleName();
            } catch (err2) {
              addLog(`${t("reloginFail")}${err2}`);
              failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: t("reloginFail") });
              continue;
            }
          } else {
            addLog(`${t("getRoleNameFail")}${err}`);
            failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: t("getRoleNameFail") });
            continue;
          }
        }

        // 二次校验：若 area_id 缺失或（昵称与旧名都缺）视为 Cookie 失效，尝试重登一次
        const invalidRole = !roleInfo.area_id || roleInfo.area_id === "";
        if (invalidRole) {
          if (usedSavedCookie && acc.password) {
            addLog(t("cookieExpired"));
            try {
              await loginAndGetCookie(acc, server);
              roleInfo = await getRoleName();
              if (!roleInfo.area_id) {
                addLog(t("getRoleNameFail") + "area_id empty after relogin");
                failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: "area_id empty" });
                continue;
              }
            } catch (e) {
              addLog(t("reloginFail") + e);
              failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: t("reloginFail") });
              continue;
            }
          } else {
            addLog(t("getRoleNameFail") + "area_id empty");
            failedAccounts.push({ name: acc.name || acc.username || t("noName"), reason: "area_id empty" });
            continue;
          }
        }
        addLog(`${t("roleOk")}${roleInfo.role_name}`);
        
        /* 回写账号cookie、用户名和game_uid */
        if (autoSaveData) {
          const cks = (await chrome.cookies.getAll({}))
            .filter(c => c.domain.endsWith("blablalink.com"));
          acc.cookie = cookieArrToStr(cks);
          if (roleInfo.role_name) {
            acc.username = roleInfo.role_name; // 仅在非空时覆盖用户名
          }
          
          // 提取并保存game_uid
          const gameUidCookie = cks.find(c => c.name === "game_uid");
          if (gameUidCookie) {
            acc.game_uid = gameUidCookie.value;
          }
          
          const all = await getAccounts();
          const idx = all.findIndex(a => a.id === acc.id);
          if (idx !== -1) all[idx] = acc;
          await setAccounts(all);
          addLog(t("dataUpdated"));
        }
        
        // ========== 步骤3: 构建数据字典 ==========
        let dict;
        try {
          // 3-1. 载入基础模板并写入账号名 / game_uid / area_id / cookie
          dict = await loadBaseAccountDict();
          dict.name = roleInfo.role_name;
          dict.area_id = roleInfo.area_id;
          dict.cookie = acc.cookie || "";
          
          // 写入 game_uid：优先使用账号已有值；否则尝试从当前 Cookie 读取
          dict.game_uid = acc.game_uid || "";
          if (!dict.game_uid) {
            try {
              const cks = (await chrome.cookies.getAll({}))
                .filter(c => c.domain.endsWith("blablalink.com"));
              const gameUidCookie = cks.find(c => c.name === "game_uid");
              if (gameUidCookie) dict.game_uid = gameUidCookie.value;
            } catch {
              // ignore
            }
          }
          
          // 3-2. 获取同步器等级 + 前哨基地等级
          if (roleInfo.area_id) {
            const { synchroLevel, outpostLevel } = await getOutpostInfo(roleInfo.area_id);
            dict.synchroLevel = synchroLevel;
            dict.outpostLevel = outpostLevel;
            // 3-2.2 获取主线进度（Normal/Hard）
            const prog = await getCampaignProgress(roleInfo.area_id, catalogMap);
            dict.normalProgress = prog.normal || "";
            dict.hardProgress = prog.hard || "";
          } else {
            addLog(t("getRoleNameFail") + "area_id empty");
          }
          
          // 3-3. 获取角色详情和装备信息（合并请求）
          await addCharacterDetailsToDict(dict, roleInfo.area_id);
          // 3-4. 计算 AEL 分并写入字典，便于 JSON 导出携带同样数值
          computeAELForDict(dict);
          addLog(t("characterDetailsOk"));
        } catch (err) {
          addLog(`${t("dictFail")}${err}`);
          failedAccounts.push({ name: acc.name || acc.username || roleInfo.role_name || t("noName"), reason: t("dictFail") });
          continue;
        }
        
        // ========== 步骤4: 生成Excel文件 ==========
        let excelBuffer;
        try {
          excelBuffer = await saveDictToExcel(dict, lang);
        } catch (err) {
          addLog(`${t("excelFail")}${err}`);
          failedAccounts.push({ name: acc.name || acc.username || roleInfo.role_name || t("noName"), reason: t("excelFail") });
          continue;
        }
        
        // ========== 步骤5: 导出JSON文件 ==========
        if (exportJson) {
          const jsonName = `${roleInfo.role_name || acc.name || acc.username}.json`;
          if (saveAsZip) {
            zip.file(jsonName, JSON.stringify(dict, null, 4));
          } else {
            const blob = new Blob([JSON.stringify(dict, null, 4)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download(
              { url, filename: jsonName },
              () => URL.revokeObjectURL(url)
            );
          }
        }
        
        // ========== 步骤6: 导出Excel文件 ==========
        if (saveAsZip) {
          zip.file(`${roleInfo.role_name || acc.name || acc.username}.xlsx`, excelBuffer);
        } else {
          const url = URL.createObjectURL(new Blob([excelBuffer], { type: excelMime }));
          chrome.downloads.download(
            { url, filename: `${roleInfo.role_name || acc.name || acc.username}.xlsx` },
            () => URL.revokeObjectURL(url)
          );
        }
        
        // 记录成功的账号
        successAccounts.push(roleInfo.role_name || acc.name || acc.username || t("noName"));
      } // for-loop 结束
      
      /* ---------- 步骤6: 完成所有账号处理 ---------- */
      if (saveAsZip) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        chrome.downloads.download(
          { url, filename: "accounts.zip" },
          () => URL.revokeObjectURL(url)
        );
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
      
      addLog(t("done"));
    } catch (e) {
      setLogs((l) => [...l, `[异常] ${e}`]);
      addLog(`${t("fail")}${e}`);
    } finally {
      // 恢复原始cookie
      if (originalCookies) {
        await clearSiteCookies();
        await applyCookieStr(originalCookies);
      }
      setLoading(false);
    }
  };
  
  /* ========== 辅助函数：填充角色详情和装备信息 ========== */
  const addCharacterDetailsToDict = async (dict, areaId) => {
    // 收集所有需要查询的name_codes
    const allNameCodes = [];
    Object.values(dict.elements).forEach(characterArray => {
      characterArray.forEach(details => {
        allNameCodes.push(details.name_code);
      });
    });
    
    if (allNameCodes.length === 0) return;
    
    try {
      // 首先获取所有角色的基础信息（包含core和grade）
      const userCharacters = await getUserCharacters(areaId);
      
      // 创建name_code到基础信息的映射
      const userCharMap = {};
      userCharacters.forEach(char => {
        userCharMap[char.name_code] = char;
      });
      
      // 批量获取角色详情和装备信息
      const characterDetails = await getCharacterDetails(areaId, allNameCodes);
      
      // 创建name_code到详情的映射
      const detailsMap = {};
      characterDetails.forEach(detail => {
        detailsMap[detail.name_code] = detail;
      });
      
      // 更新dict中的角色信息
      Object.keys(dict.elements).forEach(elementKey => {
        const characterArray = dict.elements[elementKey];
        characterArray.forEach(details => {
          const charDetail = detailsMap[details.name_code];
          if (charDetail) {
            // 更新技能等级
            details.skill1_level = charDetail.skill1_lv;
            details.skill2_level = charDetail.skill2_lv;
            details.skill_burst_level = charDetail.ulti_skill_lv;
            
            // 更新珍藏品信息
            details.item_level = charDetail.favorite_item_lv >= 0 ? charDetail.favorite_item_lv : "";
            
            // 根据favorite_item_tid判断珍藏品稀有度
            if (charDetail.favorite_item_tid) {
              const tidStr = charDetail.favorite_item_tid.toString();
              const firstDigit = parseInt(tidStr.charAt(0));
              const lastDigit = parseInt(tidStr.charAt(tidStr.length - 1));
              
              if (firstDigit === 2) {
                details.item_rare = "SSR";
              } else if (firstDigit === 1) {
                if (lastDigit === 1) {
                  details.item_rare = "R";
                } else if (lastDigit === 2) {
                  details.item_rare = "SR";
                } else {
                  details.item_rare = "";
                }
              } else {
                details.item_rare = "";
              }
            } else {
              details.item_rare = "";
            }
            
            // 更新突破信息（优先使用getUserCharacters的数据）
            const userChar = userCharMap[details.name_code];
            if (userChar) {
              details.limit_break = {
                grade: userChar.grade,
                core: userChar.core
              };
            } else if (charDetail) {
              // 如果getUserCharacters没有数据，使用详情API的数据作为备用
              details.limit_break = {
                grade: charDetail.limitBreak?.grade || 0,
                core: charDetail.limitBreak?.core || 0
              };
            } else {
              details.limit_break = {
                grade: 0,
                core: 0
              };
            }
            
            // 更新装备信息
            details.equipments = charDetail.equipments;
            
            // 更新魔方等级（如果角色有魔方信息）
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
  };

  /* ========== 辅助函数：Cookie 数组转字符串 ========== */
  const cookieArrToStr = (cks) => {
    const map = new Map();
    
    // 后出现的同名 cookie 会覆盖前面的，优先保留根路径
    cks.forEach((c) => {
      if (!map.has(c.name) || c.path === "/") {
        map.set(c.name, c.value);
      }
    });
    
    return [...map.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  };
  
  /* ========== 登录并获取 Cookie ========== */
  const loginAndGetCookie = async (acc, serverFlag) => {
    addLog(t("getCookie"));
    
    const tab = await chrome.tabs.create({
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
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("login timeout")), 15000);
      const onChanged = (chg) => {
        const c = chg.cookie;
        if (
          !chg.removed &&
          c.domain.endsWith("blablalink.com") &&
          c.name === "game_token"
        ) {
          chrome.cookies.onChanged.removeListener(onChanged);
          clearTimeout(timeout);
          resolve();
        }
      };
      chrome.cookies.onChanged.addListener(onChanged);
    });
    
    chrome.tabs.remove(tab.id);
  };
  
  // 图标路径获取
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ========== UI 界面渲染 ========== */
  return (
    <>
      <AppBar position="sticky">
        <Toolbar variant="dense">
          <img
            src={iconUrl}
            alt="logo"
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ExiaInvasion
          </Typography>
          <Box display="flex" alignItems="center" sx={{ ml: 1, color: "white" }}>
            <Typography variant="caption">中文</Typography>
            <Switch size="small" color="default" checked={lang === "en"} onChange={toggleLang} />
            <Typography variant="caption">EN</Typography>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 2, width: 340, pb: 1 }}>
        <ToggleButtonGroup
          value={tab}
          exclusive
          fullWidth
          onChange={handleTabChange}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="crawler">{t("crawlerTab")}</ToggleButton>
          <ToggleButton value="merge">{t("mergeTab")}</ToggleButton>
        </ToggleButtonGroup>
        
        <Stack spacing={2}>
          {tab === "crawler" && (
            <>
              {/* 保存当前 Cookie */}
              <Button
                variant="outlined"
                fullWidth
                onClick={handleSaveCookie}
                startIcon={<SaveIcon />}
              >
                {t("saveCookie")}
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => chrome.runtime.openOptionsPage()}
                startIcon={<SettingsIcon />}
              >
                {t("management")}
              </Button>
              <Stack spacing={1}>
                <FormControlLabel
                  control={<Switch checked={saveAsZip} onChange={toggleSaveZip} />}
                  label={t("saveAsZip")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoSaveData}
                      onChange={(e) => {
                        setAutoSaveData(e.target.checked);
                        persistSettings({ autoSaveData: e.target.checked });
                      }}
                    />
                  }
                  label={t("autoSaveData")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={exportJson}
                      onChange={(e) => {
                        setExportJson(e.target.checked);
                        persistSettings({ exportJson: e.target.checked });
                      }}
                    />
                  }
                  label={t("exportJson")}
                />
                <FormControlLabel
                      control={<Switch checked={collapseEquipDetails} onChange={toggleEquipDetail} />}
                  label={t("equipDetail")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={activateTab}
                      onChange={(e) => {
                        setActivateTab(e.target.checked);
                        persistSettings({ activateTab: e.target.checked });
                      }}
                    />
                  }
                  label={t("activateTab")}
                />
              </Stack>
              
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t("server")}
                </Typography>
                <Select
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={server}
                  onChange={changeServer}
                >
                  <MenuItem value="hmt">{t("hmt")}</MenuItem>
                  <MenuItem value="global">{t("global")}</MenuItem>
                </Select>
              </Box>
              {/* 运行按钮 */}
              <Button
                variant="contained"
                fullWidth
                onClick={handleStart}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <PlayArrowIcon />
                  )
                }
                disabled={loading}
              >
                {t("start")}
              </Button>
            </>
          )}
          
          {tab === "merge" && (
            <>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                startIcon={<UploadFileIcon />}
              >
                {t("upload")} Excel ({excelFilesToMerge.length})
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={handleExcelFileSelect}
                  accept=".xlsx"
                />
              </Button>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                startIcon={<UploadFileIcon />}
              >
                {t("upload")} JSON ({jsonFilesToMerge.length})
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={handleJsonFileSelect}
                  accept=".json"
                />
              </Button>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t("mergeOption")}
                </Typography>
                <Select
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={sortFlag}
                  onChange={handleSortChange}
                >
                  <MenuItem value="1">{t("nameAsc")}</MenuItem>
                  <MenuItem value="2">{t("nameDesc")}</MenuItem>
                  <MenuItem value="3">{t("syncAsc")}</MenuItem>
                  <MenuItem value="4">{t("syncDesc")}</MenuItem>
                </Select>
              </Box>
              <Button
                variant="contained"
                fullWidth
                onClick={handleMerge}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <MergeIcon />
                  )
                }
                disabled={loading || (!excelFilesToMerge.length && !jsonFilesToMerge.length)}
              >
                {t("merge")}
              </Button>
            </>
          )}
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 400,
              overflowY: "auto",
              whiteSpace: "pre-line",
              fontSize: 12,
            }}
          >
            {logs.join("\n")}
          </Paper>
        </Stack>
      </Container>
      
    </>
  );
}
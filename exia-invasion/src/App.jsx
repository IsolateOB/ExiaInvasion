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
  Avatar,
  Menu,
  ListItemIcon,
  Divider,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MergeIcon from "@mui/icons-material/Merge";
import JSZip from "jszip";
import saveDictToExcel from "./excel.js";
import { computeAELForDict } from "./ael.js";
import TRANSLATIONS from "./translations";
import { getAccounts, setAccounts, getSettings, setSettings, getCharacters, setCharacters, getAuth, setAuth, clearAuth } from "./storage";
import { isAccountsEmpty, isCharactersEmpty, normalizeAccountsFromRemote, buildAccountsSignature, buildCharactersSignature } from "./cloudCompare.js";
import { applyCookieStr, clearSiteCookies, getCurrentCookies } from "./cookie.js";
import { loadBaseAccountDict, getRoleName, prefetchMainlineCatalog, validateCookieWithAccount, getOutpostInfoWithAccount, getCampaignProgressWithAccount, getUserCharactersWithAccount, getCharacterDetailsWithAccount } from "./api.js";
import { mergeWorkbooks, mergeJsons } from "./merge.js";
import { registerCookieRules, unregisterAllRules } from "./requestInterceptor.js";

const API_BASE_URL = "https://exia-backend.tigertan1998.workers.dev";
const AVATAR_URL = "https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp";

const fetchProfile = async (token) => {
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
};

const parseGameUidFromCookie = (cookieStr) => {
  if (!cookieStr) return "";
  const match = cookieStr.match(/(?:^|;\s*)game_uid=([^;]*)/);
  return match ? match[1] : "";
};


// ========== React 主组件 ==========
export default function App() {
  // ========== 全局状态管理 ==========
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [tab, setTab] = useState("crawler");
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [syncAccountSensitive, setSyncAccountSensitive] = useState(false);
  const autoSaveData = true;
  const [activateTab, setActivateTab] = useState(false);
  const [server, setServer] = useState("global");
  const [sortFlag, setSortFlag] = useState("1");
  const [excelFilesToMerge, setExcelFilesToMerge] = useState([]);
  const [jsonFilesToMerge, setJsonFilesToMerge] = useState([]);
  const [collapseEquipDetails, setCollapseEquipDetails] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cookieLoading, setCookieLoading] = useState(false);
  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  const [authToken, setAuthToken] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authAnchorEl, setAuthAnchorEl] = useState(null);

  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const handleStatusChange = (message, severity = "info") => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };
  
  // ========== 初始化设置加载 ==========
  useEffect(() => {
    (async () => {
      const [s, chars] = await Promise.all([
        getSettings(),
        getCharacters().catch(() => null),
      ]);
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsZip(Boolean(s.saveAsZip));
      setExportJson(Boolean(s.exportJson));
      setSyncAccountSensitive(Boolean(s.syncAccountSensitive));
      setActivateTab(Boolean(s.activateTab));
      setServer(s.server || "global");
      setSortFlag(s.sortFlag || "1");

      // 读取全局“折叠词条细节”开关（存储为 characters.options.showEquipDetails：true=显示细节，false=折叠隐藏）
      setCollapseEquipDetails(chars?.options?.showEquipDetails === false);
    })();
  }, []);

  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.settings) {
        const nextLang = changes.settings.newValue?.lang;
        if (nextLang) setLang(nextLang);
        if ("syncAccountSensitive" in (changes.settings.newValue || {})) {
          setSyncAccountSensitive(Boolean(changes.settings.newValue?.syncAccountSensitive));
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  useEffect(() => {
    getAuth().then((auth) => {
      if (auth?.token && auth?.username) {
        setAuthToken(auth.token);
        setAuthUsername(auth.username);
        setAuthAvatarUrl(auth.avatar_url || null);
      }
    });
  }, []);

  useEffect(() => {
    if (authToken && authUsername) {
      setAuth({ token: authToken, username: authUsername, avatar_url: authAvatarUrl });
      return;
    }
    clearAuth();
  }, [authToken, authUsername, authAvatarUrl]);

  useEffect(() => {
    if (!authToken || authAvatarUrl) return;
    fetchProfile(authToken)
      .then((profile) => {
        if (profile?.avatar_url) {
          setAuthAvatarUrl(profile.avatar_url);
        }
        if (profile?.username && !authUsername) {
          setAuthUsername(profile.username);
        }
      })
      .catch(() => {});
  }, [authToken, authAvatarUrl, authUsername]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    (async () => {
      try {
        const [localAccounts, localCharacters, remoteAccountsResp, remoteCharactersResp] = await Promise.all([
          getAccounts(),
          getCharacters(),
          fetch(`${API_BASE_URL}/accounts`, { headers: { Authorization: `Bearer ${authToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE_URL}/characters`, { headers: { Authorization: `Bearer ${authToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        const remoteAccounts = normalizeAccountsFromRemote(remoteAccountsResp?.account_data);
        const remoteCharacters = remoteCharactersResp?.character_data || null;

        const localAccountsEmpty = isAccountsEmpty(localAccounts);
        const remoteAccountsEmpty = isAccountsEmpty(remoteAccounts);
        const localCharactersEmpty = isCharactersEmpty(localCharacters);
        const remoteCharactersEmpty = isCharactersEmpty(remoteCharacters);

        let mismatch = false;

        if (!localAccountsEmpty && !remoteAccountsEmpty) {
          const localSig = buildAccountsSignature(localAccounts);
          const remoteSig = buildAccountsSignature(remoteAccounts);
          if (localSig !== remoteSig) mismatch = true;
        }

        if (!localCharactersEmpty && !remoteCharactersEmpty) {
          const localSig = buildCharactersSignature(localCharacters || {});
          const remoteSig = buildCharactersSignature(remoteCharacters || {});
          if (localSig !== remoteSig) mismatch = true;
        }
        if (mismatch) {
          handleStatusChange(t("sync.conflictDesc") || "本地数据与云端数据不一致，请前往管理页处理。", "warning");
        }
      } catch (err) {
        console.error("cloud compare failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, t]);

  const toggleEquipDetail = async (e) => {
    const collapse = e.target.checked;
    setCollapseEquipDetails(collapse);
    const chars = await getCharacters();
    const next = {
      ...chars,
      options: {
        ...(chars?.options || {}),
        showEquipDetails: !collapse,
      },
    };
    await setCharacters(next);
  };
  
  // 持久化设置到存储
  const persistSettings = (upd) =>
    setSettings({ lang, saveAsZip, exportJson, syncAccountSensitive, activateTab, server, sortFlag, ...upd });
  
  // ========== UI 事件处理函数 ==========
  const handleTabChange = (event, newTab) => {
    if (newTab !== null) {
      setTab(newTab);
    }
  };
  const authTitle = useMemo(() => {
    return authMode === "login"
      ? (t("auth.titleLogin") || "登录")
      : (t("auth.titleRegister") || "注册");
  }, [authMode, t]);

  const openLoginDialog = () => {
    setAuthMode("login");
    setAuthForm({ username: "", password: "" });
    setAuthDialogOpen(true);
  };

  const openRegisterDialog = () => {
    setAuthMode("register");
    setAuthForm({ username: "", password: "" });
    setAuthDialogOpen(true);
  };

  const closeAuthDialog = () => {
    if (authSubmitting) return;
    setAuthDialogOpen(false);
  };

  const handleAuthSubmit = async () => {
    if (!authForm.username.trim() || !authForm.password.trim()) {
      handleStatusChange(t("auth.required") || "请填写用户名和密码", "warning");
      return;
    }
    setAuthSubmitting(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/register";
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password,
        }),
      });

      if (!res.ok) {
        const msg = authMode === "login"
          ? (t("auth.failedLogin") || "登录失败")
          : (t("auth.failedRegister") || "注册失败");
        handleStatusChange(msg, "error");
        return;
      }

      if (authMode === "register") {
        handleStatusChange(t("auth.successRegister") || "注册成功，请登录", "success");
        setAuthMode("login");
        setAuthForm((prev) => ({ ...prev, password: "" }));
        return;
      }

      const data = await res.json();
      if (data?.token) {
        setAuthToken(data.token);
        setAuthUsername(data?.username || authForm.username.trim());
        setAuthAvatarUrl(data?.avatar_url || null);
        setAuthDialogOpen(false);
        handleStatusChange(t("auth.successLogin") || "登录成功", "success");
      } else {
        handleStatusChange(t("auth.failedLogin") || "登录失败", "error");
      }
    } catch {
      const msg = authMode === "login"
        ? (t("auth.failedLogin") || "登录失败")
        : (t("auth.failedRegister") || "注册失败");
      handleStatusChange(msg, "error");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUsername(null);
    setAuthAvatarUrl(null);
    handleStatusChange(t("auth.logoutSuccess") || "已退出", "success");
  };

  const handleAvatarClick = (event) => {
    setAuthAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAuthAnchorEl(null);
  };


  const handleLogoutClick = () => {
    handleMenuClose();
    handleLogout();
  };

  const toggleSaveZip = (e) => {
    const v = e.target.checked;
    setSaveAsZip(v);
    persistSettings({ saveAsZip: v });
  };
  const toggleExportJson = (e) => {
    const v = e.target.checked;
    setExportJson(v);
    persistSettings({ exportJson: v });
  };
  const toggleSyncAccountSensitive = (e) => {
    const v = e.target.checked;
    setSyncAccountSensitive(v);
    persistSettings({ syncAccountSensitive: v });
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
      const tasks = [];
      // 如选择了 Excel，则合并并下载 merged.xlsx
      if (excelFilesToMerge.length) {
        tasks.push((async () => {
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
        })());
      }

      // 如选择了 JSON，则合并并下载 merged.json
      if (jsonFilesToMerge.length) {
        tasks.push((async () => {
          addLog(`开始合并 JSON (${jsonFilesToMerge.length} 个)`);
          const mergedJsonStr = await mergeJsons(jsonFilesToMerge, sortFlag, addLog);
          const blob = new Blob([mergedJsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          chrome.downloads.download({ url, filename: "merged.json" }, () =>
            URL.revokeObjectURL(url)
          );
          addLog("JSON 合并完成");
        })());
      }
      if (tasks.length) {
        await Promise.all(tasks);
      }
      addLog(t("done"));
    } catch (e) {
      addLog(`${t("fail")} ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // ========== 数据爬取主流程（并发模式） ==========
  const handleStart = async ({ onlyCookie = false } = {}) => {
    setLogs([]);
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
    
    // 并发控制参数
    const BATCH_SIZE = 5;        // 每批次最大并发数
    const STAGGER_DELAY = 1000;  // 批次内请求间隔（毫秒）
    
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
      
      // ========== 阶段1: 账号验证（仅非更新 Cookie 模式） ==========
      const validAccounts = [];   // Cookie有效的账号
      const invalidAccounts = []; // 需要重新登录的账号
      const noCredAccounts = [];  // 没有密码无法重登的账号

      if (!onlyCookie) {
        addLog(`----------------------------`);
        addLog(`[阶段1] 并发验证 Cookie...`);
        
        // 注册拦截规则
        await registerCookieRules(accounts);
        
        // 分批并发验证
        for (let batchStart = 0; batchStart < accounts.length; batchStart += BATCH_SIZE) {
          const batch = accounts.slice(batchStart, batchStart + BATCH_SIZE);
          
          // 批次内交错发起请求
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
              if (autoSaveData) {
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
        
        // 更新拦截规则（包含新登录的账号）
        await registerCookieRules(validAccounts);
      }

        if (onlyCookie) {
          addLog(`----------------------------`);
          addLog(t("cookieOnlyDone"));
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
          
          // 获取角色详情（并发模式版本）
          await addCharacterDetailsToDictWithAccount(dict, acc);
          
          // 计算 AEL 分
          computeAELForDict(dict);
          
          // 生成 Excel（可选）
          const excelBuffer = shouldExportExcel ? await saveDictToExcel(dict, lang) : null;
          
          return { success: true, accountName, dict, excelBuffer, account: acc };
        } catch (err) {
          return { success: false, accountName, error: err.message };
        }
      };
      
      // 分批并发爬取
      for (let batchStart = 0; batchStart < validAccounts.length; batchStart += BATCH_SIZE) {
        const batch = validAccounts.slice(batchStart, batchStart + BATCH_SIZE);
        
        // 批次内交错发起请求
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
  };
  
  /* ========== 辅助函数：填充角色详情（并发模式版本） ========== */
  const addCharacterDetailsToDictWithAccount = async (dict, account) => {
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
    
    await new Promise((resolve) => {
      // 移除超时限制，允许用户充分时间处理验证码
      const onChanged = (chg) => {
        const c = chg.cookie;
        if (
          !chg.removed &&
          c.domain.endsWith("blablalink.com") &&
          c.name === "game_token"
        ) {
          chrome.cookies.onChanged.removeListener(onChanged);
          resolve();
        }
      };
      chrome.cookies.onChanged.addListener(onChanged);
    });
    
    chrome.tabs.remove(tab.id);
  };
  
  // 图标路径获取
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  const menuOpen = Boolean(authAnchorEl);
  
  /* ========== UI 界面渲染 ========== */
  return (
    <>
      <AppBar position="sticky">
        <Toolbar variant="dense">
          <img
            src={iconUrl}
            alt="logo"
            width={32}
            height={32}
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ExiaInvasion
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {authUsername ? (
              <>
                <Avatar
                  src={authAvatarUrl || AVATAR_URL}
                  alt={authUsername}
                  onClick={handleAvatarClick}
                  sx={{
                    width: 32,
                    height: 32,
                    cursor: "pointer",
                    border: "2px solid rgba(255, 255, 255, 0.8)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "scale(1.05)",
                      boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)",
                    },
                  }}
                />
                <Menu
                  anchorEl={authAnchorEl}
                  open={menuOpen}
                  onClose={handleMenuClose}
                  onClick={handleMenuClose}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                  slotProps={{
                    paper: {
                      elevation: 3,
                      sx: {
                        mt: 1,
                        minWidth: 180,
                        borderRadius: 2,
                        overflow: "visible",
                        "&::before": {
                          content: '""',
                          display: "block",
                          position: "absolute",
                          top: 0,
                          right: 14,
                          width: 10,
                          height: 10,
                          bgcolor: "background.paper",
                          transform: "translateY(-50%) rotate(45deg)",
                          zIndex: 0,
                        },
                      },
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t("auth.greeting") || "出刀吧！"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {authUsername}
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem onClick={handleLogoutClick} sx={{ py: 1.5 }}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    {t("auth.logout") || "退出"}
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button variant="outlined" color="inherit" onClick={openLoginDialog}>
                {t("auth.login") || "登录"}
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 2, width: 340, pb: 1 }}>
        <ToggleButtonGroup
          value={tab}
          exclusive
          fullWidth
          onChange={handleTabChange}
          aria-label={t("crawlerTab")}
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
                  control={<Switch checked={exportJson} onChange={toggleExportJson} />}
                  label={t("exportJson")}
                />
                <FormControlLabel
                  control={<Switch checked={syncAccountSensitive} onChange={toggleSyncAccountSensitive} />}
                  label={t("syncAccountSensitive")}
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
                  inputProps={{ "aria-label": t("server") }}
                >
                  <MenuItem value="hmt">{t("hmt")}</MenuItem>
                  <MenuItem value="global">{t("global")}</MenuItem>
                </Select>
              </Box>
              {/* 运行按钮 */}
              <Button
                variant="contained"
                fullWidth
                onClick={() => handleStart({ onlyCookie: false })}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <PlayArrowIcon />
                  )
                }
                disabled={loading || cookieLoading}
              >
                {t("fetchCharacters")}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => handleStart({ onlyCookie: true })}
                startIcon={cookieLoading ? <CircularProgress size={20} color="inherit" /> : null}
                disabled={loading || cookieLoading}
              >
                {t("updateCookie")}
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
                  inputProps={{ "aria-label": t("mergeOption") }}
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

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      <Dialog open={authDialogOpen} onClose={closeAuthDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{authTitle}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3, overflow: "visible" }}>
          <TextField
            label={t("auth.username") || "用户名"}
            value={authForm.username}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
            fullWidth
            autoFocus
          />
          <TextField
            label={t("auth.password") || "密码"}
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {authMode === "login" ? (
            <Button onClick={openRegisterDialog} disabled={authSubmitting}>
              {t("auth.switchToRegister") || "去注册"}
            </Button>
          ) : (
            <Button onClick={openLoginDialog} disabled={authSubmitting}>
              {t("auth.switchToLogin") || "去登录"}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={closeAuthDialog} disabled={authSubmitting}>
            {t("auth.cancel") || "取消"}
          </Button>
          <Button variant="contained" onClick={handleAuthSubmit} disabled={authSubmitting}>
            {authSubmitting ? (
              <CircularProgress size={18} color="inherit" />
            ) : authMode === "login" ? (
              t("auth.submitLogin") || "登录"
            ) : (
              t("auth.submitRegister") || "注册"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
    </>
  );
}
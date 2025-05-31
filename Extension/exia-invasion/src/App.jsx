// src/App.jsx
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
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Paper,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MergeIcon from "@mui/icons-material/Merge";
import JSZip from "jszip";
import saveDictToExcel from "./excel.js";
import TRANSLATIONS from "./translations";
import { getAccounts, setAccounts, getSettings, setSettings } from "./storage";
import { applyCookieStr, clearSiteCookies } from "./cookie.js";
import { loadBaseAccountDict, getRoleName, getPlayerNikkes, getEquipments } from "./api.js";
import { mergeWorkbooks } from "./merge.js";
import { v4 as uuidv4 } from "uuid";

/* ---------- React 组件 ---------- */
export default function App() {
  /* ------ 全局状态 ------ */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [tab, setTab] = useState("crawler");
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [cacheCookie, setCacheCookie] = useState(false);
  const [activateTab, setActivateTab] = useState(false);
  const [server, setServer] = useState("global");
  const [sortFlag, setSortFlag] = useState("1");
  const [filesToMerge, setFilesToMerge] = useState([]);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [pendingCookieStr, setPendingCookieStr] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const addLog = (msg) => setLogs((prev) => [...prev, msg]);
  
  /* ------ 初次载入设置 ------ */
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsZip(Boolean(s.saveAsZip));
      setExportJson(Boolean(s.exportJson));
      setCacheCookie(Boolean(s.cacheCookie));
      setActivateTab(Boolean(s.activateTab));
      setServer(s.server || "global");
      setSortFlag(s.sortFlag || "1");
    })();
  }, []);
  
  const persistSettings = (upd) =>
    setSettings({ lang, saveAsZip, exportJson, cacheCookie, activateTab, server, sortFlag, ...upd });
  
  /* ------ UI 控制 ------ */
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
  const handleFileSelect = (e) => {
    setFilesToMerge(Array.from(e.target.files));
  };
  
  /* ------ 保存当前 cookie ------ */
  const handleSaveCookie = () => {
    chrome.cookies.getAll({ url: "https://www.blablalink.com" }, (cookies) => {
      console.log(cookies);
      const token = cookies.find((c) => c.name === "game_token");
      if (!token) {
        addLog(t("notLogin"));
        return;
      }
      setPendingCookieStr(
        cookies.map((c) => `${c.name}=${c.value}`).join("; ")
      );
      setDlgOpen(true);
    });
  };
  const handleDlgSave = async () => {
    if (!username.trim()) return;
    const accounts = await getAccounts();
    accounts.push({
      id: uuidv4(),
      username: username.trim(),
      email: "",
      password: "",
      cookie: pendingCookieStr,
      enabled: true,
    });
    await setAccounts(accounts);
    setDlgOpen(false);
    setUsername("");
  };
  
  /* ========== 主流程：合并 ========== */
  const handleMerge = async () => {
    if (!filesToMerge.length) {
      addLog(t("upload"));
      return;
    }
    setLogs([]);
    setLoading(true);
    try {
      addLog(t("starting"));
      const mergedBuffer = await mergeWorkbooks(filesToMerge, sortFlag, addLog);
      const blob = new Blob([mergedBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: "merged.xlsx" }, () =>
        URL.revokeObjectURL(url)
      );
      addLog(t("done"));
    } catch (e) {
      addLog(`${t("fail")} ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  /* ========== 主流程：启动 ========== */
  const handleStart = async () => {
    setLogs([]);
    setLoading(true);
    
    try {
      /* ---------- 0. 读取账号列表 ---------- */
      const accountsAll = await getAccounts();
      const accounts = accountsAll.filter((a) => a.enabled !== false);
      if (!accounts.length) {
        addLog(t("emptyAccounts"));
        setLoading(false);
        return;
      }
      
      addLog(t("starting"));
      
      const zip = new JSZip();
      const excelMime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      /* ---------- 1. 遍历每个账号 ---------- */
      for (let i = 0; i < accounts.length; ++i) {
        await clearSiteCookies(); // 清除之前的 Cookie，避免干扰
        const acc = { ...accounts[i] }; // 浅拷贝，避免直接修改 state
        addLog(`----------------------------`);
        addLog(`${t("processAccount")}${acc.name || acc.username || t("noName")}`);
        
        /* 1-1. 获取可用的 Cookie —— 优先本地缓存，其次邮箱/密码登录 */
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
            continue;
          }
          addLog(t("loginWithPwd"));
          try {
            await loginAndGetCookie(acc, server);
          } catch (e) {
            addLog(`${t("loginFail")}${e}`);
            continue;
          }
        }
        
        /* 1-2. 校验 Cookie 是否有效，顺带拿角色名 */
        let roleName = "";
        try {
          roleName = await getRoleName();
          console.log(`角色名：${roleName}`);
          if (!roleName) {
            throw new Error(t("cookieExpired"));
          }
        } catch (err) { // 获取角色名失败，可能是 Cookie 过期
          if (usedSavedCookie && acc.password) {
            addLog(t("cookieExpired"));
            try {
              await loginAndGetCookie(acc, server);
              roleName = await getRoleName();
            } catch (err2) {
              addLog(`${t("reloginFail")}${err2}`);
              continue;
            }
          } else {
            addLog(`${t("getRoleNameFail")}${err}`);
            continue;
          }
        }
        addLog(`${t("roleOk")}${roleName}`);
        
        /* 回写账号cookie */
        if (cacheCookie) {
          const cks = (await chrome.cookies.getAll({}))
            .filter(c => c.domain.endsWith("blablalink.com"));
          acc.cookie = cookieArrToStr(cks);
          const all = await getAccounts();
          const idx = all.findIndex(a => a.id === acc.id);
          if (idx !== -1) all[idx] = acc;
          await setAccounts(all);
          addLog(t("cacheUpdated"));
        }
        
        /* ---------- 2. 构建 dict ---------- */
        let dict;
        try {
          /* 2-1. 载入基础模板（按语言）并写入账号名 */
          dict = await loadBaseAccountDict(lang);
          dict.name = roleName;
          
          /* 2-2. 追加 Nikke 详情与装备信息 */
          const playerNikkes = await getPlayerNikkes();
          addNikkesDetailsToDict(dict, playerNikkes);
          addLog(t("nikkeOk"));
          
          await addEquipmentsToDict(dict);
          addLog(t("equipOk"));
        } catch (err) {
          addLog(`${t("dictFail")}${err}`);
          continue;
        }
        
        /* ---------- 3. 生成 Excel ---------- */
        let excelBuffer;
        try {
          excelBuffer = await saveDictToExcel(dict, lang);
        } catch (err) {
          addLog(`${t("excelFail")}${err}`);
          continue;
        }
        
        /* ---------- 4. 导出 JSON ---------- */
        if (exportJson) {
          const jsonName = `${roleName || acc.name || acc.username}.json`;
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
        
        /* ---------- 5. 导出 Excel ---------- */
        if (saveAsZip) {
          zip.file(`${roleName || acc.name || acc.username}.xlsx`, excelBuffer);
        } else {
          const url = URL.createObjectURL(new Blob([excelBuffer], { type: excelMime }));
          chrome.downloads.download(
            { url, filename: `${roleName || acc.name || acc.username}.xlsx` },
            () => URL.revokeObjectURL(url)
          );
        }
      } // for-loop 结束
      
      /* ---------- 6. 合并 Zip 并下载 ---------- */
      if (saveAsZip) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        chrome.downloads.download(
          { url, filename: "accounts.zip" },
          () => URL.revokeObjectURL(url)
        );
      }
      
      addLog(t("done"));
    } catch (e) {
      setLogs((l) => [...l, `[异常] ${e}`]);
      addLog(`${t("fail")}${e}`);
    } finally {
      setLoading(false);
    }
  };
  
  /* ======= 辅助函数：填充 Nikke 详情 ======= */
  const addNikkesDetailsToDict = (dict, playerNikkes) => {
    const list = playerNikkes?.data?.player_nikkes || [];
    if (typeof dict.synchroLevel !== "number") dict.synchroLevel = 0;
    for (const chars of Object.values(dict.elements)) {
      for (const details of Object.values(chars)) {
        const nikke = list.find((n) => n.name_code === details.name_code);
        if (nikke) {
          details.skill1_level = nikke.skill1_level;
          details.skill2_level = nikke.skill2_level;
          details.skill_burst_level = nikke.skill_burst_level;
          details.item_rare = nikke.item_rare;
          details.item_level = nikke.item_level >= 0 ? nikke.item_level : "";
          details.limit_break = nikke.limit_break;
          
          /* ---------- 同步器 ---------- */
          if (nikke.level > dict.synchroLevel) {
            dict.synchroLevel = nikke.level;
          }
          
          /* ---------- 魔方 ---------- */
          if (nikke.cube_id && nikke.cube_level) {
            for (const [cubeName, cube] of Object.entries(dict.cubes)) {
              if (cube.cube_id === nikke.cube_id && nikke.cube_level > cube.cube_level) {
                cube.cube_level = nikke.cube_level;
              }
            }
          }
        }
      }
    }
  };
  
  /* ======= 辅助函数：填充装备 ======= */
  const addEquipmentsToDict = async (dict) => {
    for (const chars of Object.values(dict.elements)) {
      for (const details of Object.values(chars)) {
        const characterIds = Array.from(
          { length: 11 },
          (_, i) => details.id + i
        );
        details.equipments = await getEquipments(characterIds);
      }
    }
  };
  
  const cookieArrToStr = (cks) => {
    const map = new Map();
    
    // 后出现的同名 cookie 会覆盖前面的
    cks.forEach((c) => {
      // 如果想优先保留 path 更短的（通常是根路径），可以加个简单判断
      if (!map.has(c.name) || c.path === "/") {
        map.set(c.name, c.value);
      }
    });
    
    return [...map.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  };
  
  /* ======= 登录并抓取 Cookie ======= */
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
  
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ------ UI 渲染 ------ */
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
            <Typography variant="caption">中</Typography>
            <Switch size="small" checked={lang === "en"} onChange={toggleLang} />
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
                      checked={cacheCookie}
                      onChange={(e) => {
                        setCacheCookie(e.target.checked);
                        persistSettings({ cacheCookie: e.target.checked });
                      }}
                    />
                  }
                  label={t("cacheCookie")}
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
                {t("upload")} ({filesToMerge.length})
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={handleFileSelect}
                  accept=".xlsx"
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
                disabled={loading || !filesToMerge.length}
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
      
      {/* 用户名保存对话框 */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)}>
        <DialogTitle>{t("username")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)} startIcon={<CloseIcon />}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleDlgSave}
            startIcon={<SaveIcon />}
          >
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
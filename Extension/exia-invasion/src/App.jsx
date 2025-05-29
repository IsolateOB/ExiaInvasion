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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import JSZip from "jszip";
import saveDictToExcel from "./excel.js";
import TRANSLATIONS from "./translations";
import { getAccounts, setAccounts, getSettings, setSettings } from "./storage";
import { IMPORTANT_KEYS } from "./constants.js";
import { filterCookieStr, applyCookieStr, clearSiteCookies, delay } from "./cookie.js";
import {loadBaseAccountDict, getRoleName, getPlayerNikkes, getEquipments } from "./api.js";


/* ---------- React 组件 ---------- */
export default function App() {
  /* ------ 全局状态 ------ */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [cacheCookie, setCacheCookie] = useState(false);
  const [server, setServer] = useState("global");
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
      setServer(s.server || "global");
    })();
  }, []);
  
  const persistSettings = (upd) =>
    setSettings({ lang, saveAsZip, exportJson, cacheCookie, server, ...upd });
  
  /* ------ UI 控制 ------ */
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
  
  /* ------ 保存当前 cookie ------ */
  const handleSaveCookie = () => {
    chrome.cookies.getAll({ url: "https://www.blablalink.com" }, (cookies) => {
      console.log(cookies);
      const token = cookies.find((c) => c.name === "game_token");
      if (!token) {
        setSnack(t("notLogin"));
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
      username: username.trim(),
      email: "",
      password: "",
      cookie: pendingCookieStr,
    });
    await setAccounts(accounts);
    setDlgOpen(false);
    setUsername("");
  };
  
  /* ========== 主流程：启动 ========== */
  const handleStart = async () => {
    setLogs([]);
    setLoading(true);
    
    try {
      /* ---------- 0. 读取账号列表 ---------- */
      const accounts = await getAccounts();
      if (!accounts.length) {
        setSnack(t("emptyAccounts"));
        setLoading(false);
        return;
      }
      
      addLog(t("starting"));

      const zip = new JSZip();
      
      let cacheDirty = false;          // 是否需要把更新后的 Cookie 写回
      const excelMime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      /* ---------- 1. 遍历每个账号 ---------- */
      for (let i = 0; i < accounts.length; ++i) {
        await clearSiteCookies(); // 清除之前的 Cookie，避免干扰
        const acc = { ...accounts[i] }; // 浅拷贝，避免直接修改 state
        addLog(`----------------------------`);
        addLog(`${t("processAccount")}${acc.name || acc.username || t("noName")}`);
        
        /* 1-1. 获取可用的 Cookie —— 优先本地缓存，其次邮箱/密码登录 */
        let cookieStr = acc.cookie?.trim() ? filterCookieStr(acc.cookie) : "";
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
            cookieStr = await loginAndGetCookie(acc, server);
            // 更新账号信息
            console.log("cookieStr：", cookieStr);
            if (cacheCookie && cookieStr) {
              acc.cookie = cookieStr;
              accounts[i] = acc;
              cacheDirty = true;
            }
            await applyCookieStr(cookieStr);
          } catch (e) {
            addLog(`${t("loginFail")}${e}`);
            continue;
          }
        }
        
        /* 1-2. 校验 Cookie 是否有效，顺带拿角色名 */
        let roleName = "";
        try {
          roleName = await getRoleName();
        } catch (err) {
          if (usedSavedCookie && acc.password) {
            addLog(t("cookieExpired"));
            try {
              cookieStr = await loginAndGetCookie(acc, server);
              await applyCookieStr(cookieStr);
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
      
      /* ---------- 7. 回写更新后的 Cookie ---------- */
      if (cacheDirty) {
        await setAccounts(accounts);
        addLog(t("cacheUpdated"));
      }
      
      addLog(t("done"));
    } catch (e) {
      setLogs((l) => [...l, `[异常] ${e}`]);
      setSnack(`${t("fail")}${e}`);
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
          details.item_level = nikke.item_level;
          details.limit_break = nikke.limit_break;
          
          /* ---------- 同步器 ---------- */
          if (nikke.level > dict.synchroLevel){
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
  
  /* ======= 登录并抓取 Cookie ======= */
  const loginAndGetCookie = async (acc, serverFlag) => {
    addLog(t("getCookie"));
    const tab = await new Promise((resolve) =>
      chrome.tabs.create(
        { url: "https://www.blablalink.com/login", active: false },
        resolve
      )
    );
    
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
    
    let cookieStr = "";
    for (let i = 0; i < 150; i++) {
      await delay(100);
      const cookies = await new Promise((res) =>
        chrome.cookies.getAll({ domain: ".blablalink.com" }, res)
      );
      const filtered = Object.fromEntries(
        cookies
          .filter((c) => IMPORTANT_KEYS.includes(c.name))
          .map((c) => [c.name, c.value])
      );
      if (IMPORTANT_KEYS.every((k) => filtered[k])) {
        cookieStr = IMPORTANT_KEYS.map((k) => `${k}=${filtered[k]}`).join(
          "; "
        );
        break;
      }
    }
    chrome.tabs.remove(tab.id);
    await applyCookieStr(cookieStr); // 确保 API 请求也能带上
    return cookieStr;
  };
  
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ------ UI 渲染 ------ */
  return (
    <>
      <AppBar position="static">
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
        <Stack spacing={2}>
          {/* 运行按钮 */}
          <Button
            variant="contained"
            fullWidth
            onClick={handleStart}
            startIcon={
              loading
                ? <CircularProgress size={20} color="inherit" />
                : <PlayArrowIcon />
            }
            disabled={loading}
          >
            {t("start")}
          </Button>
          
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
            {t("manageAccounts")}
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
          </Stack>
          
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t("server")}
            </Typography>
            <Select
              size="small"
              fullWidth
              value={server}
              onChange={changeServer}
            >
              <MenuItem value="hmt">{t("hmt")}</MenuItem>
              <MenuItem value="global">{t("global")}</MenuItem>
            </Select>
          </Box>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 110,
              overflowY: "auto",
              whiteSpace: "pre-line",
              fontSize: 12
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
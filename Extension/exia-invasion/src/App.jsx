// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
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
  Snackbar,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

/* ---------- 多语言 ---------- */
const TRANSLATIONS = {
  zh: {
    start: "启动",
    saveCookie: "保存当前账号 Cookie",
    notLogin: "未登录",
    username: "用户名",
    save: "保存",
    cancel: "取消",
    saveAsJson: "保存为 JSON",
    server: "服务器",
    hmt: "香港/澳门/台湾",
    global: "日本/韩国/北美/东南亚/全球",
    langLabel: "中文",
    running: "正在处理账号：",
    loginWithCookie: "使用保存的 Cookie 登录",
    loginWithPwd: "使用邮箱/密码登录",
    getCookie: "正在获取 Cookie...",
    cookieOk: "Cookie 获取成功",
    roleOk: "角色名：",
    nikkeOk: "Nikke 详情已获取",
    equipOk: "装备信息已获取",
    allDone: "所有账号处理完毕 🎉",
  },
  en: {
    start: "Start",
    saveCookie: "Save Current Cookie",
    notLogin: "Not logged in",
    username: "Username",
    save: "Save",
    cancel: "Cancel",
    saveAsJson: "Save as JSON",
    server: "Server",
    hmt: "HK/MC/TW",
    global: "JP/KR/NA/SEA/Global",
    langLabel: "EN",
    running: "Processing account: ",
    loginWithCookie: "Login with saved cookie",
    loginWithPwd: "Login with email/password",
    getCookie: "Retrieving cookies...",
    cookieOk: "Cookie retrieved ✔",
    roleOk: "Role name: ",
    nikkeOk: "Nikke details fetched",
    equipOk: "Equipments fetched",
    allDone: "All accounts done 🎉",
  },
};

/* ---------- Storage Keys ---------- */
const SETTINGS_KEY = "settings";
const ACCOUNTS_KEY = "accounts";

/* ---------- Storage Utils ---------- */
const getSettings = () =>
  new Promise((res) => {
    chrome.storage.local.get(SETTINGS_KEY, (r) => res(r[SETTINGS_KEY] || {}));
  });
const setSettings = (obj) =>
  new Promise((res) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: obj }, () => res());
  });
const getAccounts = () =>
  new Promise((res) => {
    chrome.storage.local.get(ACCOUNTS_KEY, (r) => res(r[ACCOUNTS_KEY] || []));
  });
const setAccounts = (arr) =>
  new Promise((res) => {
    chrome.storage.local.set({ [ACCOUNTS_KEY]: arr }, () => res());
  });

/* ---------- 常量 ---------- */
const IMPORTANT_KEYS = [
  "OptanonAlertBoxClosed",
  "game_login_game",
  "game_openid",
  "game_channelid",
  "game_token",
  "game_gameid",
  "game_user_name",
  "game_uid",
  "game_adult_status",
  "OptanonConsent",
];

/* ---------- 小工具 ---------- */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const filterCookieStr = (raw) => {
  const obj = Object.fromEntries(
    raw.split(/;\s*/).map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const filtered = IMPORTANT_KEYS.filter((k) => obj[k]).map((k) => `${k}=${obj[k]}`);
  return filtered.join("; ");
};

/* ---------- 载入语言模板 JSON ---------- */
const loadBaseAccountDict = async (lang) => {
  const fileName = lang === "en" ? "SearchIndexEng.json" : "SearchIndexChs.json";
  const url = chrome.runtime.getURL(fileName);
  const resp = await fetch(url);
  return resp.json();
};

/* ---------- React 组件 ---------- */
export default function App() {
  /* ------ 全局状态 ------ */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [saveAsJson, setSaveAsJson] = useState(false);
  const [server, setServer] = useState("global");
  const [snack, setSnack] = useState("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [pendingCookieStr, setPendingCookieStr] = useState("");
  const [logs, setLogs] = useState([]);
  const addLog = (msg) => setLogs((prev) => [...prev, msg]);
  
  /* ------ 初次载入设置 ------ */
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsJson(Boolean(s.saveAsJson));
      setServer(s.server || "global");
    })();
  }, []);
  
  /* ------ 设置持久化 ------ */
  const persistSettings = (upd) => setSettings({ lang, saveAsJson, server, ...upd });
  
  /* ------ UI 控制 ------ */
  const toggleLang = (e) => {
    const newLang = e.target.checked ? "en" : "zh";
    setLang(newLang);
    persistSettings({ lang: newLang });
  };
  const toggleSaveJson = (e) => {
    const v = e.target.checked;
    setSaveAsJson(v);
    persistSettings({ saveAsJson: v });
  };
  const changeServer = (e) => {
    const v = e.target.value;
    setServer(v);
    persistSettings({ server: v });
  };
  
  /* ------ 保存当前 cookie ------ */
  const handleSaveCookie = () => {
    chrome.cookies.getAll({ domain: "blablalink.com" }, (cookies) => {
      const token = cookies.find((c) => c.name === "game_token");
      if (!token) {
        setSnack(t("notLogin"));
        return;
      }
      setPendingCookieStr(cookies.map((c) => `${c.name}=${c.value}`).join("; "));
      setDlgOpen(true);
    });
  };
  const handleDlgSave = async () => {
    if (!username.trim()) return;
    const accounts = await getAccounts();
    accounts.push({ username: username.trim(), email: "", password: "", cookie: pendingCookieStr });
    await setAccounts(accounts);
    setDlgOpen(false);
    setUsername("");
  };
  
  /* ========== 主流程：启动 ========== */
  const handleStart = async () => {
    setLogs([]);
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      addLog("No accounts saved.");
      return;
    }
    
    for (const acc of accounts) {
      const accName = acc.username || acc.email || "<unknown>";
      addLog(`${t("running")}${accName}`);
      
      /* ---- Step 1: 获取 Cookie ---- */
      let cookieStr = acc.cookie?.trim() ? filterCookieStr(acc.cookie) : "";
      if (cookieStr) addLog(t("loginWithCookie"));
      if (!cookieStr) {
        addLog(t("loginWithPwd"));
        try {
          cookieStr = await loginAndGetCookie(acc, server);
        } catch (e) {
          addLog(`Login failed: ${e}`);
          continue;
        }
      }
      if (!cookieStr) {
        addLog("Cookie unavailable, skip.");
        continue;
      }
      addLog(t("cookieOk"));
      
      /* ---- Step 2: 调用后端接口 ---- */
      try {
        const roleName = await getRoleName(cookieStr);
        addLog(`${t("roleOk")}${roleName}`);
        
        const playerNikkes = await getPlayerNikkes(cookieStr);
        addLog(t("nikkeOk"));
        
        // 2.1 读取语言模板
        const accountDict = await loadBaseAccountDict(lang);
        accountDict.name = roleName;
        
        // 2.2 填充 nikke 详情 & cubes & synchro
        addNikkesDetailsToDict(accountDict, playerNikkes);
        
        // 2.3 填充装备
        await addEquipmentsToDict(accountDict, cookieStr);
        addLog(t("equipOk"));
        
        // 2.4 下载 JSON（可选）
        if (saveAsJson) {
          const blob = new Blob([JSON.stringify(accountDict, null, 4)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          chrome.downloads.download({ url, filename: `${roleName || accName}.json` });
        }
      } catch (e) {
        addLog(`API error: ${e.message || e}`);
      }
    }
    addLog(t("allDone"));
  };
  
  /* ======= 辅助函数：填充 Nikke 详情 ======= */
  const addNikkesDetailsToDict = (dict, playerNikkes) => {
    addLog(lang === "en" ? "Fetching Nikke details..." : "正在获取Nikke详情...");
    const list = playerNikkes?.data?.player_nikkes || [];
    
    for (const [element, chars] of Object.entries(dict.elements)) {
      for (const [charName, details] of Object.entries(chars)) {
        const nikke = list.find((n) => n.name_code === details.name_code);
        if (nikke) {
          details.skill1_level = nikke.skill1_level;
          details.skill2_level = nikke.skill2_level;
          details.skill_burst_level = nikke.skill_burst_level;
          details.item_rare = nikke.item_rare;
          details.item_level = nikke.item_level;
          details.limit_break = nikke.limit_break;
          
          if (nikke.level > dict.synchroLevel) dict.synchroLevel = nikke.level;
          
          for (const cube of Object.values(dict.cubes)) {
            if (nikke.cube_id === cube.cube_id && nikke.cube_level > cube.cube_level) {
              cube.cube_level = nikke.cube_level;
            }
          }
        }
      }
    }
  };
  
  /* ======= 辅助函数：填充装备 ======= */
  const addEquipmentsToDict = async (dict, cookieStr) => {
    addLog(lang === "en" ? "Fetching equipment data..." : "正在获取装备数据...");
    
    for (const chars of Object.values(dict.elements)) {
      for (const details of Object.values(chars)) {
        const characterIds = Array.from({ length: 11 }, (_, i) => details.id + i);
        details.equipments = await getEquipments(cookieStr, characterIds);
      }
    }
  };
  
  /* ======= 登录并抓取 Cookie ======= */
  const loginAndGetCookie = async (acc, serverFlag) => {
    addLog(t("getCookie"));
    const tab = await chrome.tabs.create({ url: "https://www.blablalink.com/login", active: false });
    
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
      const cookies = await new Promise((res) => chrome.cookies.getAll({ domain: "blablalink.com" }, res));
      const filtered = Object.fromEntries(cookies.filter((c) => IMPORTANT_KEYS.includes(c.name)).map((c) => [c.name, c.value]));
      if (IMPORTANT_KEYS.every((k) => filtered[k])) {
        cookieStr = IMPORTANT_KEYS.map((k) => `${k}=${filtered[k]}`).join("; ");
        break;
      }
    }
    chrome.tabs.remove(tab.id);
    return cookieStr;
  };
  
  /* ======= API 层 ======= */
  const buildHeader = (cookieStr, len) => ({
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7",
    "Content-Length": String(len),
    "Content-Type": "application/json",
    Cookie: cookieStr,
    Dnt: "1",
    Origin: "https://www.blablalink.com",
    priority: "u=1, i",
    Referer: "https://www.blablalink.com/",
    "Sec-Ch-Ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Microsoft Edge";v="134"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "sec-Fetch-Site": "same-site",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    "x-channel-type": "2",
    "x-common-params":
      '{"game_id":"16","area_id":"global","source":"pc_web","intl_game_id":"29080","language":"zh-TW","env":"prod","data_statistics_scene":"outer","data_statistics_page_id":"https://www.blablalink.com/","data_statistics_client_type":"pc_web","data_statistics_lang":"zh-TW"}',
    "x-language": "zh-TW",
  });
  const postJson = async (url, cookieStr, bodyObj) => {
    const body = JSON.stringify(bodyObj);
    const res = await fetch(url, { method: "POST", headers: buildHeader(cookieStr, body.length), body });
    return res.json();
  };
  const getRoleName = (cookieStr) => postJson("https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo", cookieStr, {}).then((j) => j?.data?.role_name || "");
  const getPlayerNikkes = (cookieStr) => postJson("https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes", cookieStr, {});
  const getEquipments = (cookieStr, characterIds) => postJson("https://api.blablalink.com/api/game/proxy/Tools/GetPlayerEquipContents", cookieStr, { character_ids: characterIds }).then((j) => {
    const list = j?.data?.player_equip_contents || [];
    const finalSlots = [null, null, null, null];
    for (const record of [...list].reverse()) {
      record.equip_contents.forEach((slot, idx) => {
        if (!finalSlots[idx] && (slot.equip_id !== -99 || slot.equip_effects?.length)) finalSlots[idx] = slot;
      });
    }
    const result = {};
    finalSlots.forEach((slot, idx) => {
      if (!slot) {
        result[idx] = [];
        return;
      }
      const details = [];
      slot.equip_effects.forEach((eff) => {
        eff.function_details.forEach((func) => {
          details.push({ function_type: func.function_type, function_value: Math.abs(func.function_value) / 100, level: func.level });
        });
      });
      result[idx] = details;
    });
    return result;
  });
  
  /* ------ UI 渲染 ------ */
  return (
    <>
      <AppBar position="static">
        <Toolbar variant="dense">
          <IconButton size="small" edge="start" color="inherit">
            <AddIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ExiaInvasion
          </Typography>
          <FormControlLabel control={<Switch size="small" checked={lang === "en"} onChange={toggleLang} />} label={t("langLabel")} sx={{ ml: 1, color: "white" }} />
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 2, width: 340 }}>
        <Stack spacing={2}>
          <Button variant="contained" fullWidth onClick={handleStart} startIcon={<EditIcon />}> {t("start")} </Button>
          <Button variant="outlined" fullWidth onClick={handleSaveCookie} startIcon={<SaveIcon />}> {t("saveCookie")} </Button>
          <FormControlLabel control={<Switch checked={saveAsJson} onChange={toggleSaveJson} />} label={t("saveAsJson")} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t("server")}</Typography>
            <Select size="small" fullWidth value={server} onChange={changeServer}>
              <MenuItem value="hmt">{t("hmt")}</MenuItem>
              <MenuItem value="global">{t("global")}</MenuItem>
            </Select>
          </Box>
          <Paper variant="outlined" sx={{ p: 1, height: 220, overflowY: "auto", whiteSpace: "pre-line", fontSize: 12 }}>{logs.join("\n")}</Paper>
        </Stack>
      </Container>
      
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)}>
        <DialogTitle>{t("username")}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth margin="dense" label={t("username")}
                     value={username} onChange={(e) => setUsername(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)} startIcon={<CloseIcon />}>{t("cancel")}</Button>
          <Button variant="contained" onClick={handleDlgSave} startIcon={<SaveIcon />}>{t("save")}</Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack("")} message={snack} />
    </>
  );
}

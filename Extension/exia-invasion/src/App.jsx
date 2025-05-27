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
  Snackbar,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import JSZip from "jszip";
import ExcelJS from "exceljs";

/* ---------- 多语言 ---------- */
const TRANSLATIONS = {
  zh: {
    start: "启动",
    saveCookie: "保存当前账号 Cookie",
    notLogin: "未登录",
    username: "用户名",
    save: "保存",
    cancel: "取消",
    saveAsZip: "保存为 ZIP",
    server: "服务器",
    hmt: "香港/澳门/台湾",
    global: "日本/韩国/北美/东南亚/全球",
    langLabel: "中文",
    running: "正在处理账号：",
    loginWithCookie: "使用保存的 Cookie 登录",
    loginWithPwd: "使用邮箱/密码登录",
    getCookie: "正在获取 Cookie.",
    cookieOk: "Cookie 获取成功",
    roleOk: "角色名：",
    nikkeOk: "Nikke 详情已获取",
    equipOk: "装备信息已获取",
    allDone: "所有账号处理完毕 🎉",
    openFolder: "打开输出文件",
  },
  en: {
    start: "Start",
    saveCookie: "Save Current Cookie",
    notLogin: "Not logged in",
    username: "Username",
    save: "Save",
    cancel: "Cancel",
    saveAsZip: "Save as ZIP",
    server: "Server",
    hmt: "HK/MC/TW",
    global: "JP/KR/NA/SEA/Global",
    langLabel: "EN",
    running: "Processing account: ",
    loginWithCookie: "Login with saved cookie",
    loginWithPwd: "Login with email/password",
    getCookie: "Retrieving cookies.",
    cookieOk: "Cookie retrieved ✔",
    roleOk: "Role name: ",
    nikkeOk: "Nikke details fetched",
    equipOk: "Equipments fetched",
    allDone: "All accounts done 🎉",
    openFolder: "Open output file",
  },
};

/* ---------- Storage Keys ---------- */
const SETTINGS_KEY = "settings";
const ACCOUNTS_KEY = "accounts";

/* ---------- Storage Utils ---------- */
const getSettings = () =>
  new Promise((res) =>
    chrome.storage.local.get(SETTINGS_KEY, (r) => res(r[SETTINGS_KEY] || {}))
  );
const setSettings = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [SETTINGS_KEY]: obj }, () => res())
  );
const getAccounts = () =>
  new Promise((res) =>
    chrome.storage.local.get(ACCOUNTS_KEY, (r) => res(r[ACCOUNTS_KEY] || []))
  );
const setAccounts = (arr) =>
  new Promise((res) =>
    chrome.storage.local.set({ [ACCOUNTS_KEY]: arr }, () => res())
  );

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
  return IMPORTANT_KEYS.filter((k) => obj[k])
    .map((k) => `${k}=${obj[k]}`)
    .join("; ");
};

/* 把字符串形式的 cookie 写入浏览器 cookie jar */
const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  const parts = cookieStr.split(/;\s*/);
  for (const part of parts) {
    const [name, value] = part.split("=");
    if (!name) continue;
    await chrome.cookies.set({
      url: "https://www.blablalink.com/",
      name,
      value,
      path: "/",
    });
  }
};

/* ---------- Excel 工具 ---------- */
const itemRareToStr = (r) => (r === 3 ? "SSR" : r === 2 ? "SR" : r === 1 ? "R" : "");
const getItemLevel = (rare, lvl) => (rare === 3 ? `${lvl + 1}★` : lvl);
const getLimitBreakStr = (lb) => {
  if (lb < 0) return "";
  if (lb <= 3) return `${lb}★`;
  if (lb < 10) return `+${lb - 3}`;
  return "MAX";
};

/* 保存字典到 Excel 文件 */
const saveDictToExcel = async (dict, lang) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(lang === "en" ? "Member Info" : "成员信息");
  
  /* ---- 基础表头 ---- */
  ws.getRow(1).height = 22;
  ws.getCell("A1").value = lang === "en" ? "Name" : "名称";
  ws.getCell("B1").value = dict.name;
  ws.getCell("C1").value = lang === "en" ? "Synchro" : "同步器";
  ws.getCell("D1").value = dict.synchroLevel;
  
  /* ---- 字段标签 ---- */
  const labels = lang === "en"
    ? ["LB","Skill 1","Skill 2","Burst","Item","Lvl","T10","Elem",
      "Atk","Ammo","ChgSpd","ChgDMG","Crit%","CritDMG","Hit%","Def"]
    : ["突破","技能1","技能2","爆裂","珍藏品","等级","T10","优越",
      "攻击","弹夹","蓄速","蓄伤","暴击","暴伤","命中","防御"];
  
  let colPtr = 5;   // 从第 5 列开始写角色
  const widthPerChar = labels.length;
  
  for (const [element, chars] of Object.entries(dict.elements)) {
    for (const [charName, info] of Object.entries(chars)) {
      /* 元素与角色名 */
      ws.mergeCells(1, colPtr, 1, colPtr + widthPerChar - 1);
      ws.getCell(1, colPtr).value = element;
      ws.mergeCells(2, colPtr, 2, colPtr + widthPerChar - 1);
      ws.getCell(2, colPtr).value = charName;
      
      /* 字段标签 */
      labels.forEach((lbl, i) => {
        ws.getCell(3, colPtr + i).value = lbl;
      });
      
      /* 关键数值 */
      ws.getCell(4, colPtr).value = getLimitBreakStr(info.limit_break);
      ws.getCell(4, colPtr + 1).value = info.skill1_level || "";
      ws.getCell(4, colPtr + 2).value = info.skill2_level || "";
      ws.getCell(4, colPtr + 3).value = info.skill_burst_level || "";
      ws.getCell(4, colPtr + 4).value = itemRareToStr(info.item_rare);
      ws.getCell(4, colPtr + 5).value = getItemLevel(info.item_rare, info.item_level);
      
      /* （可选）把装备 / Cube 等继续追加到 5~8 行，这里略。*/
      
      colPtr += widthPerChar;
    }
  }
  
  /* ---- Cube ---- */
  const cubeStart = colPtr;
  ws.mergeCells(1, cubeStart, 1, cubeStart + Object.keys(dict.cubes).length - 1);
  ws.getCell(1, cubeStart).value = lang === "en" ? "Cube" : "魔方";
  let idx = 0;
  for (const [name, data] of Object.entries(dict.cubes)) {
    const col = cubeStart + idx++;
    ws.mergeCells(2, col, 3, col);
    ws.getCell(2, col).value = name;
    ws.mergeCells(4, col, 8, col);
    ws.getCell(4, col).value = data.cube_level || (lang === "en" ? "Not found" : "未找到");
  }
  
  return workbook.xlsx.writeBuffer();
};

/* ---------- 载入语言模板 JSON ---------- */
const loadBaseAccountDict = async (lang) => {
  const fileName = lang === "en" ? "SearchIndexEng.json" : "SearchIndexChs.json";
  const url = chrome.runtime.getURL(fileName);
  const resp = await fetch(url);
  return resp.json();
};

/* ---------- API 工具 ---------- */
const buildHeader = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
});

const postJson = async (url, bodyObj) => {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeader(),
    body: JSON.stringify(bodyObj),
    credentials: "include", // 自动带 cookie
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

const getRoleName = () =>
  postJson(
    "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo",
    {}
  ).then((j) => j?.data?.role_name || "");

const getPlayerNikkes = () =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes",
    {}
  );

const getEquipments = (characterIds) =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerEquipContents",
    { character_ids: characterIds }
  ).then((j) => {
    const list = j?.data?.player_equip_contents || [];
    const finalSlots = [null, null, null, null];
    for (const record of [...list].reverse()) {
      record.equip_contents.forEach((slot, idx) => {
        if (
          !finalSlots[idx] &&
          (slot.equip_id !== -99 || slot.equip_effects?.length)
        )
          finalSlots[idx] = slot;
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
          details.push({
            function_type: func.function_type,
            function_value: Math.abs(func.function_value) / 100,
            level: func.level,
          });
        });
      });
      result[idx] = details;
    });
    return result;
  });

/* ---------- React 组件 ---------- */
export default function App() {
  /* ------ 全局状态 ------ */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  const [saveAsZip, setSaveAsZip] = useState(false);
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
      setSaveAsZip(Boolean(s.saveAsZip));
      setServer(s.server || "global");
    })();
  }, []);
  
  const persistSettings = (upd) => setSettings({ lang, saveAsZip, server, ...upd });
  
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
    chrome.cookies.getAll({ domain: "blablalink.com" }, (cookies) => {
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
    setLastDownloadId(null);
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      addLog("No accounts saved.");
      return;
    }
    
    const zip = new JSZip();
    
    for (const acc of accounts) {
      const accName = acc.username || acc.email || "unknown";
      addLog(`${t("running")}${accName}`);
      
      /* ---- Step 1: 获取 / 应用 Cookie ---- */
      let cookieStr = acc.cookie?.trim() ? filterCookieStr(acc.cookie) : "";
      if (cookieStr) {
        addLog(t("loginWithCookie"));
        await applyCookieStr(cookieStr); // 写入 cookie jar
      }
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
        const roleName = await getRoleName();
        addLog(`${t("roleOk")}${roleName}`);
        
        const playerNikkes = await getPlayerNikkes();
        addLog(t("nikkeOk"));
        
        const dict = await loadBaseAccountDict(lang);
        dict.name = roleName;
        addNikkesDetailsToDict(dict, playerNikkes);
        await addEquipmentsToDict(dict);
        addLog(t("equipOk"));
        
        zip.file(
          `${roleName || accName}.json`,
          JSON.stringify(dict, null, 4)
        );
        try {
          const excelBuffer = await saveDictToExcel(dict, lang);
          if (saveAsZip) {
            zip.file(`${roleName || accName}.xlsx`, excelBuffer);
          } else {
            const blob = new Blob([excelBuffer], {
              type:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download(
              { url, filename: `${roleName || accName}.xlsx` },
              (id) => {
                URL.revokeObjectURL(url);
              }
            );
          }
        } catch (e) {
          addLog(`Excel generation error: ${e.message || e}`);
        }
      } catch (e) {
        addLog(`API error: ${e.message || e}`);
      }
    }
    
    /* ---- 生成并下载 zip ---- */
    if (saveAsZip) {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: "accounts.zip" }, (id) => {
        URL.revokeObjectURL(url);
      });
    }
    
    addLog(t("allDone"));
  };
  
  /* ======= 辅助函数：填充 Nikke 详情 ======= */
  const addNikkesDetailsToDict = (dict, playerNikkes) => {
    const list = playerNikkes?.data?.player_nikkes || [];
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
        chrome.cookies.getAll({ domain: "blablalink.com" }, res)
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
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={lang === "en"}
                onChange={toggleLang}
              />
            }
            label={t("langLabel")}
            sx={{ ml: 1, color: "white" }}
          />
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 2, width: 340 }}>
        <Stack spacing={2}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleStart}
            startIcon={<EditIcon />}
          >
            {t("start")}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={handleSaveCookie}
            startIcon={<SaveIcon />}
          >
            {t("saveCookie")}
          </Button>
          <FormControlLabel
            control={<Switch checked={saveAsZip} onChange={toggleSaveZip} />}
            label={t("saveAsZip")}
          />
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
              height: 220,
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
      
      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack("")}
        message={snack}
      />
    </>
  );
}
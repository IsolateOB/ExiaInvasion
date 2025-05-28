// src/App.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AppBar, Toolbar, Typography, Box, Container, Stack,
  Switch, Button, FormControlLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, TextField,
  DialogActions, Snackbar, Paper
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";

import { makeT, TRANSLATIONS } from "./translations";
import {
  getSettings, setSettings,
  getAccounts, setAccounts
} from "./storage";
import {
  filterCookieStr
} from "./cookieUtils";
import { processAccounts } from "./processor";

export default function App() {
  /* ---------- 全局状态 ---------- */
  const [lang, setLang] = useState("zh");
  const t = useCallback(makeT(lang), [lang]);
  
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [cacheCookie, setCacheCookie] = useState(false);
  const [server, setServer] = useState("global");
  
  const [snack, setSnack] = useState("");
  const [logs, setLogs]   = useState([]);
  const [loading, setLoading] = useState(false);
  
  const addLog = (msg) => setLogs((prev) => [...prev, msg]);
  
  /* ---------- 初次读取设置 ---------- */
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsZip(!!s.saveAsZip);
      setExportJson(!!s.exportJson);
      setCacheCookie(!!s.cacheCookie);
      setServer(s.server || "global");
    })();
  }, []);
  
  /* ---------- 设置持久化 ---------- */
  const persist = (u) =>
    setSettings({ lang, saveAsZip, exportJson, cacheCookie, server, ...u });
  
  /* ---------- 主流程启动 ---------- */
  const handleStart = async () => {
    setLogs([]);
    setLoading(true);
    await processAccounts(
      {
        lang, server, saveAsZip, exportJson, cacheCookie, t
      },
      {
        addLog,
        setSnack,
        onDone: () => setLoading(false),
      }
    );
  };

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
      
      <Container sx={{ mt: 2, width: 340 }}>
        <Stack spacing={2}>
          {/* 运行按钮 */}
          <Button
            variant="contained"
            fullWidth
            onClick={handleStart}
            startIcon={<PlayArrowIcon />}
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
              height: 140,
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


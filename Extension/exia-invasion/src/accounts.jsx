import React, { useEffect, useState, useCallback } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Box,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import LockPersonIcon from "@mui/icons-material/LockPerson";

const TRANSLATIONS = {
  zh: {
    accountTable: "账号列表",
    username: "用户名",
    email: "邮箱",
    password: "密码",
    cookie: "Cookie",
    saved: "已保存",
  },
  en: {
    accountTable: "Account Table",
    username: "Username",
    email: "Email",
    password: "Password",
    cookie: "Cookie",
    saved: "Saved",
  },
};

const defaultRow = () => ({
  username: "",
  email: "",
  password: "",
  cookie: "",
});

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState([]);
  
  /* -------- 语言同步设置 -------- */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  useEffect(() => {
    chrome.storage.local.get("settings", (r) => {
      setLang(r.settings?.lang || "zh");
    });
  }, []);
  
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.settings) {
        setLang(changes.settings.newValue?.lang || "zh");
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  
  const persist = (data) =>
    new Promise((resolve) =>
      chrome.storage.local.set({ accounts: data }, resolve)
    );
  
  /* ---------- 初始化数据 ---------- */
  useEffect(() => {
    chrome.storage.local.get("accounts", (res) => {
      const list = res.accounts || [];
      if (list.length === 0) {
        setAccounts([defaultRow()]);
        setEditing([true]);
      } else {
        setAccounts(list);
        setEditing(Array(list.length).fill(false));
      }
    });
  }, []);
  
  /* ---------- 工具函数 ---------- */
  const updateField = (idx, field, value) =>
    setAccounts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  
  const addRow = () => {
    setAccounts((prev) => [...prev, defaultRow()]);
    setEditing((prev) => [...prev, true]);
  };
  
  const startEdit = (idx) =>
    setEditing((prev) => prev.map((e, i) => (i === idx ? true : e)));
  
  const saveRow = async (idx) => {
    // 退出编辑模式
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    
    // 兼容旧数据：剔除历史 mode 字段
    const cleaned = accounts.map(({ mode, ...rest }) => rest);
    await persist(cleaned);
  };
  
  const renderText = (text) => (text ? text : "—");
  
  /* ---------- 渲染 ---------- */
  return (
    <>
      {/* HEADER */}
      <AppBar position="static">
        <Toolbar>
          <LockPersonIcon sx={{ mr: 1 }} />
          <Typography variant="h6">ExiaInvasion</Typography>
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 4, maxWidth: 720 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t("accountTable")}
        </Typography>
        
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="18%">{t("username")}</TableCell>
              <TableCell width="18%">{t("email")}</TableCell>
              <TableCell width="18%">{t("password")}</TableCell>
              <TableCell width="35%">{t("cookie")}</TableCell>
              <TableCell width="5%" align="right" />
            </TableRow>
          </TableHead>
          
          <TableBody>
            {accounts.map((row, idx) => {
              const isEdit = editing[idx];
              return (
                <TableRow key={idx} sx={{ "& > *": { verticalAlign: "top" } }}>
                  {/* Username */}
                  <TableCell>
                    {isEdit ? (
                      <TextField
                        variant="standard"
                        value={row.username}
                        onChange={(e) =>
                          updateField(idx, "username", e.target.value)
                        }
                        fullWidth
                      />
                    ) : (
                      renderText(row.username)
                    )}
                  </TableCell>
                  
                  {/* Email */}
                  <TableCell>
                    {isEdit ? (
                      <TextField
                        variant="standard"
                        value={row.email}
                        onChange={(e) =>
                          updateField(idx, "email", e.target.value)
                        }
                        fullWidth
                      />
                    ) : (
                      renderText(row.email)
                    )}
                  </TableCell>
                  
                  {/* Password */}
                  <TableCell>
                    {isEdit ? (
                      <TextField
                        variant="standard"
                        type="password"
                        value={row.password}
                        onChange={(e) =>
                          updateField(idx, "password", e.target.value)
                        }
                        fullWidth
                      />
                    ) : row.password ? (
                      "••••••"
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  
                  {/* Cookie */}
                  <TableCell>
                    {isEdit ? (
                      <TextField
                        variant="standard"
                        multiline
                        value={row.cookie}
                        onChange={(e) =>
                          updateField(idx, "cookie", e.target.value)
                        }
                        fullWidth
                      />
                    ) : row.cookie ? (
                      t("saved")
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  
                  {/* Action */}
                  <TableCell align="right">
                    {isEdit ? (
                      <IconButton color="primary" onClick={() => saveRow(idx)}>
                        <SaveIcon />
                      </IconButton>
                    ) : (
                      <IconButton onClick={() => startEdit(idx)}>
                        <EditIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            
            {/* Add row */}
            <TableRow>
              <TableCell colSpan={5} sx={{ pt: 2 }}>
                <Box display="flex" justifyContent="center">
                  <IconButton color="primary" onClick={addRow}>
                    <AddIcon />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Container>
    </>
  );
};

export default AccountsPage;


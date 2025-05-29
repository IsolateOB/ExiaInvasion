// src/accounts.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
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
import DeleteIcon from "@mui/icons-material/Delete";
import TRANSLATIONS from "./translations.js";

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
    const handler = (c, area) => {
      if (area === "local" && c.settings) {
        setLang(c.settings.newValue?.lang || "zh");
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  
  /* ---------- 初始化 ---------- */
  useEffect(() => {
    chrome.storage.local.get("accounts", (r) => {
      const list = r.accounts || [];
      if (list.length === 0) {
        setAccounts([defaultRow()]);
        setEditing([true]);
      } else {
        setAccounts(list);
        setEditing(Array(list.length).fill(false));
      }
    });
  }, []);
  
  const persist = (data) =>
    new Promise((ok) => chrome.storage.local.set({ accounts: data }, ok));
  
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
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    // 清掉已废弃的 mode 字段
    const cleaned = accounts.map(({ mode, ...rest }) => rest);
    await persist(cleaned);
  };
  
  const deleteRow = async (idx) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      persist(next);
      return next;
    });
    setEditing((prev) => prev.filter((_, i) => i !== idx));
  };
  
  const renderText = (txt) => (txt ? txt : "—");
  
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ---------- 渲染 ---------- */
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <img
            src={iconUrl}
            alt="logo"
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
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
              <TableCell width="15%">{t("username")}</TableCell>
              <TableCell width="20%">{t("email")}</TableCell>
              <TableCell width="15%">{t("password")}</TableCell>
              <TableCell width="30%">{t("cookie")}</TableCell>
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
                    <Box display="flex" flexDirection="row">
                      {isEdit ? (
                        <IconButton
                          color="primary"
                          onClick={() => saveRow(idx)}
                        >
                          <SaveIcon />
                        </IconButton>
                      ) : (
                        <IconButton onClick={() => startEdit(idx)}>
                          <EditIcon />
                        </IconButton>
                      )}
                      <IconButton
                        color="error"
                        onClick={() => deleteRow(idx)}
                        sx={{ ml: 0.5 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
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

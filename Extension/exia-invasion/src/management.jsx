// src/management.jsx
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
  Switch,
  Box,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'; // Added for drag handle
import TRANSLATIONS from "./translations.js";
import { v4 as uuidv4 } from "uuid";


const defaultRow = () => ({
  id: uuidv4(),
  username: "",
  email: "",
  password: "",
  cookie: "",
  enabled: true
});

const AccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState([]);
  const [showPwds, setShowPwds] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null); // Added for drag and drop
  
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
    chrome.storage.local.get("accounts", async (r) => {
      let list = r.accounts || [];
      const updated = list.map(acc =>
        acc.id ? acc : { ...acc, id: uuidv4() }
      );
      if (JSON.stringify(updated) !== JSON.stringify(list)) {
        await new Promise(res => chrome.storage.local.set({ accounts: updated }, res));
      }
      list = updated;
      if (list.length === 0) {
        setAccounts([defaultRow()]);
        setEditing([true]);
        setShowPwds([false]);
      } else {
        setAccounts(list);
        setEditing(Array(list.length).fill(false));
        setShowPwds(Array(list.length).fill(false));
      }
    });
  }, []);
  
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.accounts) {
        const next = changes.accounts.newValue || [];
        setAccounts(next);
        setEditing((e) => (e.length === next.length ? e : Array(next.length).fill(false)));
        setShowPwds((s) => (s.length === next.length ? s : Array(next.length).fill(false)));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
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
    const newRow = defaultRow();
    setAccounts((prev) => [...prev, newRow]);
    setEditing((prev) => [...prev, true]);
    setShowPwds((prev) => [...prev, false]);
  };
  
  const startEdit = (idx) =>
    setEditing((prev) => prev.map((e, i) => (i === idx ? true : e)));
  
  const saveRow = async (idx) => {
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    await persist(accounts);
  };
  
  const deleteRow = async (idx) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      persist(next);
      return next;
    });
    setEditing((prev) => prev.filter((_, i) => i !== idx));
    setShowPwds((prev) => prev.filter((_, i) => i !== idx));
  };
  
  const renderText = (txt) => (txt ? txt : "—");
  
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ---------- Drag and Drop Handlers ---------- */
  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    // Hides the default drag ghost image, can be customized further if needed
    // e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };
  
  const handleDrop = (targetIndex) => {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      return;
    }
    
    const reorderedAccounts = [...accounts];
    const [draggedItem] = reorderedAccounts.splice(draggedItemIndex, 1);
    reorderedAccounts.splice(targetIndex, 0, draggedItem);
    
    const reorderedEditing = [...editing];
    const [draggedEditingState] = reorderedEditing.splice(draggedItemIndex, 1);
    reorderedEditing.splice(targetIndex, 0, draggedEditingState);
    
    const reorderedShowPwds = [...showPwds];
    const [draggedShowPwdState] = reorderedShowPwds.splice(draggedItemIndex, 1);
    reorderedShowPwds.splice(targetIndex, 0, draggedShowPwdState);
    
    setAccounts(reorderedAccounts);
    setEditing(reorderedEditing);
    setShowPwds(reorderedShowPwds);
    persist(reorderedAccounts); // Persist the new order of accounts
    
    setDraggedItemIndex(null);
  };
  
  /* ---------- 渲染 ---------- */
  return (
    <>
      <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}> {/* Header locked at top */}
        <Toolbar>
          <img
            src={iconUrl}
            alt="logo"
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
          <Typography variant="h6">ExiaInvasion</Typography>
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 4, pb: 8 }}> {/* Adjusted maxWidth for potentially wider table */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t("accountTable")}
        </Typography>
        
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}> {/* Drag Handle Icon Cell */}
                {/* Intentionally empty or could add a non-functional drag icon here for header */}
              </TableCell>
              <TableCell width="5%">{t("no")}</TableCell>
              <TableCell width="5%">{t("enabled")}</TableCell>
              <TableCell width="15%">{t("username")}</TableCell>
              <TableCell width="20%">{t("email")}</TableCell>
              <TableCell width="15%">{t("password")}</TableCell>
              <TableCell width="20%">{t("cookie")}</TableCell> {/* Adjusted width */}
              <TableCell width="15%" align="right" /> {/* Actions - Adjusted width to sum up to 100% with others */}
            </TableRow>
          </TableHead>
          
          <TableBody>
            {accounts.map((row, idx) => {
              const isEdit = editing[idx];
              return (
                <TableRow
                  key={row.id}
                  draggable={!isEdit} // Only allow dragging if not in edit mode
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  sx={{
                    "& > *": { verticalAlign: "top" },
                    cursor: !isEdit ? "grab" : "default",
                    opacity: draggedItemIndex === idx ? 0.5 : 1, // Visual cue for item being dragged
                    transition: 'opacity 0.2s ease-in-out', // Smooth opacity transition
                    '&:hover': {
                      backgroundColor: !isEdit && draggedItemIndex === null ? 'action.hover' : 'inherit', // Highlight on hover if draggable
                    }
                  }}
                >
                  {/* Drag Handle Icon */}
                  <TableCell sx={{ textAlign: 'center', cursor: !isEdit ? 'grab' : 'default', paddingLeft: '2px', paddingRight: '2px' }}>
                    {!isEdit && <DragIndicatorIcon fontSize="small" />}
                  </TableCell>
                  {/* Serial Number */}
                  <TableCell>{idx + 1}</TableCell>
                  {/* Enabled */}
                  <TableCell>
                    <Switch
                      size="small"
                      checked={row.enabled !== false}
                      onChange={() => {
                        const nextAccounts = accounts.map((r, i) =>
                          i === idx ? { ...r, enabled: !r.enabled } : r
                        );
                        setAccounts(nextAccounts);
                        persist(nextAccounts);
                      }}
                      disabled={isEdit} // Disable switch during edit mode for consistency
                    />
                  </TableCell>
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
                        type={showPwds[idx] ? "text" : "password"}
                        value={row.password}
                        onChange={(e) => updateField(idx, "password", e.target.value)}
                        fullWidth
                        InputProps={{ // Changed from slotProps for wider compatibility, though slotProps might work in MUI v5+
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setShowPwds((v) => v.map((f, i) => (i === idx ? !f : f)))
                                }
                                edge="end"
                              >
                                {showPwds[idx] ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
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
                        maxRows={3} // Added to control growth
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
                    <Box display="flex" flexDirection="row" justifyContent="flex-end">
                      {isEdit ? (
                        <IconButton
                          color="primary"
                          onClick={() => saveRow(idx)}
                          size="small"
                        >
                          <SaveIcon />
                        </IconButton>
                      ) : (
                        <IconButton onClick={() => startEdit(idx)} size="small">
                          <EditIcon />
                        </IconButton>
                      )}
                      <IconButton
                        color="error"
                        onClick={() => deleteRow(idx)}
                        sx={{ ml: 0.5 }}
                        size="small"
                        disabled={isEdit} // Disable delete during edit mode
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
              <TableCell colSpan={8} sx={{ pt: 2, borderBottom: 'none' }}> {/* Adjusted colSpan */}
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
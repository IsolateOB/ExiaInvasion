// SPDX-License-Identifier: GPL-3.0-or-later
// ========== ExiaInvasion 管理页面组件 ==========
// 主要功能：账户管理、角色数据管理、装备统计配置等

import { useState, useEffect, useCallback, useMemo } from "react";
import ExcelJS from 'exceljs';
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
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  List,
  ListItemAvatar,
  ListItem,
  ListItemText,
  Snackbar,
  Alert,
  Tooltip,
  Stack,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import TRANSLATIONS from "./translations.js";
import { fetchAndCacheNikkeDirectory, getCachedNikkeDirectory } from "./api.js";
import { v4 as uuidv4 } from "uuid";
import { getCharacters, setCharacters, getTemplates, saveTemplate, deleteTemplate, getCurrentTemplateId, setCurrentTemplateId, getAccountTemplates, saveAccountTemplate, deleteAccountTemplate, getCurrentAccountTemplateId, setCurrentAccountTemplateId } from "./storage.js";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

// ========== 常量定义 ==========
// 默认账户行数据结构

const defaultRow = () => ({
  id: uuidv4(),
  username: "",
  email: "",
  password: "",
  cookie: "",
  enabled: true
});

// 装备统计键名列表
const equipStatKeys = [
  "IncElementDmg",    // 属性伤害
  "StatAtk",          // 攻击力
  "StatAmmoLoad",     // 弹药装载
  "StatChargeTime",   // 充能时间
  "StatChargeDamage", // 充能伤害
  "StatCritical",     // 暴击率
  "StatCriticalDamage", // 暴击伤害
  "StatAccuracyCircle", // 精准度
  "StatDef"           // 防御力
];

// ========== 管理页面主组件 ==========

const ManagementPage = () => {
  // ========== 状态管理 ==========
  // 账户管理相关状态
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState([]);
  const [showPwds, setShowPwds] = useState([]);
  // 拖拽状态（账号列表）
  const [accDragging, setAccDragging] = useState({ draggingIndex: null, overIndex: null });

  // 角色管理相关状态
  const [tab, setTab] = useState(0); // 0: 账户管理, 1: 角色管理
  const [characters, setCharactersData] = useState({ 
    elements: { 
      Electronic: [], 
      Fire: [], 
      Wind: [], 
      Water: [], 
      Iron: [], 
      Utility: [] 
    } 
  });
  const [nikkeList, setNikkeList] = useState([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState("");
  const [filters, setFilters] = useState({
    name: "",
    class: "",
    element: "",
    use_burst_skill: "",
    corporation: "",
  weapon_type: ""
  });
  const [filteredNikkes, setFilteredNikkes] = useState([]);
  const [selectedNikkes, setSelectedNikkes] = useState([]);
  const [removedExistingIds, setRemovedExistingIds] = useState([]);
  // 拖拽状态（角色列表）：区分源分组与当前悬停分组，统一跨组视觉
  const [charDragging, setCharDragging] = useState({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // 模板管理相关状态
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  
  // 账号模板管理相关状态
  const [accountTemplates, setAccountTemplates] = useState([]);
  const [selectedAccountTemplateId, setSelectedAccountTemplateId] = useState("");
  const [isAccountRenaming, setIsAccountRenaming] = useState(false);
  const [accountRenameId, setAccountRenameId] = useState("");
  const [accountRenameValue, setAccountRenameValue] = useState("");
  
  // 全选/全不选状态
  const isAllEnabled = useMemo(() => accounts.every(acc => acc.enabled !== false), [accounts]);
  const existingElementCharacters = useMemo(() => {
    if (!selectedElement) return [];
    return characters.elements[selectedElement] || [];
  }, [selectedElement, characters]);
  const effectiveExistingElementCharacters = useMemo(() => {
    if (!removedExistingIds.length) return existingElementCharacters;
    const removedSet = new Set(removedExistingIds);
    return existingElementCharacters.filter((char) => !removedSet.has(char.id));
  }, [existingElementCharacters, removedExistingIds]);
  const effectiveExistingElementIds = useMemo(() => new Set(effectiveExistingElementCharacters.map((char) => char.id)), [effectiveExistingElementCharacters]);

  const nikkeResourceIdMap = useMemo(() => {
    const map = new Map();
    (nikkeList || []).forEach((n) => {
      if (!n) return;
      if (n.id === undefined || n.id === null) return;
      if (n.resource_id === undefined || n.resource_id === null || n.resource_id === "") return;
      map.set(n.id, n.resource_id);
    });
    return map;
  }, [nikkeList]);
  
  /* ========== 语言设置同步 ========== */
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
  
  /* ========== 角色数据初始化 ========== */
  useEffect(() => {
    // 直接读取并设置；若没有数据，则使用空模板
    getCharacters().then(data => {
      const fallback = {
        elements: {
          Electronic: [], Fire: [], Wind: [], Water: [], Iron: [], Utility: []
        }
      };
      const valid = (data && data.elements && typeof data.elements === 'object') ? data : fallback;
      setCharactersData(valid);
    });
    
    // 加载人物目录：优先在线获取并写入本地，其次回退缓存
    (async () => {
      const online = await fetchAndCacheNikkeDirectory();
      if (Array.isArray(online) && online.length) {
        setNikkeList(online);
      } else {
        const cached = await getCachedNikkeDirectory();
        setNikkeList(cached || []);
      }
    })();
  }, []);
  
  /* ========== 模板管理初始化 ========== */
  useEffect(() => {
    // 加载模板列表
    getTemplates().then(list => {
      setTemplates(list || []);
    });
    
    // 加载当前选中的模板ID
    getCurrentTemplateId().then(id => {
      setSelectedTemplateId(id || "");
    });
  }, []);
  
  // 刷新模板列表
  const refreshTemplates = async () => {
    const list = await getTemplates();
    setTemplates(list || []);
  };

  /* ========== 账号模板管理初始化 ========== */
  useEffect(() => {
    // 加载账号模板列表
    getAccountTemplates().then(list => {
      setAccountTemplates(list || []);
    });
    
    // 加载当前选中的账号模板ID
    getCurrentAccountTemplateId().then(id => {
      setSelectedAccountTemplateId(id || "");
    });
  }, []);
  
  // 刷新账号模板列表
  const refreshAccountTemplates = async () => {
    const list = await getAccountTemplates();
    setAccountTemplates(list || []);
  };
  
  // 生成下一个默认账号模板名称
  const generateNextAccountDefaultName = () => {
    const existing = accountTemplates.map(t => t.name);
    let n = 1;
    while (existing.includes(`${t("accountTemplate")}${n}`)) n++;
    return `${t("accountTemplate")}${n}`;
  };
  
  // 应用账号模板
  const applyAccountTemplate = async (tpl) => {
    if (!tpl || !tpl.data) return;
    const data = tpl.data;
    setAccounts(data);
    setEditing(Array(data.length).fill(false));
    setShowPwds(Array(data.length).fill(false));
    await persist(data);
  };
  
  // 保存当前账号为模板
  const handleCreateAccountTemplate = async () => {
    const id = uuidv4();
    const template = {
      id,
      name: generateNextAccountDefaultName(),
      data: accounts,
      createdAt: Date.now()
    };
    await saveAccountTemplate(template);
    await refreshAccountTemplates();
    setSelectedAccountTemplateId(id);
    await setCurrentAccountTemplateId(id);
    showMessage(t("accountTemplateSaved"), "success");
  };
  
  // 删除账号模板
  const handleDeleteAccountTemplate = async (id) => {
    if (!id) return;
    await deleteAccountTemplate(id);
    await refreshAccountTemplates();
    if (selectedAccountTemplateId === id) {
      setSelectedAccountTemplateId("");
      await setCurrentAccountTemplateId("");
    }
    showMessage(t("accountTemplateDeleted"), "success");
  };
  
  // 重命名账号模板
  const startRenameAccountTemplate = (id) => {
    setIsAccountRenaming(true);
    setAccountRenameId(id);
    const tpl = accountTemplates.find(t => t.id === id);
    setAccountRenameValue(tpl?.name || "");
  };
  
  const confirmAccountRename = async () => {
    const id = accountRenameId;
    const name = accountRenameValue.trim();
    if (!id || !name) return;
    
    const tpl = accountTemplates.find(t => t.id === id);
    if (!tpl) return;
    
    tpl.name = name;
    await saveAccountTemplate(tpl);
    await refreshAccountTemplates();
    setSelectedAccountTemplateId(id);
    setIsAccountRenaming(false);
    setAccountRenameId("");
    setAccountRenameValue("");
    showMessage(t("accountTemplateRenamed"), "success");
  };
  
  // 账号模板选择变化
  const handleAccountTemplateChange = async (id) => {
    setSelectedAccountTemplateId(id);
    await setCurrentAccountTemplateId(id);
    if (id) {
      const tpl = accountTemplates.find(t => t.id === id);
      if (tpl) {
        await applyAccountTemplate(tpl);
        showMessage(t("accountTemplateLoaded"), "success");
      }
    }
  };
  
  // 清空所有账号
  const handleClearAllAccounts = async () => {
    if (!window.confirm(t("clearAllAccountsConfirm"))) {
      return;
    }
    setAccounts([]);
    setEditing([]);
    setShowPwds([]);
    await persist([]);
  };
  
  // 生成下一个默认模板名称
  const generateNextDefaultName = () => {
    const existing = templates.map(t => t.name);
    let n = 1;
    while (existing.includes(`${t("template")}${n}`)) n++;
    return `${t("template")}${n}`;
  };
  
  // 应用模板
  const applyTemplate = async (tpl) => {
    if (!tpl || !tpl.data) return;
    setCharactersData(tpl.data);
    setCharacters(tpl.data);
  };
  
  // 保存当前配置为模板
  const handleCreateTemplate = async () => {
    const id = uuidv4();
    const template = {
      id,
      name: generateNextDefaultName(),
      data: characters,
      createdAt: Date.now()
    };
    await saveTemplate(template);
    await refreshTemplates();
    setSelectedTemplateId(id);
    await setCurrentTemplateId(id);
    showMessage(t("templateSaved"), "success");
  };
  
  // 删除模板
  const handleDeleteTemplate = async (id) => {
    if (!id) return;
    await deleteTemplate(id);
    await refreshTemplates();
    if (selectedTemplateId === id) {
      setSelectedTemplateId("");
      await setCurrentTemplateId("");
    }
    showMessage(t("templateDeleted"), "success");
  };
  
  // 重命名模板
  const startRenameTemplate = (id) => {
    setIsRenaming(true);
    setRenameId(id);
    const tpl = templates.find(t => t.id === id);
    setRenameValue(tpl?.name || "");
  };
  
  const confirmRename = async () => {
    const id = renameId;
    const name = renameValue.trim();
    if (!id || !name) return;
    
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    
    tpl.name = name;
    await saveTemplate(tpl);
    await refreshTemplates();
    setSelectedTemplateId(id);
    setIsRenaming(false);
    setRenameId("");
    setRenameValue("");
    showMessage(t("templateRenamed"), "success");
  };
  
  // 模板选择变化
  const handleTemplateChange = async (id) => {
    setSelectedTemplateId(id);
    await setCurrentTemplateId(id);
    if (id) {
      const tpl = templates.find(t => t.id === id);
      if (tpl) {
        await applyTemplate(tpl);
        showMessage(t("templateLoaded"), "success");
      }
    }
  };
  
  
  /* ========== 账号数据初始化 ========== */
  useEffect(() => {
    chrome.storage.local.get("accounts", async (r) => {
      let list = r.accounts || [];
      // 为没有 ID 的账号添加唯一标识符
      const updated = list.map(acc =>
        acc.id ? acc : { ...acc, id: uuidv4() }
      );
      if (JSON.stringify(updated) !== JSON.stringify(list)) {
        await new Promise(res => chrome.storage.local.set({ accounts: updated }, res));
      }
      list = updated;
      
      // 如果没有账号，创建默认空行
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
  
  // 监听存储变化并同步状态
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
  
  // 持久化账号数据到存储
  const persist = (data) =>
    new Promise((ok) => chrome.storage.local.set({ accounts: data }, ok));

  // 已移除全局设置的持久化（攻优突破分改为按角色行控制）
  
  /* ========== 账号管理操作函数 ========== */
  // 更新指定账号的字段值
  const updateField = (idx, field, value) =>
    setAccounts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  
  // 添加新账号行
  const addRow = () => {
    const newRow = defaultRow();
    setAccounts((prev) => [...prev, newRow]);
    setEditing((prev) => [...prev, true]);
    setShowPwds((prev) => [...prev, false]);
  };
  
  // 开始编辑指定行
  const startEdit = (idx) =>
    setEditing((prev) => prev.map((e, i) => (i === idx ? true : e)));
  
  // 保存指定行的修改
  const saveRow = async (idx) => {
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    await persist(accounts);
  };
    // 删除指定行
  const deleteRow = async (idx) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      persist(next);
      return next;
    });
    setEditing((prev) => prev.filter((_, i) => i !== idx));
    setShowPwds((prev) => prev.filter((_, i) => i !== idx));
  };
  
  // 全选/全不选启用状态
  const handleToggleAllEnabled = async () => {
    const newEnabledState = !isAllEnabled;
    const updatedAccounts = accounts.map(acc => ({
      ...acc,
      enabled: newEnabledState
    }));
    setAccounts(updatedAccounts);
    await persist(updatedAccounts);
  };

  // 导出账号到Excel
  const handleExportAccounts = async () => {
    try {
      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Accounts');

      // 设置列标题（中英文双语）
      worksheet.columns = [
        { header: 'Game UID', key: 'game_uid', width: 20 },
        { header: '账号 Username', key: 'username', width: 25 },
        { header: '邮箱 Email', key: 'email', width: 30 },
        { header: '密码 Password', key: 'password', width: 25 },
        { header: 'Cookie', key: 'cookie', width: 50 },
      ];

      // 添加数据
      accounts.forEach(acc => {
        worksheet.addRow({
          game_uid: acc.game_uid || '',
          username: acc.username || '',
          email: acc.email || '',
          password: acc.password || '',
          cookie: acc.cookie || ''
        });
      });

      // 下载文件
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const filename = `ExiaInvasion_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadFile(blob, filename);
      
      showMessage(t("exportSuccess"), "success");
    } catch (error) {
      console.error("导出失败:", error);
      showMessage(t("exportError"), "error");
    }
  };

  // 导入账号从Excel
  const handleImportAccounts = () => {
    selectFile('.xlsx,.xls', async (file) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.getWorksheet(1); // 第一个工作表
        if (!worksheet) {
          showMessage(t("importError"), "error");
          return;
        }

        // 处理导入的数据
        const currentAccounts = [...accounts];
        let addedCount = 0;
        let updatedCount = 0;

        // 辅助函数：将单元格值安全转换为字符串，处理富文本/公式等情况，避免 [object Object]
        const getCellString = (cell) => {
          if (!cell) return '';
            const v = cell.value;
            if (v == null) return '';
            if (typeof v === 'object') {
              // 富文本 { richText: [...] }
              if (Array.isArray(v.richText)) {
                return v.richText.map(r => r.text || '').join('').trim();
              }
              // 公式 { formula, result }
              if (v.result != null) return String(v.result).trim();
              // 直接文本 { text: 'xxx' }
              if (v.text != null) return String(v.text).trim();
            }
            return String(v).trim();
        };

        // 获取表头行以识别列位置
        const headerRow = worksheet.getRow(1);
        let gameUidCol = 1, usernameCol = 2, emailCol = 3, passwordCol = 4, cookieCol = 5;
        
        // 尝试根据表头内容智能识别列位置（使用 getCellString 处理富文本）
        headerRow.eachCell((cell, colNumber) => {
          const cellValue = getCellString(cell).toLowerCase();
          if (cellValue.includes('game') && cellValue.includes('uid')) {
            gameUidCol = colNumber;
          } else if (cellValue.includes('账号') || cellValue.includes('username')) {
            usernameCol = colNumber;
          } else if (cellValue.includes('邮箱') || cellValue.includes('email')) {
            emailCol = colNumber;
          } else if (cellValue.includes('密码') || cellValue.includes('password')) {
            passwordCol = colNumber;
          } else if (cellValue.includes('cookie')) {
            cookieCol = colNumber;
          }
        });

        // 跳过标题行，从第2行开始
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return; // 跳过标题行

          const gameUid = getCellString(row.getCell(gameUidCol));
          const username = getCellString(row.getCell(usernameCol));
          const email = getCellString(row.getCell(emailCol));
          const password = getCellString(row.getCell(passwordCol));
          const cookie = getCellString(row.getCell(cookieCol));

          // 查找是否存在相同game_uid的账号（game_uid不能为空）
          let existingIndex = -1;
          if (gameUid) {
            existingIndex = currentAccounts.findIndex(acc => acc.game_uid === gameUid);
          }

          if (existingIndex !== -1) {
            // 更新现有账号
            currentAccounts[existingIndex] = {
              ...currentAccounts[existingIndex],
              username: username || currentAccounts[existingIndex].username,
              email: email || currentAccounts[existingIndex].email,
              password: password || currentAccounts[existingIndex].password,
              cookie: cookie || currentAccounts[existingIndex].cookie,
              game_uid: gameUid || currentAccounts[existingIndex].game_uid,
            };
            updatedCount++;
          } else {
            // 添加新账号
            currentAccounts.push({
              id: uuidv4(),
              username: username,
              email: email,
              password: password,
              cookie: cookie,
              game_uid: gameUid,
              enabled: true,
            });
            addedCount++;
          }
        });

        setAccounts(currentAccounts);
        await persist(currentAccounts);
        
        showMessage(t("importSuccess") + ` (${t("added")}: ${addedCount}, ${t("updated")}: ${updatedCount})`, "success");
      } catch (error) {
        console.error("导入失败:", error);
        showMessage(t("importError"), "error");
      }
    });
  };

  // 显示提示消息（统一）
  const showMessage = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // 通用文件下载函数
  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 通用文件选择函数
  const selectFile = (accept, onFileSelected) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        onFileSelected(file);
      }
    };
    input.click();
  };

  // 渲染文本内容（空值显示占位符）
  const renderText = (txt) => (txt ? txt : "—");

  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ---------- 账号列表：拖拽处理（从零实现） ---------- */
  const onAccountDragStart = (e, index) => {
    setAccDragging({ draggingIndex: index, overIndex: index });
    // 使用透明拖拽影子，减少跳动
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
    e.dataTransfer.setDragImage(img, 0, 0);
  };
  const onAccountDragOver = (e, index) => {
    e.preventDefault();
    if (accDragging.draggingIndex !== null && accDragging.overIndex !== index) {
      setAccDragging((s) => ({ ...s, overIndex: index }));
    }
  };
  const onAccountDrop = (index) => {
    const { draggingIndex } = accDragging;
    if (draggingIndex === null || draggingIndex === index) {
      setAccDragging({ draggingIndex: null, overIndex: null });
      return;
    }
    const reordered = [...accounts];
    const [dragged] = reordered.splice(draggingIndex, 1);
    reordered.splice(index, 0, dragged);
    setAccounts(reordered);
    // 同步编辑和密码可见性的行对应关系
    const ed = [...editing];
    const [dragEdit] = ed.splice(draggingIndex, 1);
    ed.splice(index, 0, dragEdit);
    setEditing(ed);
    const sw = [...showPwds];
    const [dragShow] = sw.splice(draggingIndex, 1);
    sw.splice(index, 0, dragShow);
    setShowPwds(sw);
    persist(reordered);
    setAccDragging({ draggingIndex: null, overIndex: null });
  };
  const onAccountDragEnd = () => setAccDragging({ draggingIndex: null, overIndex: null });
    
/* ---------- 角色管理工具函数 ---------- */
const elementTranslationKeys = {
    Electronic: "electronic",
    Fire: "fire",
    Wind: "wind",
    Water: "water",
    Iron: "iron",
    Utility: "utility"
  };

  const classTranslationKeys = {
    Attacker: "attacker",
    Defender: "defender",
    Supporter: "supporter"
  };

  const corporationTranslationKeys = {
    ELYSION: "elysion",
    MISSILIS: "missilis",
    TETRA: "tetra",
    PILGRIM: "pilgrim",
    ABNORMAL: "abnormal"
  };

  const equipStatLabels = [
    t("elementAdvantage"),
    t("attack"),
    t("ammo"),
    t("chargeSpeed"),
    t("chargeDamage"),
    t("critical"),
    t("criticalDamage"),
    t("hit"),
    t("defense")
  ];
  
  const getElementName = (element) => {
    const key = elementTranslationKeys[element];
    return key ? t(key) : element;
  };
  
  const getClassName = (className) => {
    const key = classTranslationKeys[className];
    return key ? t(key) : className;
  };
  
  const getCorporationName = (corporation) => {
    const key = corporationTranslationKeys[corporation];
    return key ? t(key) : corporation;
  };

  const getBurstStageName = (stage) => {
    switch (stage) {
      case "Step1":
        return t("burstStage1");
      case "Step2":
        return t("burstStage2");
      case "Step3":
        return t("burstStage3");
      case "AllStep":
        return t("burstStageAll");
      default:
        return stage || "—";
    }
  };

  const getDisplayName = (nikke) => {
    if (!nikke) return "";
    const zhName = nikke.name_cn || nikke.name_en || nikke.name_code || nikke.name;
    const enName = nikke.name_en || nikke.name_cn || nikke.name_code || nikke.name;
    return lang === "zh" ? zhName : enName;
  };

  const getNikkeResourceId = useCallback((nikke) => {
    if (!nikke) return undefined;
    const direct = nikke.resource_id ?? nikke.resourceId;
    if (direct !== undefined && direct !== null && direct !== "") return direct;
    const id = nikke.id;
    if (id === undefined || id === null) return undefined;
    return nikkeResourceIdMap.get(id);
  }, [nikkeResourceIdMap]);

  const getNikkeAvatarUrl = useCallback((nikke) => {
    const rid = getNikkeResourceId(nikke);
    if (rid === undefined || rid === null || rid === "") return "";
    const ridStr = String(rid).padStart(3, "0");
    return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`;
  }, [getNikkeResourceId]);

  const openFilterDialog = (element) => {
    setSelectedElement(element);
    const initialFilters = {
      name: "",
      class: "",
      element: element !== "Utility" ? element : "",
      use_burst_skill: "",
      corporation: "",
      weapon_type: ""
    };
    setFilters(initialFilters);

    let filtered = nikkeList;
    if (element !== "Utility") {
      filtered = filtered.filter((nikke) => nikke.element === element);
    }
    setFilteredNikkes(filtered);
    setSelectedNikkes([]);
    setRemovedExistingIds([]);
    setFilterDialogOpen(true);
  };

  const applyFilters = useCallback(() => {
    let filtered = nikkeList;

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      if (key === "name") {
        const searchTerm = value.toLowerCase();
        filtered = filtered.filter((nikke) =>
          (nikke.name_cn && nikke.name_cn.toLowerCase().includes(searchTerm)) ||
          (nikke.name_en && nikke.name_en.toLowerCase().includes(searchTerm))
        );
        return;
      }

      if (key === "use_burst_skill") {
        filtered = filtered.filter(
          (nikke) => nikke[key] === value || nikke[key] === "AllStep"
        );
        return;
      }

      filtered = filtered.filter((nikke) => nikke[key] === value);
    });

    setFilteredNikkes(filtered);
  }, [nikkeList, filters]);

  const handleCloseFilterDialog = () => {
    setFilterDialogOpen(false);
    setSelectedNikkes([]);
    setRemovedExistingIds([]);
  };

  // 与 ExiaAnalysis 选择器一致：点击“选择/已选择”只会加入，不会再次点击取消；取消通过“已选择”区右上角 X
  const handleSelectNikke = (nikke) => {
    // 如果该人物在当前元素里但被标记为删除，则点击“选择”视为撤销删除
    if (removedExistingIds.includes(nikke.id)) {
      setRemovedExistingIds((prev) => prev.filter((id) => id !== nikke.id));
      return;
    }
    setSelectedNikkes((prev) => {
      if (prev.some((item) => item.id === nikke.id)) return prev;
      return [...prev, nikke];
    });
  };

  const handleRemoveSelectedNikke = (nikkeId) => {
    setSelectedNikkes((prev) => prev.filter((item) => item.id !== nikkeId));
  };

  const handleRemoveExistingNikke = (nikkeId) => {
    setRemovedExistingIds((prev) => (prev.includes(nikkeId) ? prev : [...prev, nikkeId]));
    // 若刚好也在待新增里，一并移除
    setSelectedNikkes((prev) => prev.filter((item) => item.id !== nikkeId));
  };

  const handleConfirmSelection = () => {
    if (!selectedElement) {
      handleCloseFilterDialog();
      return;
    }

    // 先应用删除（从原列表中移除被标记的人）
    const existingList = characters.elements[selectedElement] || [];
    const removedSet = new Set(removedExistingIds);
    const keptList = removedExistingIds.length ? existingList.filter((c) => !removedSet.has(c.id)) : existingList;

    // 再应用新增（在“删除已应用后”的基础上去重）
    const keptIds = new Set(keptList.map((char) => char.id));
    const newEntries = selectedNikkes
      .filter((nikke) => !keptIds.has(nikke.id))
      .map((nikke) => ({
        name_code: nikke.name_code,
        id: nikke.id,
        resource_id: nikke.resource_id,
        name_cn: nikke.name_cn,
        name_en: nikke.name_en,
        priority: "yellow",
        showStats: ["AtkElemLbScore", ...equipStatKeys]
      }));

    // 若没有任何变更，直接关闭
    if (newEntries.length === 0 && removedExistingIds.length === 0) {
      handleCloseFilterDialog();
      return;
    }

    const nextCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [selectedElement]: [...keptList, ...newEntries]
      }
    };

    setCharactersData(nextCharacters);
    setCharacters(nextCharacters);
    handleCloseFilterDialog();
  };

  const updateCharacterPriority = (element, characterIndex, priority) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].map((char, index) => 
          index === characterIndex ? { ...char, priority } : char
        )
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };

  const updateCharacterShowStats = (element, characterIndex, stats) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].map((char, index) =>
          index === characterIndex ? { ...char, showStats: stats } : char
        )
      }
    };

    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };
  
  const deleteCharacter = (element, characterIndex) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].filter((_, index) => index !== characterIndex)
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };

  // 清空所有妮姬列表
  const handleClearAllCharacters = () => {
    if (!window.confirm(t("clearAllNikkesConfirm"))) {
      return;
    }
    const emptyCharacters = {
      elements: {
        Electronic: [],
        Fire: [],
        Wind: [],
        Water: [],
        Iron: [],
        Utility: []
      }
    };
    setCharactersData(emptyCharacters);
    setCharacters(emptyCharacters);
  };
    const getPriorityColor = (priority) => {
      // 与 excel.js 保持一致：
      // black: #000000 + 白字；blue: #99CCFF + 黑字；yellow: #FFFF88 + 黑字；red: #FF7777 + 白字
      switch (priority) {
        case "black": return { backgroundColor: "#000000", color: "#FFFFFF" };
        case "blue":  return { backgroundColor: "#99CCFF", color: "#000000" };
        case "yellow":return { backgroundColor: "#FFFF88", color: "#000000" };
        case "red":   return { backgroundColor: "#FF7777", color: "#FFFFFF" };
        default:       return { backgroundColor: "#e0e0e0", color: "#000000" };
      }
    };

  /* ---------- 角色列表：拖拽处理（从零实现） ---------- */
  const onCharDragStart = (e, element, index) => {
    setCharDragging({ sourceElement: element, currentElement: element, draggingIndex: index, overIndex: index });
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
    e.dataTransfer.setDragImage(img, 0, 0);
  };
  const onCharDragOver = (e, element, index) => {
    e.preventDefault();
    setCharDragging((s) => {
      if (s.draggingIndex === null) return s;
      // 跨组悬停：更新 currentElement 与 overIndex，以便目标组行高亮
      if (s.currentElement !== element || s.overIndex !== index) {
        return { ...s, currentElement: element, overIndex: index };
      }
      return s;
    });
  };
  const onCharDrop = (element, index) => {
    const { sourceElement: srcElem, currentElement, draggingIndex } = charDragging;
    if (srcElem == null || draggingIndex == null) {
      setCharDragging({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
      return;
    }
    const draft = { ...characters, elements: { ...characters.elements } };
    const fromArr = [...draft.elements[srcElem]];
    const [dragChar] = fromArr.splice(draggingIndex, 1);
    const targetElem = currentElement ?? element;
    if (srcElem === targetElem) {
      fromArr.splice(index, 0, dragChar);
      draft.elements[targetElem] = fromArr;
    } else {
      draft.elements[srcElem] = fromArr;
      const toArr = [...draft.elements[targetElem]];
      toArr.splice(index, 0, dragChar);
      draft.elements[targetElem] = toArr;
    }
    setCharactersData(draft);
    setCharacters(draft);
    setCharDragging({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
  };
  const onCharDragEnd = () => setCharDragging({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
  
  /* ---------- Import/Export Handlers ---------- */
  // 导出角色 JSON：内存字典已不包含 enableAtkElemLbScore，直接序列化即可
  const handleExportCharacters = () => {
    try {
      const dataStr = JSON.stringify(characters, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const filename = `ExiaInvasion_Characters_${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(blob, filename);
      showMessage(t("exportSuccess"), "success");
    } catch (error) {
      console.error("导出失败:", error);
      showMessage(t("exportError"), "error");
    }
  };

  const handleImportCharacters = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        // 基本校验
        if (importedData && importedData.elements && typeof importedData.elements === 'object') {
          setCharactersData(importedData);
          setCharacters(importedData);
          showMessage(t("importSuccess"), "success");
        } else {
          throw new Error("Invalid file format");
        }
      } catch (error) {
        console.error("Import failed:", error);
        showMessage(t("importError"), "error");
      }
    };
    reader.readAsText(file);
  };

  const triggerCharacterImport = () => {
    selectFile('.json', handleImportCharacters);
  };

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const pendingSelectionCount = selectedNikkes.length;
  const totalSelectionCount = pendingSelectionCount + effectiveExistingElementCharacters.length;
  const selectionLabelTemplate = t("selectedCharactersLabel") || "Selected {count}";
  const selectionLabel = selectionLabelTemplate.replace("{count}", String(totalSelectionCount));
    /* ---------- 渲染 ---------- */
  return (
    <>
      <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
        <Toolbar>
          <img
            src={iconUrl}
            alt="logo"
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
          <Typography variant="h6">ExiaInvasion</Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
        <Tabs value={tab} onChange={(e, newTab) => setTab(newTab)} sx={{ mb: 3 }}>
          <Tab label={t("accountTable")} />
          <Tab label={t("characterManagement")} />
        </Tabs>
          {tab === 0 && (
          <>
            {/* 账户管理标题和操作按钮 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2 }}>
              <Typography variant="h6">
                {t("accountTable")}
              </Typography>
              
              {/* 右侧：模板选择器 + 操作按钮 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                {/* 第一行：全选/导入/导出/清空按钮 */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleToggleAllEnabled}
                    sx={{ minWidth: 80 }}
                  >
                    {isAllEnabled ? t("deselectAll") : t("selectAll")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleImportAccounts}
                    sx={{ minWidth: 80 }}
                  >
                    {t("import")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileUploadIcon />}
                    onClick={handleExportAccounts}
                    sx={{ minWidth: 80 }}
                  >
                    {t("export")}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleClearAllAccounts}
                    sx={{ minWidth: 80 }}
                  >
                    {t("clearAllAccounts")}
                  </Button>
                </Box>
                
                {/* 第二行：账号模板选择器 */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Select
                    size="small"
                    value={selectedAccountTemplateId || ''}
                    onChange={(e) => handleAccountTemplateChange(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: 200, width: 240 }}
                    renderValue={(val) => {
                      const id = String(val || '');
                      const item = accountTemplates.find(tp => tp.id === id);
                      const name = item?.name || '';
                      const display = name || t("accountTemplateNotSelected");
                      return (
                        <Typography noWrap title={display} sx={{ maxWidth: '100%' }}>{display}</Typography>
                      );
                    }}
                    MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                  >
                    <MenuItem value=""><em>{t("accountTemplateNotSelected")}</em></MenuItem>
                    {accountTemplates.map((tpl) => (
                      <MenuItem key={tpl.id} value={tpl.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isAccountRenaming && accountRenameId === tpl.id ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onClick={(e)=>e.stopPropagation()}>
                            <TextField
                              size="small"
                              placeholder={t("accountTemplateInputName")}
                              value={accountRenameValue}
                              onChange={(e) => setAccountRenameValue(e.target.value)}
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') { 
                                  e.stopPropagation(); 
                                  confirmAccountRename();
                                }
                                if (e.key === 'Escape') { 
                                  e.stopPropagation(); 
                                  setIsAccountRenaming(false); 
                                  setAccountRenameId(''); 
                                  setAccountRenameValue('');
                                }
                              }}
                              autoFocus
                              sx={{ flex: 1, minWidth: 0 }}
                            />
                            <IconButton size="small" color="primary" onClick={(e)=>{ e.stopPropagation(); confirmAccountRename(); }}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={(e)=>{ e.stopPropagation(); setIsAccountRenaming(false); setAccountRenameId(''); setAccountRenameValue(''); }}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap title={tpl.name}>{tpl.name}</Typography>
                            </Box>
                            <Tooltip title={t("templateRename")}>
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); startRenameAccountTemplate(tpl.id); }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t("templateDelete")}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteAccountTemplate(tpl.id); }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleCreateAccountTemplate}
                    disabled={accountTemplates.length >= 200}
                  >
                    {t("templateSave")}
                  </Button>
                </Box>
              </Box>
            </Box>
            
            {/* Account management table */}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                    {/* Drag handle header */}
                  </TableCell>
                  <TableCell width="5%">{t("no")}</TableCell>
                  <TableCell width="5%">{t("enabled")}</TableCell>
                  <TableCell width="15%">{t("username")}</TableCell>
                  <TableCell width="20%">{t("email")}</TableCell>
                  <TableCell width="15%">{t("password")}</TableCell>
                  <TableCell width="20%">{t("cookie")}</TableCell>
                  <TableCell width="15%" align="right" />
                </TableRow>
              </TableHead>
              
              <TableBody>
                {accounts.map((row, idx) => {
                  const isEdit = editing[idx];
                  return (
                    <TableRow
                      key={row.id}
                      draggable={!isEdit}
                      onDragStart={(e) => !isEdit && onAccountDragStart(e, idx)}
                      onDragOver={(e) => !isEdit && onAccountDragOver(e, idx)}
                      onDrop={() => !isEdit && onAccountDrop(idx)}
                      onDragEnd={onAccountDragEnd}
                      sx={{
                        "& > *": { verticalAlign: "top" },
                        cursor: !isEdit ? "grab" : "default",
                        backgroundColor: accDragging.overIndex === idx && accDragging.draggingIndex !== null ? 'action.hover' : 'inherit'
                      }}
                    >                      <TableCell sx={{ textAlign: 'center', cursor: !isEdit ? 'grab' : 'default', paddingLeft: '2px', paddingRight: '2px' }}>
                        {!isEdit && <DragIndicatorIcon fontSize="small" />}
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
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
                          disabled={isEdit}
                        />
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            value={row.username}
                            onChange={(e) => updateField(idx, "username", e.target.value)}
                            fullWidth
                          />
                        ) : (
                          renderText(row.username)
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            value={row.email}
                            onChange={(e) => updateField(idx, "email", e.target.value)}
                            fullWidth
                          />
                        ) : (
                          renderText(row.email)
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            type={showPwds[idx] ? "text" : "password"}
                            value={row.password}
                            onChange={(e) => updateField(idx, "password", e.target.value)}
                            fullWidth
                            slotProps={{
                              input: {
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
                                sx: {
                                  '& input[type="password"]::-ms-reveal': {
                                    display: 'none'
                                  },
                                  '& input[type="password"]::-ms-clear': {
                                    display: 'none'
                                  },
                                  '& input[type="password"]::-webkit-credentials-auto-fill-button': {
                                    display: 'none !important'
                                  },
                                  '& input[type="password"]::-webkit-contacts-auto-fill-button': {
                                    display: 'none !important'
                                  }
                                }
                              },
                            }}
                          />
                        ) : row.password ? (
                          "••••••"
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            multiline
                            maxRows={3}
                            value={row.cookie}
                            onChange={(e) => updateField(idx, "cookie", e.target.value)}
                            fullWidth
                          />
                        ) : row.cookie ? (
                          t("saved")
                        ) : (
                          "—"
                        )}
                      </TableCell>
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
                            disabled={isEdit}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                <TableRow>
                  <TableCell colSpan={8} sx={{ pt: 2, borderBottom: 'none' }}>
                    <Box display="flex" justifyContent="center">
                      <IconButton color="primary" onClick={addRow}>
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
          {tab === 1 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2 }}>
              <Typography variant="h6">
                {t("characterManagement")}
              </Typography>
              
              {/* 右侧：模板选择器 + 导入导出按钮 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                {/* 第一行：导入导出清空按钮 */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    onClick={triggerCharacterImport}
                    sx={{ minWidth: 80 }}
                  >
                    {t("import")}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileUploadIcon/>}
                    onClick={handleExportCharacters}
                    sx={{ minWidth: 80 }}
                  >
                    {t("export")}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleClearAllCharacters}
                    sx={{ minWidth: 80 }}
                  >
                    {t("clearAllNikkes")}
                  </Button>
                </Box>
                
                {/* 第二行：模板选择器 */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Select
                    size="small"
                    value={selectedTemplateId || ''}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    displayEmpty
                    sx={{ minWidth: 200, width: 240 }}
                    renderValue={(val) => {
                      const id = String(val || '');
                      const item = templates.find(tp => tp.id === id);
                      const name = item?.name || '';
                      const display = name || t("templateNotSelected");
                      return (
                        <Typography noWrap title={display} sx={{ maxWidth: '100%' }}>{display}</Typography>
                      );
                    }}
                    MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                  >
                    <MenuItem value=""><em>{t("templateNotSelected")}</em></MenuItem>
                    {templates.map((tpl) => (
                      <MenuItem key={tpl.id} value={tpl.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isRenaming && renameId === tpl.id ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }} onClick={(e)=>e.stopPropagation()}>
                            <TextField
                              size="small"
                              placeholder={t("templateInputName")}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') { 
                                  e.stopPropagation(); 
                                  confirmRename();
                                }
                                if (e.key === 'Escape') { 
                                  e.stopPropagation(); 
                                  setIsRenaming(false); 
                                  setRenameId(''); 
                                  setRenameValue('');
                                }
                              }}
                              autoFocus
                              sx={{ flex: 1, minWidth: 0 }}
                            />
                            <IconButton size="small" color="primary" onClick={(e)=>{ e.stopPropagation(); confirmRename(); }}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={(e)=>{ e.stopPropagation(); setIsRenaming(false); setRenameId(''); setRenameValue(''); }}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap title={tpl.name}>{tpl.name}</Typography>
                            </Box>
                            <Tooltip title={t("templateRename")}>
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); startRenameTemplate(tpl.id); }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t("templateDelete")}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteTemplate(tpl.id); }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleCreateTemplate}
                    disabled={templates.length >= 200}
                  >
                    {t("templateSave")}
                  </Button>
                </Box>
              </Box>
            </Box>
            
            {["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].map((element) => {
              const elementChars = characters.elements[element] || [];
              return (
                <Box key={element} sx={{ mb: 3, border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
                    <Typography variant="h6" sx={{ minWidth: 0 }}>
                      {getElementName(element)} ({elementChars.length})
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openFilterDialog(element)}
                      sx={{ flex: '0 0 auto' }}
                    >
                      {t("addOrEdit")}
                    </Button>
                  </Box>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {/* Character Table */}
                    <Table size="small">                      <TableHead>
                        <TableRow>
                          <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                            {/* Drag handle header */}
                          </TableCell>
                          <TableCell width="5%">{t("no")}</TableCell>
                          <TableCell width="20%">{t("characterName")}</TableCell>
                          <TableCell width="10%">{t("priority")}</TableCell>
                          {/* 攻优突破分开关列标题（悬停提示） */}
                          <TableCell width="8%" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                            <Tooltip
                              arrow
                              placement="top"
                              title={
                                lang === 'zh' ? (
                                  <Box component="span">
                                    攻优突破分(AEL)
                                    <br />
                                    AEL = (1 + 0.9 × 攻击词条) × (1 + 10% + 优越词条) × (1 + 3% × 极限突破 + 2% × 核心强化)
                                  </Box>
                                ) : (
                                  <Box component="span">
                                    Attack Element Limit Break Score (AEL)
                                    <br />
                                    AEL = (1 + 0.9 × ATK%) × (1 + 10% + Elem%) × (1 + 3% × Limit Break + 2% × Core Refinement)
                                  </Box>
                                )
                              }
                            >
                              <Box component="span">{t("atkElemLbScore")}</Box>
                            </Tooltip>
                          </TableCell>
                          {/* 装备词条列标题 */}
                          {equipStatKeys.map((key, idx) => (
                            <TableCell key={key} width="6%" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                              {equipStatLabels[idx]}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {elementChars.map((charData, index) => (
                          <TableRow
                            key={`${charData.id}-${index}`}
                            draggable
                            onDragStart={(e) => onCharDragStart(e, element, index)}
                            onDragOver={(e) => onCharDragOver(e, element, index)}
                            onDrop={() => onCharDrop(element, index)}
                            onDragEnd={onCharDragEnd}
                            sx={{
                              "& > *": { verticalAlign: "top" },
                              cursor: "grab",
                              backgroundColor: charDragging.currentElement === element && charDragging.overIndex === index ? 'action.hover' : 'inherit'
                            }}
                          >
                            <TableCell sx={{ textAlign: 'center', cursor: 'grab', paddingLeft: '2px', paddingRight: '2px' }}>
                              <DragIndicatorIcon fontSize="small" />
                            </TableCell>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {getNikkeAvatarUrl(charData) ? (
                                    <Box
                                      component="img"
                                      src={getNikkeAvatarUrl(charData)}
                                      alt={getDisplayName(charData)}
                                      loading="lazy"
                                      sx={{ width: 44, height: 44, borderRadius: 2, objectFit: 'cover', flex: '0 0 auto' }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                  <Box component="span">{lang === "zh" ? charData.name_cn : charData.name_en}</Box>
                                </Box>
                              </Typography>
                            </TableCell>                            <TableCell>
                              <FormControl size="small" sx={{ minWidth: 100 }}>
                                <Select
                                  value={charData.priority}
                                  onChange={(e) => updateCharacterPriority(element, index, e.target.value)}
                                  sx={{
                                    ...getPriorityColor(charData.priority),
                                    '& .MuiSelect-select': {
                                      ...getPriorityColor(charData.priority)
                                    }
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 200,
                                        width: 'auto',
                                      },
                                    },
                                    anchorOrigin: {
                                      vertical: 'bottom',
                                      horizontal: 'left',
                                    },
                                    transformOrigin: {
                                      vertical: 'top',
                                      horizontal: 'left',
                                    },
                                  }}
                                >
                                  <MenuItem value="black" sx={{
                                    ...getPriorityColor("black"),
                                    '&.Mui-selected': {
                                      ...getPriorityColor("black"),
                                    },
                                    '&.Mui-selected:hover': {
                                      ...getPriorityColor("black"),
                                    },
                                    '&:hover': {
                                      ...getPriorityColor("black"),
                                      filter: 'brightness(0.95)'
                                    }
                                  }}>{t("black")}</MenuItem>
                                  <MenuItem value="blue" sx={{
                                    ...getPriorityColor("blue"),
                                    '&.Mui-selected': {
                                      ...getPriorityColor("blue"),
                                    },
                                    '&.Mui-selected:hover': {
                                      ...getPriorityColor("blue"),
                                    },
                                    '&:hover': {
                                      ...getPriorityColor("blue"),
                                      filter: 'brightness(0.98)'
                                    }
                                  }}>{t("blue")}</MenuItem>
                                  <MenuItem value="yellow" sx={{
                                    ...getPriorityColor("yellow"),
                                    '&.Mui-selected': {
                                      ...getPriorityColor("yellow"),
                                    },
                                    '&.Mui-selected:hover': {
                                      ...getPriorityColor("yellow"),
                                    },
                                    '&:hover': {
                                      ...getPriorityColor("yellow"),
                                      filter: 'brightness(0.98)'
                                    }
                                  }}>{t("yellow")}</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            {/* 攻优突破分开关（行内） */}
                            <TableCell sx={{ textAlign: 'center', padding: '4px' }}>
                              <Checkbox
                                size="small"
                                checked={Array.isArray(charData.showStats) && charData.showStats.includes('AtkElemLbScore')}
                                onChange={(e) => {
                                  const flag = e.target.checked;
                                  const newShow = Array.isArray(charData.showStats) ? [...charData.showStats] : [];
                                  const has = newShow.includes('AtkElemLbScore');
                                  const updated = flag ? (has ? newShow : ['AtkElemLbScore', ...newShow]) : newShow.filter(k => k !== 'AtkElemLbScore');
                                  const newChar = { ...charData, showStats: updated };
                                  const newList = characters.elements[element].map((c, i) => i === index ? newChar : c);
                                  const newCharacters = { ...characters, elements: { ...characters.elements, [element]: newList } };
                                  setCharactersData(newCharacters);
                                  setCharacters(newCharacters);
                                }}
                              />
                            </TableCell>
                            {/* 装备词条复选框 */}
                            {equipStatKeys.map((key) => (
                              <TableCell key={key} sx={{ textAlign: 'center', padding: '4px' }}>
                                <Checkbox
                                  size="small"
                                  checked={charData.showStats.includes(key)}
                                  onChange={(e) => {
                                    const newStats = e.target.checked
                                      ? [...charData.showStats, key]
                                      : charData.showStats.filter(stat => stat !== key);
                                    updateCharacterShowStats(element, index, newStats);
                                  }}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Container>
      
      {/* Character Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={handleCloseFilterDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle>{t("characterFilter")}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            {/* 搜索框 */}
            <TextField
              size="small"
              label={t("characterName")}
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("searchPlaceholder")}
              fullWidth
            />

            {/* 筛选条件：按顺序显示 — 代码、阶段、职业、企业、武器（5 等分） */}
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: 'repeat(5, 1fr)'
              }}
            >
              <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
                <InputLabel>{t("element")}</InputLabel>
                <Select
                  value={filters.element}
                  onChange={(e) => setFilters(prev => ({ ...prev, element: e.target.value }))}
                  label={t("element")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">{t("all")}</MenuItem>
                  <MenuItem value="Iron">{t("iron")}</MenuItem>
                  <MenuItem value="Fire">{t("fire")}</MenuItem>
                  <MenuItem value="Water">{t("water")}</MenuItem>
                  <MenuItem value="Wind">{t("wind")}</MenuItem>
                  <MenuItem value="Electronic">{t("electronic")}</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
                <InputLabel>{t("burstSkill")}</InputLabel>
                <Select
                  value={filters.use_burst_skill}
                  onChange={(e) => setFilters(prev => ({ ...prev, use_burst_skill: e.target.value }))}
                  label={t("burstSkill")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">{t("all")}</MenuItem>
                  <MenuItem value="Step1">{t("burstStage1")}</MenuItem>
                  <MenuItem value="Step2">{t("burstStage2")}</MenuItem>
                  <MenuItem value="Step3">{t("burstStage3")}</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
                <InputLabel>{t("class")}</InputLabel>
                <Select
                  value={filters.class}
                  onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
                  label={t("class")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">{t("all")}</MenuItem>
                  <MenuItem value="Attacker">{t("attacker")}</MenuItem>
                  <MenuItem value="Defender">{t("defender")}</MenuItem>
                  <MenuItem value="Supporter">{t("supporter")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
                <InputLabel>{t("corporation")}</InputLabel>
                <Select
                  value={filters.corporation}
                  onChange={(e) => setFilters(prev => ({ ...prev, corporation: e.target.value }))}
                  label={t("corporation")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">{t("all")}</MenuItem>
                  <MenuItem value="ELYSION">{t("elysion")}</MenuItem>
                  <MenuItem value="MISSILIS">{t("missilis")}</MenuItem>
                  <MenuItem value="TETRA">{t("tetra")}</MenuItem>
                  <MenuItem value="PILGRIM">{t("pilgrim")}</MenuItem>
                  <MenuItem value="ABNORMAL">{t("abnormal")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
                <InputLabel>{t("weaponType")}</InputLabel>
                <Select
                  value={filters.weapon_type}
                  onChange={(e) => setFilters(prev => ({ ...prev, weapon_type: e.target.value }))}
                  label={t("weaponType")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">{t("all")}</MenuItem>
                  <MenuItem value="AR">AR</MenuItem>
                  <MenuItem value="SMG">SMG</MenuItem>
                  <MenuItem value="SG">SG</MenuItem>
                  <MenuItem value="SR">SR</MenuItem>
                  <MenuItem value="MG">MG</MenuItem>
                  <MenuItem value="RL">RL</MenuItem>
                </Select>
              </FormControl>
              
            </Box>
            
            <Typography variant="subtitle2">{t("filterResults")} ({filteredNikkes.length})</Typography>
            
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>              
              {filteredNikkes.length > 0 ? (
                <List dense>
                  {filteredNikkes.map((nikke) => {
                    const isSelected = selectedNikkes.some((item) => item.id === nikke.id);
                    const alreadyAdded = effectiveExistingElementIds.has(nikke.id);
                    const displayName = getDisplayName(nikke);
                    const avatarUrl = getNikkeAvatarUrl(nikke);
                    return (
                      <ListItem
                        key={nikke.id}
                        alignItems="stretch"
                        sx={{ py: 0.5 }}
                        secondaryAction={
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSelectNikke(nikke)}
                            color={(isSelected || alreadyAdded) ? 'success' : 'primary'}
                            disabled={alreadyAdded}
                            sx={{ minWidth: 84 }}
                          >
                            {(isSelected || alreadyAdded) ? t("selectedTag") : t("choose")}
                          </Button>
                        }
                      >
                        <ListItemAvatar sx={{ minWidth: 68, width: 68, alignSelf: 'stretch', display: 'flex', alignItems: 'stretch' }}>
                          {avatarUrl ? (
                            <Box
                              component="img"
                              src={avatarUrl}
                              alt={displayName}
                              loading="lazy"
                              sx={{
                                height: '100%',
                                maxHeight: 56,
                                aspectRatio: '1 / 1',
                                borderRadius: '8px',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: '100%',
                                maxHeight: 56,
                                aspectRatio: '1 / 1',
                                borderRadius: '8px',
                                backgroundColor: 'action.disabledBackground'
                              }}
                              title={displayName}
                            />
                          )}
                        </ListItemAvatar>
                        <ListItemText
                          primary={displayName}
                          secondary={`${getElementName(nikke.element)} | ${getBurstStageName(nikke.use_burst_skill)} | ${getClassName(nikke.class)} | ${getCorporationName(nikke.corporation)} | ${nikke.weapon_type}`}
                          primaryTypographyProps={{ noWrap: true, variant: 'body1' }}
                          secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                          sx={{ my: 0 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Typography color="textSecondary">{t("notFound")}</Typography>
              )}
            </Box>

            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {selectionLabel}
              </Typography>
              {totalSelectionCount === 0 ? (
                <Typography color="textSecondary">{t("selectedEmpty")}</Typography>
              ) : (
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                  {effectiveExistingElementCharacters.map((nikke) => {
                    const name = getDisplayName(nikke);
                    const avatarUrl = getNikkeAvatarUrl(nikke);
                    return (
                      <Box
                        key={`existing-${nikke.id}`}
                        sx={{
                          position: 'relative',
                          width: 56,
                          height: 56,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: 'action.disabledBackground'
                        }}
                        title={name}
                      >
                        {avatarUrl ? (
                          <Box
                            component="img"
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}

                        <IconButton
                          size="small"
                          aria-label={t("remove") || 'remove'}
                          onClick={() => handleRemoveExistingNikke(nikke.id)}
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            p: 0,
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': {
                              backgroundColor: 'background.paper'
                            }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    );
                  })}

                  {selectedNikkes.map((nikke) => {
                    const name = getDisplayName(nikke);
                    const avatarUrl = getNikkeAvatarUrl(nikke);
                    return (
                      <Box
                        key={`pending-${nikke.id}`}
                        sx={{
                          position: 'relative',
                          width: 56,
                          height: 56,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: 'action.disabledBackground'
                        }}
                        title={name}
                      >
                        {avatarUrl ? (
                          <Box
                            component="img"
                            src={avatarUrl}
                            alt={name}
                            loading="lazy"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}

                        <IconButton
                          size="small"
                          aria-label={t("remove") || 'remove'}
                          onClick={() => handleRemoveSelectedNikke(nikke.id)}
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 18,
                            height: 18,
                            p: 0,
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': {
                              backgroundColor: 'background.paper'
                            }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
          <Button
            variant="outlined"
            onClick={handleCloseFilterDialog}
            sx={{ minWidth: 96, px: 2, py: 0.75, borderRadius: '8px' }}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmSelection}
            disabled={pendingSelectionCount === 0 && removedExistingIds.length === 0}
            sx={{ minWidth: 120, px: 2.5, py: 0.75, borderRadius: '8px' }}
          >
            {t("confirmSelection")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ManagementPage;
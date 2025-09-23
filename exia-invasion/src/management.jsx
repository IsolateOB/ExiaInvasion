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
  ListItem,
  ListItemText,
  Snackbar,
  Alert,
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
import TRANSLATIONS from "./translations.js";
import { fetchAndCacheNikkeDirectory, getCachedNikkeDirectory } from "./api.js";
import { v4 as uuidv4 } from "uuid";
import { getCharacters, setCharacters } from "./storage.js";

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
    weapon_type: "",
    original_rare: ""
  });
  const [filteredNikkes, setFilteredNikkes] = useState([]);
  // 拖拽状态（角色列表）：区分源分组与当前悬停分组，统一跨组视觉
  const [charDragging, setCharDragging] = useState({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // 全选/全不选状态
  const isAllEnabled = useMemo(() => accounts.every(acc => acc.enabled !== false), [accounts]);
  
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
  const elementMapping = {
    "Electronic": "电击",
    "Fire": "燃烧", 
    "Wind": "风压",
    "Water": "水冷",
    "Iron": "铁甲",
    "Utility": "辅助"
  };
  
  const classMapping = {
    "Attacker": "火力型",
    "Defender": "防御型",
    "Supporter": "支援型"
  };
  
const corporationMapping = {
    "ELYSION": "极乐净土",
    "MISSILIS": "米西利斯",
    "TETRA": "泰特拉",
    "PILGRIM": "朝圣者",
    "ABNORMAL": "反常"
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
    return lang === "zh" ? (elementMapping[element] || element) : element;
  };
  
  const getClassName = (className) => {
    return lang === "zh" ? (classMapping[className] || className) : className;
  };
  
  const getCorporationName = (corporation) => {
    return lang === "zh" ? (corporationMapping[corporation] || corporation) : corporation;
  };  const openFilterDialog = (element) => {
    setSelectedElement(element);
    // Auto-set element filter if not Utility
    const initialFilters = {
      name: "",
      class: "",
      element: element !== "Utility" ? element : "",
      use_burst_skill: "",
      corporation: "",
      weapon_type: "",
      original_rare: ""
    };
    setFilters(initialFilters);
    
    // Apply initial filters immediately
    let filtered = nikkeList;
    if (element !== "Utility") {
      filtered = filtered.filter(nikke => nikke.element === element);
    }
    setFilteredNikkes(filtered);
    
    setFilterDialogOpen(true);
  };  const applyFilters = useCallback(() => {
    let filtered = nikkeList;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === "name") {
          // Search in both Chinese and English names
          const searchTerm = value.toLowerCase();
          filtered = filtered.filter(nikke => 
            (nikke.name_cn && nikke.name_cn.toLowerCase().includes(searchTerm)) ||
            (nikke.name_en && nikke.name_en.toLowerCase().includes(searchTerm))
          );        } else if (key === "use_burst_skill") {
          // Handle burst skill mapping: "1" -> "Step1", "2" -> "Step2", "3" -> "Step3"
          const burstMapping = {
            "1": "Step1",
            "2": "Step2", 
            "3": "Step3"
          };
          const mappedValue = burstMapping[value] || value;
          // "AllStep" 角色应该能被所有 Step 筛选条件匹配到
          filtered = filtered.filter(nikke => 
            nikke[key] === mappedValue || nikke[key] === "AllStep"
          );
        } else {
          filtered = filtered.filter(nikke => nikke[key] === value);
        }
      }
    });
    
    setFilteredNikkes(filtered);
  }, [nikkeList, filters]);const addCharacterToElement = (nikke) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [selectedElement]: [
          ...characters.elements[selectedElement],
          {
            name_code: nikke.name_code,
            id: nikke.id,
            name_cn: nikke.name_cn,
            name_en: nikke.name_en,
            priority: "yellow",
            // 默认包含 'AtkElemLbScore'
            showStats: ["AtkElemLbScore", ...equipStatKeys]
          }
        ]
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
    setFilterDialogOpen(false);
  };  const updateCharacterPriority = (element, characterIndex, priority) => {
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
      
      <Container sx={{ mt: 4, pb: 8 }}>
        <Tabs value={tab} onChange={(e, newTab) => setTab(newTab)} sx={{ mb: 3 }}>
          <Tab label={t("accountTable")} />
          <Tab label={t("characterManagement")} />
        </Tabs>
          {tab === 0 && (
          <>
            {/* 账户管理标题和操作按钮 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t("accountTable")}
              </Typography>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t("characterManagement")}
              </Typography>
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
              </Box>
            </Box>
              {["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].map((element) => {
              const elementChars = characters.elements[element] || [];
              return (
                <Box key={element} sx={{ mb: 3, border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {getElementName(element)} ({elementChars.length})
                  </Typography>
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
                          {/* 攻优突破分开关列标题 */}
                          <TableCell width="8%" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                            {t("atkElemLbScore")}
                          </TableCell>
                          {/* 装备词条列标题 */}
                          {equipStatKeys.map((key, idx) => (
                            <TableCell key={key} width="6%" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                              {equipStatLabels[idx]}
                            </TableCell>
                          ))}
                          <TableCell width="6%" align="right"></TableCell>
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
                                {lang === "zh" ? charData.name_cn : charData.name_en}
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
                            <TableCell align="right">
                              <IconButton
                                color="error"
                                onClick={() => deleteCharacter(element, index)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}                        <TableRow>
                          <TableCell colSpan={4 + equipStatKeys.length + 1} sx={{ pt: 2, borderBottom: 'none' }}>
                            <Box display="flex" justifyContent="center">
                              <IconButton color="primary" onClick={() => openFilterDialog(element)}>
                                <AddIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
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
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t("characterFilter")}</DialogTitle>
        <DialogContent>          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            {/* Name search input */}            <TextField
              size="small"
              label={t("characterName")}
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("searchPlaceholder")}
              fullWidth
            />            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Attacker">{t("attacker")}</MenuItem>
                  <MenuItem value="Defender">{t("defender")}</MenuItem>
                  <MenuItem value="Supporter">{t("supporter")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Iron">{t("iron")}</MenuItem>
                  <MenuItem value="Fire">{t("fire")}</MenuItem>
                  <MenuItem value="Water">{t("water")}</MenuItem>
                  <MenuItem value="Wind">{t("wind")}</MenuItem>
                  <MenuItem value="Electronic">{t("electronic")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="1">1</MenuItem>
                  <MenuItem value="2">2</MenuItem>
                  <MenuItem value="3">3</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ELYSION">{t("elysion")}</MenuItem>
                  <MenuItem value="MISSILIS">{t("missilis")}</MenuItem>
                  <MenuItem value="TETRA">{t("tetra")}</MenuItem>
                  <MenuItem value="PILGRIM">{t("pilgrim")}</MenuItem>
                  <MenuItem value="ABNORMAL">{t("abnormal")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="AR">AR</MenuItem>
                  <MenuItem value="SMG">SMG</MenuItem>
                  <MenuItem value="SG">SG</MenuItem>
                  <MenuItem value="SR">SR</MenuItem>
                  <MenuItem value="MG">MG</MenuItem>
                  <MenuItem value="RL">RL</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("rarity")}</InputLabel>
                <Select
                  value={filters.original_rare}
                  onChange={(e) => setFilters(prev => ({ ...prev, original_rare: e.target.value }))}
                  label={t("rarity")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="SSR">SSR</MenuItem>
                  <MenuItem value="SR">SR</MenuItem>
                  <MenuItem value="R">R</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Typography variant="subtitle2">{t("filterResults")} ({filteredNikkes.length})</Typography>
            
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>              
              {filteredNikkes.length > 0 ? (
                <List>
                  {filteredNikkes.map((nikke) => (
                    <ListItem 
                      key={nikke.id}
                      secondaryAction={
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => addCharacterToElement(nikke)}
                        >
                          {t("confirmAdd")}
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={lang === "zh" ? nikke.name_cn : nikke.name_en}
                        secondary={`${getClassName(nikke.class)} | ${getElementName(nikke.element)} | ${getCorporationName(nikke.corporation)} | ${nikke.weapon_type} | ${nikke.original_rare}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary">{t("noResults")}</Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialogOpen(false)}>{t("cancel")}</Button>
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
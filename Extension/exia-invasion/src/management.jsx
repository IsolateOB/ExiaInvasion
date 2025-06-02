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
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TRANSLATIONS from "./translations.js";
import { v4 as uuidv4 } from "uuid";
import { getCharacters, setCharacters } from "./storage.js";

const defaultRow = () => ({
  id: uuidv4(),
  username: "",
  email: "",
  password: "",
  cookie: "",
  enabled: true
});

const ManagementPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState([]);
  const [showPwds, setShowPwds] = useState([]);  const [draggedItemIndex, setDraggedItemIndex] = useState(null); // Added for drag and drop

  // Character management states
  const [tab, setTab] = useState(0); // 0 for accounts, 1 for characters
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
  const [selectedElement, setSelectedElement] = useState("");  const [filters, setFilters] = useState({
    name: "",
    class: "",
    element: "",
    use_burst_skill: "",
    corporation: "",
    weapon_type: "",
    original_rare: ""
  });
  const [filteredNikkes, setFilteredNikkes] = useState([]);
  
  // Character drag and drop states
  const [draggedCharacterIndex, setDraggedCharacterIndex] = useState(null);
  const [draggedCharacterElement, setDraggedCharacterElement] = useState(null);
  
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
    return () => chrome.storage.onChanged.removeListener(handler);}, []);
    /* ---------- 初始化角色数据 ---------- */
  useEffect(() => {
    // Load characters data with migration logic
    getCharacters().then(data => {
      // Check if we need to migrate from old object format to new array format
      const migratedData = { ...data };
      let needsMigration = false;
      
      // Check each element and convert object to array if needed
      ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].forEach(element => {
        if (migratedData.elements[element] && !Array.isArray(migratedData.elements[element])) {
          // Convert object to array
          const objectData = migratedData.elements[element];
          migratedData.elements[element] = Object.values(objectData);
          needsMigration = true;
        } else if (!migratedData.elements[element]) {
          // Ensure all elements exist as arrays
          migratedData.elements[element] = [];
          needsMigration = true;
        }
      });
      
      // Save migrated data if needed
      if (needsMigration) {
        setCharacters(migratedData);
      }
      
      setCharactersData(migratedData);
    });
    
    // Load nikke list
    fetch(chrome.runtime.getURL("list.json"))
      .then(response => response.json())
      .then(data => setNikkeList(data.nikkes || []))
      .catch(err => console.error("Failed to load nikke list:", err));
  }, []);
  
  /* ---------- 初始化账号数据 ---------- */
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
  
  /* ---------- 账号管理工具函数 ---------- */
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
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
    const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
    persist(reorderedAccounts);
    
    setDraggedItemIndex(null);  };  /* ---------- 角色管理工具函数 ---------- */
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
  };
  const applyFilters = useCallback(() => {
    let filtered = nikkeList;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === "name") {
          // Search in both Chinese and English names
          const searchTerm = value.toLowerCase();
          filtered = filtered.filter(nikke => 
            (nikke.name_cn && nikke.name_cn.toLowerCase().includes(searchTerm)) ||
            (nikke.name_en && nikke.name_en.toLowerCase().includes(searchTerm))
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
            priority: "yellow"
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
    switch (priority) {
      case "black": return { backgroundColor: "#000", color: "#fff" };
      case "blue": return { backgroundColor: "#2196f3", color: "#fff" };
      case "yellow": return { backgroundColor: "#ffeb3b", color: "#000" };
      default: return { backgroundColor: "#e0e0e0", color: "#000" };
    }
  };

  /* ---------- Character Drag and Drop Handlers ---------- */
  const handleCharacterDragStart = (e, element, index) => {
    setDraggedCharacterIndex(index);
    setDraggedCharacterElement(element);
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
  const handleCharacterDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCharacterDrop = (targetElement, targetIndex) => {
    if (draggedCharacterIndex === null || draggedCharacterElement === null) {
      return;
    }

    // If dropping in the same element at the same position, do nothing
    if (draggedCharacterElement === targetElement && draggedCharacterIndex === targetIndex) {
      setDraggedCharacterIndex(null);
      setDraggedCharacterElement(null);
      return;
    }

    const newCharacters = { ...characters };
    
    // Remove character from source element
    const [draggedCharacter] = newCharacters.elements[draggedCharacterElement].splice(draggedCharacterIndex, 1);
    
    // Add character to target element
    newCharacters.elements[targetElement].splice(targetIndex, 0, draggedCharacter);
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
    
    setDraggedCharacterIndex(null);
    setDraggedCharacterElement(null);
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
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("accountTable")}
            </Typography>
            
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
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}                      sx={{
                        "& > *": { verticalAlign: "top" },
                        cursor: !isEdit ? "grab" : "default",
                        opacity: draggedItemIndex === idx ? 0.7 : 1,
                        transform: draggedItemIndex === idx ? 'translateY(-4px)' : 'translateY(0)',
                        transition: 'all 0.2s ease',
                        backgroundColor: draggedItemIndex !== null && draggedItemIndex !== idx && !isEdit ? 'action.hover' : 'inherit',
                        '&:hover': {
                          backgroundColor: !isEdit && draggedItemIndex === null ? 'action.hover' : 'inherit',
                          transform: !isEdit && draggedItemIndex === null ? 'translateY(-2px)' : 'translateY(0)',
                          boxShadow: !isEdit && draggedItemIndex === null ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        },
                        '&:active': {
                          cursor: !isEdit ? 'grabbing' : 'default',
                          transform: !isEdit ? 'translateY(-4px)' : 'translateY(0)',
                        }
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
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("characterManagement")}
            </Typography>
            
            {["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].map((element) => {
              const elementChars = characters.elements[element] || [];
              return (
                <Accordion key={element} sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>{getElementName(element)} ({elementChars.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {/* Character Table */}
                      <Table size="small">                        <TableHead>
                          <TableRow>                            <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                              {/* Drag handle header */}
                            </TableCell>
                            <TableCell width="5%">{t("no")}</TableCell>
                            <TableCell width="52%">{t("characterName")}</TableCell>
                            <TableCell width="30%">{t("priority")}</TableCell>
                            <TableCell width="10%" align="right"></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {elementChars.map((charData, index) => (
                            <TableRow
                              key={`${charData.id}-${index}`}
                              draggable
                              onDragStart={(e) => handleCharacterDragStart(e, element, index)}
                              onDragOver={handleCharacterDragOver}
                              onDrop={() => handleCharacterDrop(element, index)}                              sx={{
                                "& > *": { verticalAlign: "top" },
                                cursor: "grab",
                                opacity: draggedCharacterIndex === index && draggedCharacterElement === element ? 0.7 : 1,
                                transform: draggedCharacterIndex === index && draggedCharacterElement === element ? 'translateY(-4px)' : 'translateY(0)',
                                transition: 'all 0.2s ease',
                                backgroundColor: draggedCharacterIndex !== null && (draggedCharacterIndex !== index || draggedCharacterElement !== element) ? 'action.hover' : 'inherit',
                                '&:hover': {
                                  backgroundColor: draggedCharacterIndex === null ? 'action.hover' : 'inherit',
                                  transform: draggedCharacterIndex === null ? 'translateY(-2px)' : 'translateY(0)',
                                  boxShadow: draggedCharacterIndex === null ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                },
                                '&:active': {
                                  cursor: 'grabbing',
                                  transform: 'translateY(-4px)',
                                }
                              }}
                            >                              <TableCell sx={{ textAlign: 'center', cursor: 'grab', paddingLeft: '2px', paddingRight: '2px' }}>
                                <DragIndicatorIcon fontSize="small" />
                              </TableCell>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {lang === "zh" ? charData.name_cn : charData.name_en}
                                </Typography>
                              </TableCell>                              <TableCell>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                  <Select
                                    value={charData.priority}
                                    onChange={(e) => updateCharacterPriority(element, index, e.target.value)}
                                    sx={getPriorityColor(charData.priority)}
                                  >
                                    <MenuItem value="black" sx={getPriorityColor("black")}>{t("black")}</MenuItem>
                                    <MenuItem value="blue" sx={getPriorityColor("blue")}>{t("blue")}</MenuItem>
                                    <MenuItem value="yellow" sx={getPriorityColor("yellow")}>{t("yellow")}</MenuItem>
                                  </Select>
                                </FormControl>                              </TableCell>
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
                          ))}
                            <TableRow>
                            <TableCell colSpan={5} sx={{ pt: 2, borderBottom: 'none' }}>
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
                  </AccordionDetails>
                </Accordion>
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
            />
            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("class")}</InputLabel>
                <Select
                  value={filters.class}
                  onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
                  label={t("class")}
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
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Iron">{t("iron")}</MenuItem>
                  <MenuItem value="Fire">{t("fire")}</MenuItem>
                  <MenuItem value="Water">{t("water")}</MenuItem>
                  <MenuItem value="Wind">{t("wind")}</MenuItem>
                  <MenuItem value="Electronic">{t("electronic")}</MenuItem>
                </Select>
              </FormControl>                <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("burstSkill")}</InputLabel>
                <Select
                  value={filters.use_burst_skill}
                  onChange={(e) => setFilters(prev => ({ ...prev, use_burst_skill: e.target.value }))}
                  label={t("burstSkill")}
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
                  {filteredNikkes.map((nikke) => (                    <ListItem key={nikke.id}>
                      <ListItemText
                        primary={lang === "zh" ? nikke.name_cn : nikke.name_en}
                        secondary={`${getClassName(nikke.class)} | ${getElementName(nikke.element)} | ${getCorporationName(nikke.corporation)} | ${nikke.weapon_type} | ${nikke.original_rare}`}
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => addCharacterToElement(nikke)}
                        >
                          {t("confirmAdd")}
                        </Button>
                      </ListItemSecondaryAction>
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
    </>
  );
};

export default ManagementPage;
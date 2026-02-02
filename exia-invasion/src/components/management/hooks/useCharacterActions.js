// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 角色管理操作 Hook ==========

import { useState, useCallback, useMemo } from "react";
import { setCharacters as persistCharacters } from "../../../services/storage.js";
import { SHOW_STATS_CONFIG_MARKER, basicStatKeys, equipStatKeys } from "../constants.js";
import { downloadFile, selectFile } from "../utils.js";

/**
 * 角色管理操作 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {Object} options.characters - 角色数据
 * @param {Function} options.setCharactersData - 设置角色数据
 * @param {Array} options.nikkeList - 妮姬列表
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useCharacterActions({
  t,
  characters,
  setCharactersData,
  nikkeList,
  showMessage,
}) {
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
  const [selectedNikkes, setSelectedNikkes] = useState([]);
  const [removedExistingIds, setRemovedExistingIds] = useState([]);
  const [charDragging, setCharDragging] = useState({ 
    sourceElement: null, 
    currentElement: null, 
    draggingIndex: null, 
    overIndex: null 
  });

  // 计算派生状态
  const existingElementCharacters = useMemo(() => {
    if (!selectedElement) return [];
    return characters.elements[selectedElement] || [];
  }, [selectedElement, characters]);

  const effectiveExistingElementCharacters = useMemo(() => {
    if (!removedExistingIds.length) return existingElementCharacters;
    const removedSet = new Set(removedExistingIds);
    return existingElementCharacters.filter((char) => !removedSet.has(char.id));
  }, [existingElementCharacters, removedExistingIds]);

  const effectiveExistingElementIds = useMemo(() => 
    new Set(effectiveExistingElementCharacters.map((char) => char.id)), 
    [effectiveExistingElementCharacters]
  );

  // 使用 useMemo 直接计算过滤结果，避免不必要的状态更新导致重新渲染
  const filteredNikkes = useMemo(() => {
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

    return filtered;
  }, [nikkeList, filters]);

  // 打开筛选对话框
  const openFilterDialog = useCallback((element) => {
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
    setSelectedNikkes([]);
    setRemovedExistingIds([]);
    setFilterDialogOpen(true);
  }, []);

  // 关闭筛选对话框
  const handleCloseFilterDialog = useCallback(() => {
    setFilterDialogOpen(false);
    setSelectedNikkes([]);
    setRemovedExistingIds([]);
  }, []);

  // 选择妮姬
  const handleSelectNikke = useCallback((nikke) => {
    if (removedExistingIds.includes(nikke.id)) {
      setRemovedExistingIds((prev) => prev.filter((id) => id !== nikke.id));
      return;
    }
    setSelectedNikkes((prev) => {
      if (prev.some((item) => item.id === nikke.id)) return prev;
      return [...prev, nikke];
    });
  }, [removedExistingIds]);

  // 移除已选择的妮姬
  const handleRemoveSelectedNikke = useCallback((nikkeId) => {
    setSelectedNikkes((prev) => prev.filter((item) => item.id !== nikkeId));
  }, []);

  // 移除现有妮姬
  const handleRemoveExistingNikke = useCallback((nikkeId) => {
    setRemovedExistingIds((prev) => (prev.includes(nikkeId) ? prev : [...prev, nikkeId]));
    setSelectedNikkes((prev) => prev.filter((item) => item.id !== nikkeId));
  }, []);

  // 确认选择
  const handleConfirmSelection = useCallback(() => {
    if (!selectedElement) {
      handleCloseFilterDialog();
      return;
    }

    const existingList = characters.elements[selectedElement] || [];
    const removedSet = new Set(removedExistingIds);
    const keptList = removedExistingIds.length ? existingList.filter((c) => !removedSet.has(c.id)) : existingList;

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
        showStats: [SHOW_STATS_CONFIG_MARKER, ...basicStatKeys, "AtkElemLbScore", ...equipStatKeys]
      }));

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
    persistCharacters(nextCharacters);
    handleCloseFilterDialog();
  }, [selectedElement, characters, removedExistingIds, selectedNikkes, setCharactersData, handleCloseFilterDialog]);

  // 更新角色优先级
  const updateCharacterPriority = useCallback((element, characterIndex, priority) => {
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
    persistCharacters(newCharacters);
  }, [characters, setCharactersData]);

  // 更新角色显示统计
  const updateCharacterShowStats = useCallback((element, characterIndex, stats) => {
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
    persistCharacters(newCharacters);
  }, [characters, setCharactersData]);

  // 清空所有妮姬列表
  const handleClearAllCharacters = useCallback(() => {
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
    persistCharacters(emptyCharacters);
  }, [t, setCharactersData]);

  // 拖拽处理
  const onCharDragStart = useCallback((e, element, index) => {
    setCharDragging({ sourceElement: element, currentElement: element, draggingIndex: index, overIndex: index });
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, []);

  const onCharDragOver = useCallback((e, element, index) => {
    e.preventDefault();
    setCharDragging((s) => {
      if (s.draggingIndex === null) return s;
      if (s.currentElement !== element || s.overIndex !== index) {
        return { ...s, currentElement: element, overIndex: index };
      }
      return s;
    });
  }, []);

  const onCharDrop = useCallback((element, index) => {
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
    persistCharacters(draft);
    setCharDragging({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null });
  }, [charDragging, characters, setCharactersData]);

  const onCharDragEnd = useCallback(() => 
    setCharDragging({ sourceElement: null, currentElement: null, draggingIndex: null, overIndex: null }), []);

  // 导出角色 JSON
  const handleExportCharacters = useCallback(() => {
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
  }, [characters, t, showMessage]);

  // 导入角色 JSON
  const handleImportCharacters = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData && importedData.elements && typeof importedData.elements === 'object') {
          setCharactersData(importedData);
          persistCharacters(importedData);
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
  }, [setCharactersData, t, showMessage]);

  const triggerCharacterImport = useCallback(() => {
    selectFile('.json', handleImportCharacters);
  }, [handleImportCharacters]);

  // 计算选择数量
  const pendingSelectionCount = selectedNikkes.length;
  const totalSelectionCount = pendingSelectionCount + effectiveExistingElementCharacters.length;

  return {
    // 状态
    filterDialogOpen,
    selectedElement,
    filters,
    setFilters,
    filteredNikkes,
    selectedNikkes,
    removedExistingIds,
    charDragging,

    // 派生状态
    effectiveExistingElementCharacters,
    effectiveExistingElementIds,
    pendingSelectionCount,
    totalSelectionCount,

    // 筛选对话框操作
    openFilterDialog,
    handleCloseFilterDialog,
    handleSelectNikke,
    handleRemoveSelectedNikke,
    handleRemoveExistingNikke,
    handleConfirmSelection,

    // 角色操作
    updateCharacterPriority,
    updateCharacterShowStats,
    handleClearAllCharacters,

    // 拖拽
    onCharDragStart,
    onCharDragOver,
    onCharDrop,
    onCharDragEnd,

    // 导入导出
    handleExportCharacters,
    triggerCharacterImport,
  };
}

export default useCharacterActions;

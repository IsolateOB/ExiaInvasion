// SPDX-License-Identifier: GPL-3.0-or-later
import { memo, forwardRef } from "react";
import {
  Box,
  Typography,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  Tooltip,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton, TextField } from "@mui/material";
import { TableVirtuoso } from "react-virtuoso";
import InteractiveSelector from "../common/InteractiveSelector";


const VirtuosoScroller = forwardRef((props, ref) => (
  <TableContainer
    {...props}
    ref={ref}
    sx={{
      height: "100%",
      overflowX: "auto",
      overflowY: "auto",
      scrollbarGutter: "stable both-edges",
      boxSizing: "border-box",
    }}
  />
));
VirtuosoScroller.displayName = "VirtuosoScroller";

const VirtuosoTableRow = forwardRef((props, ref) => {
  const { context, ...rest } = props;
  const rowIndex = Number(rest["data-index"]);
  const isBodyRow = Number.isFinite(rowIndex);
  const {
    element,
    charDragging,
    onCharDragStart,
    onCharDragOver,
    onCharDrop,
    onCharDragEnd,
  } = context || {};
  const rowSx = isBodyRow
    ? {
        "& > *": { verticalAlign: "top" },
        cursor: "grab",
        backgroundColor:
          charDragging?.currentElement === element &&
          charDragging?.overIndex === rowIndex
            ? "action.hover"
            : "inherit",
      }
    : rest.sx;
  return (
    <TableRow
      ref={ref}
      {...rest}
      draggable={isBodyRow}
      onDragStart={(e) => isBodyRow && onCharDragStart?.(e, element, rowIndex)}
      onDragOver={(e) => isBodyRow && onCharDragOver?.(e, element, rowIndex)}
      onDrop={() => isBodyRow && onCharDrop?.(element, rowIndex)}
      onDragEnd={onCharDragEnd}
      sx={rowSx}
    />
  );
});
VirtuosoTableRow.displayName = "VirtuosoTableRow";

const VirtuosoTable = forwardRef((props, ref) => {
  const { context, ...rest } = props;
  const tableMinWidth = context?.tableMinWidth || "auto";
  return <Table {...rest} ref={ref} size="small" sx={{ tableLayout: "fixed", minWidth: tableMinWidth }} />;
});
VirtuosoTable.displayName = "VirtuosoTable";

const virtuosoComponents = {
  Scroller: VirtuosoScroller,
  Table: VirtuosoTable,
  TableHead,
  TableBody,
  TableRow: VirtuosoTableRow,
};

const CharacterTabContent = ({
  t,
  lang,
  templates,
  defaultTemplateId,
  selectedTemplateId,
  handleTemplateChange,
  isRenaming,
  renameId,
  renameValue,
  setRenameValue,
  confirmRename,
  setIsRenaming,
  setRenameId,
  startRenameTemplate,
  handleDuplicateTemplate,
  handleDeleteTemplate,
  handleCreateTemplate,
  triggerCharacterImport,
  handleExportCharacters,
  handleClearAllCharacters,
  characters,
  getElementName,
  openFilterDialog,
  equipStatKeys,
  equipStatLabels,
  toggleHeaderCellSx,
  toggleCellSx,
  getNikkeAvatarUrl,
  getDisplayName,
  updateCharacterPriority,
  getPriorityColor,
  updateCharacterShowStats,
  basicStatKeys,
  showStatsConfigMarker,
  nikkeNameMinWidthPx,
  nikkePriorityWidthPx,
  nikkeDragHandleWidthPx,
  nikkeToggleMinWidthPx,
  charDragging,
  onCharDragStart,
  onCharDragOver,
  onCharDrop,
  onCharDragEnd,
  syncLabel,
  isSyncing,
}) => {
  const toggleMinWidth =
    typeof nikkeToggleMinWidthPx === "number" ? nikkeToggleMinWidthPx : 56;
  const tableMinWidth =
    (typeof nikkeDragHandleWidthPx === "number" ? nikkeDragHandleWidthPx : 0) +
    (typeof nikkeNameMinWidthPx === "number" ? nikkeNameMinWidthPx : 0) +
    (typeof nikkePriorityWidthPx === "number" ? nikkePriorityWidthPx : 0) +
    toggleMinWidth *
      (1 + (basicStatKeys?.length || 0) + (equipStatKeys?.length || 0));

  const scrollbarReservePx = 16;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 2,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          <Typography variant="h6">{t("characterManagement")}</Typography>
          {isSyncing ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {t("sync.inProgress") || "同步中"}
              </Typography>
            </Box>
          ) : syncLabel ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {syncLabel}
            </Typography>
          ) : null}
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <InteractiveSelector
            width={240}
            minWidth={200}
            menuMinWidth={240}
            value={(() => {
              const item = templates.find((tp) => tp.id === (selectedTemplateId || ""));
              const display = item?.name || "";
              return (
                <Typography noWrap title={display} sx={{ maxWidth: "100%" }}>
                  {display}
                </Typography>
              );
            })()}
          >
            {({ close }) =>
              templates.map((tpl) => {
                const isSelected = tpl.id === selectedTemplateId;
                const isRenamingCurrentTemplate = isRenaming && renameId === tpl.id;

                return (
                  <Box
                    key={tpl.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={isRenamingCurrentTemplate ? undefined : () => {
                      handleTemplateChange(tpl.id);
                      close();
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      cursor: isRenamingCurrentTemplate ? "default" : "pointer",
                      bgcolor: isSelected ? "action.selected" : "transparent",
                      "&:hover": isRenamingCurrentTemplate ? undefined : {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    {isRenamingCurrentTemplate ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          width: "100%",
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <TextField
                          size="small"
                          placeholder={t("templateInputName")}
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.stopPropagation();
                              confirmRename();
                              close();
                            }
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setIsRenaming(false);
                              setRenameId("");
                              setRenameValue("");
                            }
                          }}
                          autoFocus
                          sx={{ flex: 1, minWidth: 0 }}
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t("confirm")}
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmRename();
                            close();
                          }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={t("cancel")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsRenaming(false);
                            setRenameId("");
                            setRenameValue("");
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap title={tpl.name}>
                            {tpl.name}
                          </Typography>
                        </Box>
                        <Tooltip title={t("templateRename")}>
                          <IconButton
                            size="small"
                            aria-label={t("templateRename")}
                            onClick={(event) => {
                              event.stopPropagation();
                              startRenameTemplate(tpl.id);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("copy") || "澶嶅埗"}>
                          <IconButton
                            size="small"
                            aria-label={t("copy") || "澶嶅埗"}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDuplicateTemplate(tpl.id);
                              close();
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            tpl.id === defaultTemplateId
                              ? t("templateDefaultLocked") || "榛樿濡К鍒楄〃涓嶅彲鍒犻櫎"
                              : t("templateDelete")
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={t("templateDelete")}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteTemplate(tpl.id);
                                close();
                              }}
                              disabled={tpl.id === defaultTemplateId}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                );
              })
            }
          </InteractiveSelector>

          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleCreateTemplate}
            disabled={templates.length >= 200}
          >
            {t("templateCreate") || "鏂板缓"}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={triggerCharacterImport}
            sx={{ minWidth: 80 }}
          >
            {t("importNikkes")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileUploadIcon />}
            onClick={handleExportCharacters}
            sx={{ minWidth: 80 }}
          >
            {t("exportNikkes")}
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
      </Box>

      {["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].map(
        (element) => {
          const elementChars = characters.elements[element] || [];
          const tableHeight = Math.max(
            180,
            elementChars.length * 56 + 56 + scrollbarReservePx,
          );
          const tableContext = { element, charDragging, onCharDragStart, onCharDragOver, onCharDrop, onCharDragEnd, tableMinWidth };
          return (
            <Box
              key={element}
              sx={{ mb: 3, border: "1px solid #e0e0e0", borderRadius: 1, p: 2 }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                  gap: 1,
                }}
              >
                <Typography variant="h6" sx={{ minWidth: 0 }}>
                  {getElementName(element)} ({elementChars.length})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => openFilterDialog(element)}
                  sx={{ flex: "0 0 auto" }}
                >
                  {t("addOrEdit")}
                </Button>
              </Box>
              <Box display="flex" flexDirection="column" gap={1}>
                <TableVirtuoso
                  data={elementChars}
                  context={tableContext}
                  components={virtuosoComponents}
                  itemKey={(index, item) => `${item.id}-${index}`}
                  style={{ height: tableHeight }}
                  fixedHeaderContent={() => (
                    <TableRow>
                      <TableCell
                        sx={{
                          width: `${nikkeDragHandleWidthPx}px`,
                          textAlign: "center",
                          paddingLeft: "2px",
                          paddingRight: "2px",
                        }}
                      >
                        {/* Drag handle header */}
                      </TableCell>
                      <TableCell
                        sx={{
                          width: `${nikkeNameMinWidthPx}px`,
                          minWidth: `${nikkeNameMinWidthPx}px`,
                        }}
                      >
                        {t("characterName")}
                      </TableCell>
                      <TableCell
                        sx={{
                          width: `${nikkePriorityWidthPx}px`,
                          minWidth: `${nikkePriorityWidthPx}px`,
                        }}
                      >
                        {t("priority")}
                      </TableCell>
                      <TableCell sx={toggleHeaderCellSx}>
                        <Tooltip
                          arrow
                          placement="top"
                          title={
                            lang === "zh" ? (
                              <Box component="span">
                                鏀讳紭绐佺牬鍒?AEL)
                                <br />
                                AEL = (1 + 0.9 脳 鏀诲嚮璇嶆潯) 脳 (1 + 10% +
                                浼樿秺璇嶆潯) 脳 (1 + 3% 脳 鏋侀檺绐佺牬 + 2% 脳 鏍稿績寮哄寲)
                              </Box>
                            ) : (
                              <Box component="span">
                                Attack Element Limit Break Score (AEL)
                                <br />
                                AEL = (1 + 0.9 脳 ATK%) 脳 (1 + 10% + Elem%) 脳 (1
                                + 3% 脳 Limit Break + 2% 脳 Core Refinement)
                              </Box>
                            )
                          }
                        >
                          <Box component="span">{t("atkElemLbScore")}</Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={toggleHeaderCellSx}>
                        {t("limitBreak")}
                      </TableCell>
                      <TableCell sx={toggleHeaderCellSx}>
                        {t("skill1")}
                      </TableCell>
                      <TableCell sx={toggleHeaderCellSx}>
                        {t("skill2")}
                      </TableCell>
                      <TableCell sx={toggleHeaderCellSx}>
                        {t("burst")}
                      </TableCell>
                      {equipStatKeys.map((key, idx) => (
                        <TableCell key={key} sx={toggleHeaderCellSx}>
                          {equipStatLabels[idx]}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                  itemContent={(index, charData) => (
                    <>
                      <TableCell
                        sx={{
                          textAlign: "center",
                          cursor: "grab",
                          paddingLeft: "2px",
                          paddingRight: "2px",
                        }}
                      >
                        <DragIndicatorIcon fontSize="small" />
                      </TableCell>
                      <TableCell
                        sx={{
                          width: `${nikkeNameMinWidthPx}px`,
                          minWidth: `${nikkeNameMinWidthPx}px`,
                          overflow: "hidden",
                        }}
                      >
                        <Typography variant="body2" noWrap>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {getNikkeAvatarUrl(charData) ? (
                              <Box
                                component="img"
                                src={getNikkeAvatarUrl(charData)}
                                alt={getDisplayName(charData)}
                                loading="lazy"
                                width={44}
                                height={44}
                                sx={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 2,
                                  objectFit: "cover",
                                  flex: "0 0 auto",
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                            <Box
                              component="span"
                              sx={{
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lang === "zh"
                                ? charData.name_cn
                                : charData.name_en}
                            </Box>
                          </Box>
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          width: `${nikkePriorityWidthPx}px`,
                          minWidth: `${nikkePriorityWidthPx}px`,
                        }}
                      >
                        <FormControl
                          size="small"
                          sx={{ minWidth: 100, width: "100%" }}
                        >
                          <Select
                            value={charData.priority}
                            onChange={(e) =>
                              updateCharacterPriority(
                                element,
                                index,
                                e.target.value,
                              )
                            }
                            inputProps={{ "aria-label": t("priority") }}
                            sx={{
                              ...getPriorityColor(charData.priority),
                              "& .MuiSelect-select": {
                                ...getPriorityColor(charData.priority),
                              },
                            }}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 200,
                                  width: "auto",
                                },
                              },
                              anchorOrigin: {
                                vertical: "bottom",
                                horizontal: "left",
                              },
                              transformOrigin: {
                                vertical: "top",
                                horizontal: "left",
                              },
                            }}
                          >
                            <MenuItem
                              value="black"
                              sx={{
                                ...getPriorityColor("black"),
                                "&.Mui-selected": {
                                  ...getPriorityColor("black"),
                                },
                                "&.Mui-selected:hover": {
                                  ...getPriorityColor("black"),
                                },
                                "&:hover": {
                                  ...getPriorityColor("black"),
                                  filter: "brightness(0.95)",
                                },
                              }}
                            >
                              {t("black")}
                            </MenuItem>
                            <MenuItem
                              value="blue"
                              sx={{
                                ...getPriorityColor("blue"),
                                "&.Mui-selected": {
                                  ...getPriorityColor("blue"),
                                },
                                "&.Mui-selected:hover": {
                                  ...getPriorityColor("blue"),
                                },
                                "&:hover": {
                                  ...getPriorityColor("blue"),
                                  filter: "brightness(0.98)",
                                },
                              }}
                            >
                              {t("blue")}
                            </MenuItem>
                            <MenuItem
                              value="yellow"
                              sx={{
                                ...getPriorityColor("yellow"),
                                "&.Mui-selected": {
                                  ...getPriorityColor("yellow"),
                                },
                                "&.Mui-selected:hover": {
                                  ...getPriorityColor("yellow"),
                                },
                                "&:hover": {
                                  ...getPriorityColor("yellow"),
                                  filter: "brightness(0.98)",
                                },
                              }}
                            >
                              {t("yellow")}
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>

                      <TableCell sx={toggleCellSx}>
                        <Checkbox
                          size="small"
                          checked={
                            Array.isArray(charData.showStats) &&
                            charData.showStats.includes("AtkElemLbScore")
                          }
                          inputProps={{ "aria-label": t("atkElemLbScore") }}
                          onChange={(e) => {
                            const flag = e.target.checked;
                            const base = Array.isArray(charData.showStats)
                              ? [...charData.showStats]
                              : [];
                            const has = base.includes("AtkElemLbScore");
                            let updated = flag
                              ? has
                                ? base
                                : ["AtkElemLbScore", ...base]
                              : base.filter((k) => k !== "AtkElemLbScore");
                            if (!updated.includes(showStatsConfigMarker)) {
                              updated = [showStatsConfigMarker, ...updated];
                            }
                            updateCharacterShowStats(element, index, updated);
                          }}
                        />
                      </TableCell>

                      {(() => {
                        const showStats = Array.isArray(charData.showStats)
                          ? charData.showStats
                          : [];
                        const configured = showStats.includes(
                          showStatsConfigMarker,
                        );
                        const legacyBasics = !configured;
                        const toggle = (key, checked) => {
                          const base = legacyBasics
                            ? [...showStats, ...basicStatKeys]
                            : showStats;
                          let nextStats = checked
                            ? base.includes(key)
                              ? base
                              : [...base, key]
                            : base.filter((k) => k !== key);
                          if (!nextStats.includes(showStatsConfigMarker)) {
                            nextStats = [showStatsConfigMarker, ...nextStats];
                          }
                          updateCharacterShowStats(element, index, nextStats);
                        };
                        return (
                          <>
                            <TableCell sx={toggleCellSx}>
                              <Checkbox
                                size="small"
                                checked={
                                  legacyBasics ||
                                  showStats.includes("limit_break")
                                }
                                onChange={(e) =>
                                  toggle("limit_break", e.target.checked)
                                }
                                inputProps={{ "aria-label": t("limitBreak") }}
                              />
                            </TableCell>
                            <TableCell sx={toggleCellSx}>
                              <Checkbox
                                size="small"
                                checked={
                                  legacyBasics ||
                                  showStats.includes("skill1_level")
                                }
                                onChange={(e) =>
                                  toggle("skill1_level", e.target.checked)
                                }
                                inputProps={{ "aria-label": t("skill1") }}
                              />
                            </TableCell>
                            <TableCell sx={toggleCellSx}>
                              <Checkbox
                                size="small"
                                checked={
                                  legacyBasics ||
                                  showStats.includes("skill2_level")
                                }
                                onChange={(e) =>
                                  toggle("skill2_level", e.target.checked)
                                }
                                inputProps={{ "aria-label": t("skill2") }}
                              />
                            </TableCell>
                            <TableCell sx={toggleCellSx}>
                              <Checkbox
                                size="small"
                                checked={
                                  legacyBasics ||
                                  showStats.includes("skill_burst_level")
                                }
                                onChange={(e) =>
                                  toggle("skill_burst_level", e.target.checked)
                                }
                                inputProps={{ "aria-label": t("burst") }}
                              />
                            </TableCell>
                          </>
                        );
                      })()}
                      {equipStatKeys.map((key) => (
                        <TableCell key={key} sx={toggleCellSx}>
                          <Checkbox
                            size="small"
                            checked={
                              Array.isArray(charData.showStats) &&
                              charData.showStats.includes(key)
                            }
                            inputProps={{
                              "aria-label":
                                equipStatLabels[equipStatKeys.indexOf(key)] ||
                                key,
                            }}
                            onChange={(e) => {
                              const base = Array.isArray(charData.showStats)
                                ? charData.showStats
                                : [];
                              let newStats = e.target.checked
                                ? base.includes(key)
                                  ? base
                                  : [...base, key]
                                : base.filter((stat) => stat !== key);
                              if (!newStats.includes(showStatsConfigMarker)) {
                                newStats = [showStatsConfigMarker, ...newStats];
                              }
                              updateCharacterShowStats(
                                element,
                                index,
                                newStats,
                              );
                            }}
                          />
                        </TableCell>
                      ))}
                    </>
                  )}
                />
              </Box>
            </Box>
          );
        },
      )}
    </>
  );
};

export default memo(CharacterTabContent);


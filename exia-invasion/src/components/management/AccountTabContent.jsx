// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  Switch,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

const AccountTabContent = ({
  t,
  accountTemplates,
  defaultAccountTemplateId,
  selectedAccountTemplateId,
  handleAccountTemplateChange,
  isAccountRenaming,
  accountRenameId,
  accountRenameValue,
  setAccountRenameValue,
  confirmAccountRename,
  setIsAccountRenaming,
  setAccountRenameId,
  startRenameAccountTemplate,
  handleDuplicateAccountTemplate,
  handleDeleteAccountTemplate,
  handleCreateAccountTemplate,
  isAllEnabled,
  handleToggleAllEnabled,
  handleImportAccounts,
  handleExportAccounts,
  handleClearAllAccounts,
  accounts,
  editing,
  showPwds,
  accDragging,
  onAccountDragStart,
  onAccountDragOver,
  onAccountDrop,
  onAccountDragEnd,
  updateField,
  handleToggleAccountEnabled,
  setShowPwds,
  saveRow,
  startEdit,
  deleteRow,
  addRow,
  renderText,
  syncLabel,
  isSyncing,
  syncAccountEmail,
  syncAccountPassword,
  toggleSyncAccountEmail,
  toggleSyncAccountPassword,
  getCookieStatus,
}) => (
  <>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography variant="h6">{t("accountTable")}</Typography>
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

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Select
          size="small"
          value={selectedAccountTemplateId || ""}
          onChange={(e) => handleAccountTemplateChange(e.target.value)}
          sx={{ minWidth: 200, width: 240 }}
          renderValue={(val) => {
            const id = String(val || "");
            const item = accountTemplates.find((tp) => tp.id === id);
            const name = item?.name || "";
            const display = name;
            return (
              <Typography noWrap title={display} sx={{ maxWidth: "100%" }}>
                {display}
              </Typography>
            );
          }}
          MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
        >
          {accountTemplates.map((tpl) => (
            <MenuItem key={tpl.id} value={tpl.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isAccountRenaming && accountRenameId === tpl.id ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                  <TextField
                    size="small"
                    placeholder={t("accountTemplateInputName")}
                    value={accountRenameValue}
                    onChange={(e) => setAccountRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        confirmAccountRename();
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setIsAccountRenaming(false);
                        setAccountRenameId("");
                        setAccountRenameValue("");
                      }
                    }}
                    autoFocus
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <IconButton size="small" color="primary" aria-label={t("confirm")} onClick={(e) => { e.stopPropagation(); confirmAccountRename(); }}>
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" aria-label={t("cancel")} onClick={(e) => { e.stopPropagation(); setIsAccountRenaming(false); setAccountRenameId(""); setAccountRenameValue(""); }}>
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
                    <IconButton size="small" aria-label={t("templateRename")} onClick={(e) => { e.stopPropagation(); e.preventDefault(); startRenameAccountTemplate(tpl.id); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t("copy") || "复制"}>
                    <IconButton size="small" aria-label={t("copy") || "复制"} onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDuplicateAccountTemplate(tpl.id); }}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tpl.id === defaultAccountTemplateId ? (t("accountTemplateDefaultLocked") || "默认账号列表不可删除") : t("templateDelete")}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={t("templateDelete")}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteAccountTemplate(tpl.id); }}
                        disabled={tpl.id === defaultAccountTemplateId}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </MenuItem>
          ))}
        </Select>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleCreateAccountTemplate}
          disabled={accountTemplates.length >= 200}
        >
          {t("accountTemplateCreate") || "新建"}
        </Button>

        <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleImportAccounts} sx={{ minWidth: 80 }}>
          {t("importAccounts")}
        </Button>
        <Button size="small" variant="outlined" startIcon={<FileUploadIcon />} onClick={handleExportAccounts} sx={{ minWidth: 80 }}>
          {t("exportAccounts")}
        </Button>
        <Button variant="outlined" size="small" color="error" startIcon={<DeleteSweepIcon />} onClick={handleClearAllAccounts} sx={{ minWidth: 80 }}>
          {t("clearAllAccounts")}
        </Button>
      </Box>
    </Box>

    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell width="3%" sx={{ textAlign: "center", paddingLeft: "2px", paddingRight: "2px" }}>
            {/* Drag handle header */}
          </TableCell>
          <TableCell width="5%">{t("no")}</TableCell>
          <TableCell width="5%" sx={{ minWidth: 160 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("enabled")}</Typography>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{t("selectAll") || "全选"}</Typography>
              <Switch
                size="small"
                checked={Boolean(isAllEnabled)}
                onChange={handleToggleAllEnabled}
                inputProps={{ "aria-label": t("selectAll") || "全选" }}
              />
            </Box>
          </TableCell>
          <TableCell width="15%">{t("username")}</TableCell>
          <TableCell width="20%">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("email")}</Typography>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{t("sync.cloud") || "云同步"}</Typography>
              <Switch
                size="small"
                checked={Boolean(syncAccountEmail)}
                onChange={toggleSyncAccountEmail}
                inputProps={{ "aria-label": t("sync.cloud") || "云同步" }}
              />
            </Box>
          </TableCell>
          <TableCell width="15%" sx={{ minWidth: 180 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("password")}</Typography>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{t("sync.cloud") || "云同步"}</Typography>
              <Switch
                size="small"
                checked={Boolean(syncAccountPassword)}
                onChange={toggleSyncAccountPassword}
                inputProps={{ "aria-label": t("sync.cloud") || "云同步" }}
              />
            </Box>
          </TableCell>
          <TableCell width="20%">{t("cookie")}</TableCell>
          <TableCell align="right" width="10%"></TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {accounts.map((row, idx) => {
          const isEdit = editing[idx];
          return (
            <TableRow
              key={`${row.game_uid || "row"}-${idx}`}
              draggable={!isEdit}
              onDragStart={(e) => !isEdit && onAccountDragStart(e, idx)}
              onDragOver={(e) => !isEdit && onAccountDragOver(e, idx)}
              onDrop={() => !isEdit && onAccountDrop(idx)}
              onDragEnd={onAccountDragEnd}
              sx={{
                "& > *": { verticalAlign: "top" },
                cursor: !isEdit ? "grab" : "default",
                backgroundColor: accDragging.overIndex === idx && accDragging.draggingIndex !== null ? "action.hover" : "inherit",
              }}
            >
              <TableCell sx={{ textAlign: "center", cursor: !isEdit ? "grab" : "default", paddingLeft: "2px", paddingRight: "2px" }}>
                {!isEdit && <DragIndicatorIcon fontSize="small" />}
              </TableCell>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>
                <Switch
                  size="small"
                  checked={row.enabled !== false}
                  onChange={() => handleToggleAccountEnabled(idx)}
                  disabled={isEdit}
                  inputProps={{ "aria-label": t("enabled") }}
                />
              </TableCell>
              <TableCell>
                {isEdit ? (
                  <TextField
                    variant="standard"
                    value={row.username}
                    onChange={(e) => updateField(idx, "username", e.target.value)}
                    fullWidth
                    inputProps={{ "aria-label": t("username"), name: "username", autoComplete: "username" }}
                  />
                ) : (
                  renderText(row.username)
                )}
              </TableCell>
              <TableCell>
                {isEdit ? (
                  <TextField
                    variant="standard"
                    type="email"
                    value={row.email}
                    onChange={(e) => updateField(idx, "email", e.target.value)}
                    fullWidth
                    inputProps={{ "aria-label": t("email"), name: "email", autoComplete: "email" }}
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
                    inputProps={{ "aria-label": t("password"), name: "password", autoComplete: "current-password" }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              aria-label={showPwds[idx] ? t("hidePassword") : t("showPassword")}
                              onClick={() => setShowPwds((v) => v.map((f, i) => (i === idx ? !f : f)))}
                              edge="end"
                            >
                              {showPwds[idx] ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                        sx: {
                          '& input[type="password"]::-ms-reveal': {
                            display: "none",
                          },
                          '& input[type="password"]::-ms-clear': {
                            display: "none",
                          },
                          '& input[type="password"]::-webkit-credentials-auto-fill-button': {
                            display: "none !important",
                          },
                          '& input[type="password"]::-webkit-contacts-auto-fill-button': {
                            display: "none !important",
                          },
                        },
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
                    inputProps={{ "aria-label": t("cookie"), name: "cookie", autoComplete: "off" }}
                  />
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                    {row.cookie ? t("saved") : "—"}
                    {(() => {
                      const status = getCookieStatus ? getCookieStatus(row) : null;
                      if (!status) return null;
                      return (
                        <Typography variant="caption" sx={{ color: status.color }}>
                          {status.label}
                        </Typography>
                      );
                    })()}
                  </Box>
                )}
              </TableCell>
              <TableCell align="right">
                <Box display="flex" flexDirection="row" justifyContent="flex-end">
                  {isEdit ? (
                    <IconButton color="primary" aria-label={t("save")} onClick={() => saveRow(idx)} size="small">
                      <SaveIcon />
                    </IconButton>
                  ) : (
                    <IconButton onClick={() => startEdit(idx)} size="small" aria-label={t("edit")}>
                      <EditIcon />
                    </IconButton>
                  )}
                  <IconButton
                    color="error"
                    aria-label={t("delete")}
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
          <TableCell colSpan={8} sx={{ pt: 2, borderBottom: "none" }}>
            <Box display="flex" justifyContent="center">
              <IconButton color="primary" aria-label={t("add")} onClick={addRow}>
                <AddIcon />
              </IconButton>
            </Box>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </>
);

export default memo(AccountTabContent);

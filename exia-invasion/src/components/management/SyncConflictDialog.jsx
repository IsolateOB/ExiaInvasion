// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 同步冲突对话框组件 ==========

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";

/**
 * 同步冲突对话框
 * 当本地数据与云端数据不一致时显示，让用户选择处理方式
 */
const SyncConflictDialog = ({
  t,
  open,
  hasAccounts,
  hasCharacters,
  onUseLocal,
  onUseCloud,
  onLogout,
}) => {
  return (
    <Dialog open={open} onClose={onLogout} maxWidth="sm" fullWidth>
      <DialogTitle>{t("sync.conflictTitle") || "检测到云端冲突"}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("sync.conflictDesc") || "本地数据与云端数据不一致，请选择处理方式。"}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {hasAccounts ? (
            <Typography variant="body2">• {t("accountTable")}</Typography>
          ) : null}
          {hasCharacters ? (
            <Typography variant="body2">• {t("characterManagement") || "妮姬"}</Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onLogout} color="inherit">
          {t("sync.logout") || "退出登录"}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={onUseCloud}>
          {t("sync.useCloud") || "云覆盖本地"}
        </Button>
        <Button variant="contained" onClick={onUseLocal}>
          {t("sync.useLocal") || "本地上传到云"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SyncConflictDialog;

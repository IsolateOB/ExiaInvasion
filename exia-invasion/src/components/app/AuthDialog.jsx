// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 认证对话框组件 ==========

import { memo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
} from "@mui/material";

const AuthDialog = ({
  t,
  open,
  onClose,
  authTitle,
  authMode,
  authForm,
  setAuthForm,
  authSubmitting,
  onSubmit,
  openLoginDialog,
  openRegisterDialog,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{authTitle}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3, overflow: "visible" }}>
        <TextField
          label={t("auth.username") || "用户名"}
          value={authForm.username}
          onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
          fullWidth
          autoFocus
        />
        <TextField
          label={t("auth.password") || "密码"}
          type="password"
          value={authForm.password}
          onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {authMode === "login" ? (
          <Button onClick={openRegisterDialog} disabled={authSubmitting}>
            {t("auth.switchToRegister") || "去注册"}
          </Button>
        ) : (
          <Button onClick={openLoginDialog} disabled={authSubmitting}>
            {t("auth.switchToLogin") || "去登录"}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={authSubmitting}>
          {t("auth.cancel") || "取消"}
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={authSubmitting}>
          {authSubmitting ? (
            <CircularProgress size={18} color="inherit" />
          ) : authMode === "login" ? (
            t("auth.submitLogin") || "登录"
          ) : (
            t("auth.submitRegister") || "注册"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(AuthDialog);

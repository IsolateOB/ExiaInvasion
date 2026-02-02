// SPDX-License-Identifier: GPL-3.0-or-later
// ========== App Header 组件 ==========

import { memo, useMemo } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  SvgIcon,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { AVATAR_URL } from "./constants.js";

const DiscordIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.045-.32 13.579.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.062.077.077 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.223 13.223 0 0 1-1.872-.9.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.29a.074.074 0 0 1 .077-.01c3.927 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.196.372.29a.077.077 0 0 1-.006.128 12.354 12.354 0 0 1-1.873.9.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.88 19.88 0 0 0 6.002-3.062.077.077 0 0 0 .032-.056c.5-5.177-.838-9.673-3.548-13.661a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.184 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
  </SvgIcon>
);

const AppHeader = ({
  t,
  authUsername,
  authAvatarUrl,
  authAnchorEl,
  menuOpen,
  handleAvatarClick,
  handleMenuClose,
  handleLogoutClick,
  openLoginDialog,
}) => {
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);

  return (
    <AppBar position="sticky">
      <Toolbar variant="dense">
        <img
          src={iconUrl}
          alt="logo"
          width={32}
          height={32}
          style={{ width: 32, height: 32, marginRight: 8 }}
        />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          ExiaInvasion
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {authUsername ? (
            <>
              <Avatar
                src={authAvatarUrl || AVATAR_URL}
                alt={authUsername}
                onClick={handleAvatarClick}
                sx={{
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  border: "2px solid rgba(255, 255, 255, 0.8)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.3)",
                  },
                }}
              />
              <Menu
                anchorEl={authAnchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                slotProps={{
                  paper: {
                    elevation: 3,
                    sx: {
                      mt: 1,
                      minWidth: 180,
                      borderRadius: 2,
                      overflow: "visible",
                      "&::before": {
                        content: '""',
                        display: "block",
                        position: "absolute",
                        top: 0,
                        right: 14,
                        width: 10,
                        height: 10,
                        bgcolor: "background.paper",
                        transform: "translateY(-50%) rotate(45deg)",
                        zIndex: 0,
                      },
                    },
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t("auth.greeting") || "出刀吧！"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {authUsername}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem
                  onClick={() => {
                    window.open("https://exia.nikke.cc/setting", "_blank");
                  }}
                  sx={{ py: 1.5 }}
                >
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  {t("user.settings") || "用户设置"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    window.open("https://discord.gg/fRW7PbYZAB", "_blank");
                  }}
                  sx={{ py: 1.5 }}
                >
                  <ListItemIcon>
                    <DiscordIcon fontSize="small" />
                  </ListItemIcon>
                  {t("user.feedback") || "交流/反馈"}
                </MenuItem>
                <MenuItem onClick={handleLogoutClick} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  {t("auth.logout") || "退出"}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="outlined" color="inherit" onClick={openLoginDialog}>
              {t("auth.login") || "登录"}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default memo(AppHeader);

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
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { AVATAR_URL } from "./constants.js";

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

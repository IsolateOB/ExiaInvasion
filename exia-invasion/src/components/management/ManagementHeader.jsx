// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import { AppBar, Toolbar, Typography, Box, Switch } from "@mui/material";

const ManagementHeader = ({ iconUrl, lang, onToggleLang }) => (
  <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
    <Toolbar>
      <img
        src={iconUrl}
        alt="logo"
        width={32}
        height={32}
        style={{ width: 32, height: 32, marginRight: 8 }}
      />
      <Typography variant="h6" sx={{ flexGrow: 1 }}>ExiaInvasion</Typography>
      <Box display="flex" alignItems="center" sx={{ color: "white" }}>
        <Typography variant="caption">中文</Typography>
        <Switch
          size="small"
          color="default"
          checked={lang === "en"}
          onChange={onToggleLang}
          inputProps={{ "aria-label": "Language" }}
        />
        <Typography variant="caption">EN</Typography>
      </Box>
    </Toolbar>
  </AppBar>
);

export default memo(ManagementHeader);

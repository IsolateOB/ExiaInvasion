// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";

const ManagementHeader = ({ iconUrl }) => (
  <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
    <Toolbar>
      <img
        src={iconUrl}
        alt="logo"
        width={32}
        height={32}
        style={{ width: 32, height: 32, marginRight: 8 }}
      />
      <Typography variant="h6">ExiaInvasion</Typography>
    </Toolbar>
  </AppBar>
);

export default memo(ManagementHeader);

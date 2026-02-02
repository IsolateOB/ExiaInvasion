// SPDX-License-Identifier: GPL-3.0-or-later
// ========== App 常量定义 ==========

export const API_BASE_URL = "https://exia-backend.tigertan1998.workers.dev";
export const AVATAR_URL = "https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp";

// 并发控制参数
export const BATCH_SIZE = 5;        // 每批次最大并发数
export const STAGGER_DELAY = 1000;  // 批次内请求间隔（毫秒）

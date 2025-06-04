// ========== ESLint 配置文件 ==========
// ExiaInvasion 项目的代码检查规则配置

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] }, // 忽略构建输出目录
  {
    files: ['**/*.{js,jsx}'], // 适用于所有 JS/JSX 文件
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser, // 浏览器全局变量
        chrome: 'readonly', // Chrome 扩展 API
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true }, // 启用 JSX 支持
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }], // 允许大写开头的未使用变量
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }, // 允许常量导出
      ],
    },
  },
]

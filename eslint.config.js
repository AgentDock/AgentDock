import globals from "globals";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import path from "path";
import { fileURLToPath } from "url";

// Mimic CommonJS variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the ESLint configuration
export default [
    // Global ignores
    {
        ignores: [
            "node_modules/",
            ".next/",
            "dist/",
            "build/",
            "coverage/",
            "**/*.config.js",
            "**/*.config.ts",
        ],
    },

    // Base recommended configurations
    js.configs.recommended,
    
    // Apply recommended TypeScript rules
    {
        plugins: { '@typescript-eslint': tsPlugin },
        rules: tsPlugin.configs.recommended.rules,
    },

    // Configuration for TypeScript/JavaScript files (including Next.js/React)
    {
        files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react': reactPlugin,
            'react-hooks': reactHooksPlugin,
            '@next/next': nextPlugin,
            'import': importPlugin,
        },
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                project: './tsconfig.json',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                React: "readonly",
                NodeJS: "readonly",
            },
        },
        settings: {
            react: {
                version: "detect",
            },
            'import/resolver': {
                typescript: {}
            },
        },
        rules: {
            // Framework-specific recommended rules
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,

            // TypeScript specific rules
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // General rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'warn',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-unreachable': 'off', // Handled by TypeScript

            // React rules
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/display-name': 'off',
            'react/no-unescaped-entities': 'warn',

            // Import rules
            'import/no-anonymous-default-export': 'warn',
            'import/no-duplicates': 'error',
        },
    },

    // Configuration specifically for Test files
    {
        files: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.jest,
            }
        },
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
        }
    }
]; 
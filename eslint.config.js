import globals from "globals";
import js from "@eslint/js";
// import tseslint from "typescript-eslint"; // Use the combined package - REVERTED
import tsParser from "@typescript-eslint/parser"; // Use separate parser
import tsPlugin from "@typescript-eslint/eslint-plugin"; // Use separate plugin
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next"; // Import next plugin
import importPlugin from "eslint-plugin-import";
// import { FlatCompat } from "@eslint/eslintrc"; // No longer needed for Next.js
import path from "path";
import { fileURLToPath } from "url";

// mimic CommonJS variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compatibility helper for eslintrc configs - Keep if needed for other legacy configs
// const compat = new FlatCompat({
//     baseDirectory: __dirname,
//     recommendedConfig: js.configs.recommended,
// });

// Define the config array directly
export default [
    // Global ignores
    {
        ignores: [
            "node_modules/",
            ".next/",
            "dist/",
            "build/",
            "coverage/",
            "**/*.config.js", // Adjusted for glob
            "**/*.config.ts", // Adjusted for glob
            // Add other global ignores if needed, e.g., "**/.*" for dotfiles if necessary
        ],
    },

    // Base recommended configurations
    js.configs.recommended,
    // Apply recommended TS rules directly
    {
        plugins: { '@typescript-eslint': tsPlugin },
        rules: tsPlugin.configs.recommended.rules,
    },

    // Remove: Next.js core web vitals config (using FlatCompat)
    // ...compat.extends("next/core-web-vitals"),

    // Configuration for TypeScript/JavaScript files (including Next.js/React)
    {
        files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"], // Apply broadly
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react': reactPlugin,
            'react-hooks': reactHooksPlugin,
            '@next/next': nextPlugin, // Add next plugin here
            'import': importPlugin,
        },
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true, // Enable JSX
                },
                project: './tsconfig.json',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                React: "readonly", // Add React global explicitly if needed
                NodeJS: "readonly", // Add NodeJS global for things like NodeJS.Timeout
            },
        },
        settings: {
             react: {
                version: "detect",
            },
             'import/resolver': {
                 typescript: {}
             },
             // 'next' settings might not be needed when rules are included directly
        },
        rules: {
            // === Base Recommended Rules ===
            ...reactPlugin.configs.recommended.rules, // Include recommended react rules
            ...reactHooksPlugin.configs.recommended.rules, // Keep recommended hooks rules
            ...nextPlugin.configs.recommended.rules, // Include recommended Next.js rules
            ...nextPlugin.configs['core-web-vitals'].rules, // Include core-web-vitals rules

            // === Your Specific Rule Overrides ===

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
            'no-unreachable': 'off', // Disable ESLint rule, handled by TS

            // React rules (overrides for included recommended)
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off', // Still needed
            'react/display-name': 'off',
            'react/no-unescaped-entities': 'warn', // Downgrade from error if needed

            // React hooks rules (already included via plugin recommended config)
            // 'react-hooks/rules-of-hooks': 'error',
            // 'react-hooks/exhaustive-deps': 'warn',

            // Next.js rules (can override specific rules from recommended/core-web-vitals)
            // Example: '@next/next/no-img-element': 'warn', // if you want to downgrade

            // Import rules
            'import/no-anonymous-default-export': 'warn',
            'import/no-duplicates': 'error',

            // Add any other custom rules here
        },
    },

    // Configuration specifically for Test files
    {
        files: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.jest, // Add jest globals
            }
        },
        rules: {
            // Disable rules that are often problematic in tests, if necessary
            '@typescript-eslint/no-non-null-assertion': 'off',
        }
    }
]; 
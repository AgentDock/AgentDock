module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'next/core-web-vitals',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',  // Disable no-explicit-any warning
    '@typescript-eslint/ban-ts-comment': 'off', // Added to allow @ts-ignore and other TS comments
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    'no-var': 'off', // Changed from 'error' to 'off' to allow var usage in global declarations
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    
    // React rules (from Next.js config)
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/display-name': 'off',
    
    // Import rules
    'import/no-anonymous-default-export': 'warn',
    'import/no-duplicates': 'error',
  },
  settings: {
    next: {
      rootDir: ['./'],
    },
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
    '*.config.ts',
  ],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
}

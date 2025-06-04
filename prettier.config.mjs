/** @typedef  {import("prettier").Config} PrettierConfig */

/** @type { PrettierConfig } */
const config = {
  endOfLine: 'auto',
  semi: true,
  useTabs: false,
  singleQuote: true,
  jsxSingleQuote: false,
  tabWidth: 2,
  trailingComma: 'none',
  bracketSpacing: true,
  arrowParens: 'always',
  singleAttributePerLine: true,
  importOrder: [
    '^(react/(.*)$)|^(react$)',
    '^(next/(.*)$)|^(next$)',
    '<THIRD_PARTY_MODULES>',
    '^types$',
    '',
    '^agentdock-core/(.*)$',
    '',
    '^@/(.*)$',
    '^~/(.*)$',
    '^#(.*)$',
    '^[./]'
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  plugins: [
    'prettier-plugin-tailwindcss',
    '@ianvs/prettier-plugin-sort-imports'
  ]
};

export default config;

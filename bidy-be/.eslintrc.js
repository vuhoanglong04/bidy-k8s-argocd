module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    // Code quality rules
    'no-console': 'off', // Allow console in backend
    'no-unused-vars': ['warn', {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
    }],
    'no-var': 'error',
    'prefer-const': 'warn',
    'no-trailing-spaces': 'warn',
    'no-multiple-empty-lines': ['warn', { max: 2 }],
    'comma-dangle': ['warn', 'always-multiline'],
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { allowTemplateLiterals: true }],

    // Async/await best practices
    'no-async-promise-executor': 'error',
    'require-await': 'warn',

    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    '*.test.js',
    'scripts/',
  ],
};
module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['android/', 'coverage/', 'node_modules/', 'src/domain/data/oui.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'react-native/no-inline-styles': 'off',
  },
  overrides: [
    {
      files: ['*.js'],
      env: { node: true },
    },
  ],
};

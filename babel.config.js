module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Zod 4 ships `export * as ns from '…'`, which the React Native preset does
    // not transform; without this plugin the release JS bundle fails to build.
    '@babel/plugin-transform-export-namespace-from',
  ],
};

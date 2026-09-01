module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react-native/setup-env$': '<rootDir>/dummy-setup.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@nozbe|react-native-uuid|@react-native-async-storage)/)',
  ],
};

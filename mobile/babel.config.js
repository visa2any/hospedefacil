module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/services': './src/services',
          '@/store': './src/store',
          '@/utils': './src/utils',
          '@/types': './src/types',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
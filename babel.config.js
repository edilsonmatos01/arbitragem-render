module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '18.17.0'
        },
        modules: 'commonjs',
        useBuiltIns: 'usage',
        corejs: 3
      }
    ],
    [
      '@babel/preset-typescript',
      {
        onlyRemoveTypeImports: true
      }
    ]
  ],
  plugins: [
    ['@babel/plugin-transform-runtime', {
      corejs: 3,
      helpers: true,
      regenerator: true
    }]
  ]
} 
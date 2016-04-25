var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: ['./src/tredux'],
  output: {
    path: path.normalize(__dirname + '/lib'),
    library: "tredux",
    filename: "tredux.js"
  },
  plugins: [
    new webpack.optimize.OccurenceOrderPlugin()
  ],

  module: {
    noParse: ['react'],
    loaders: [
      {
        test: /(\.jsx?$)/,
        exclude: /(node_modules)/,
        loaders: ['babel-loader']
      }
    ]
  },
  resolve: {
    root: [
      path.normalize(__dirname + '/src')
    ],
    extensions: ['', '.js', '.jsx']
  },
  externals: {
    'react': 'react',
    'React': 'react'
  }
};
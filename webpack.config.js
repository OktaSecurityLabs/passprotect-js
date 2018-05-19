const path = require("path");
const ShellPlugin = require("webpack-shell-plugin");


module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "passprotect.min.js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader"
        ]
      }
    ]
  },
  mode: "production",
  plugins: [
    new ShellPlugin({
      onBuildEnd: [ "mkdir umd", "cp ./dist/passprotect.min.js umd/" ]
    })
  ]
};

module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
  },
  'parserOptions': {
    'ecmaVersion': 12,
  },
  "extends": "eslint:recommended",
  'rules': {
    "indent": [
        "error",
        4
    ],
    "linebreak-style": [
        "error",
        "unix"
    ],
    "quotes": [
        "error",
        "double"
    ],
    "semi": [
        "error",
        "always"
    ],
    "no-console": "off",
    "no-unused-vars": "off"
  }
};

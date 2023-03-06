module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  ignorePatterns: ["*.test.js"],
  rules: {
    "quotes": ["error", "double"],
    "max-len": ["error", {"code": 200, "tabWidth": 4}],
    "require-jsdoc": 0,
    "new-cap": 0,
    "camelcase": 0,
    "no-undef": 0,
    "no-unused-vars": 0,
    "no-inner-declarations": 0,
  },
  parserOptions: {
    ecmaVersion: 8,
  },
};

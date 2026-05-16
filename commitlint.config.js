/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'perf', 'ci', 'build'],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'scope-empty': [0],
    'header-max-length': [2, 'always', 100],
  },
};

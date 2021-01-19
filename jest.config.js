module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['lib'],
  setupFilesAfterEnv: [`${process.cwd()}/jest.setup.js`],
};

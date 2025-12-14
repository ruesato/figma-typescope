import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Build Verification', () => {
  const buildDir = resolve(__dirname, '../../build');
  const mainFile = resolve(buildDir, 'main.js');

  it('should have build directory', () => {
    expect(existsSync(buildDir)).toBe(true);
  });

  it('should have compiled main.js file', () => {
    expect(existsSync(mainFile)).toBe(true);
  });

  it('main.js should not be empty', () => {
    if (existsSync(mainFile)) {
      const { statSync } = require('fs');
      const stats = statSync(mainFile);
      expect(stats.size).toBeGreaterThan(0);
    }
  });
});

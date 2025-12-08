import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Manifest Validation', () => {
  const manifestPath = join(__dirname, '../../manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  it('should have required fields', () => {
    expect(manifest).toHaveProperty('api');
    expect(manifest).toHaveProperty('editorType');
    expect(manifest).toHaveProperty('id');
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('main');
  });

  it('should have valid API version', () => {
    expect(manifest.api).toBe('1.0.0');
  });

  it('should target Figma editor', () => {
    expect(manifest.editorType).toContain('figma');
  });

  it('should have correct plugin ID', () => {
    expect(manifest.id).toBe('typescope');
  });

  it('should have correct plugin name', () => {
    expect(manifest.name).toBe('Typescope');
  });

  it('should point to correct main file', () => {
    expect(manifest.main).toBe('build/main.js');
  });

  it('should have required permissions', () => {
    expect(manifest.permissions).toContain('teamlibrary');
  });
});

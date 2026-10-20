import { describe, test, expect } from 'vitest';
import { manifest, registerType } from '../pwa.config';

describe('pwa.config', () => {
  test('declares LBike branding and auto-update registration', () => {
    expect(manifest.name).toBe('LBike');
    expect(manifest.theme_color).toBe('#1A1A1A');
    expect(manifest.background_color).toBe('#1A1A1A');
    expect(manifest.display).toBe('standalone');
    expect(registerType).toBe('autoUpdate');
  });
});

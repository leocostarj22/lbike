import { describe, test, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { manifest, registerType } from '../pwa.config';

describe('pwa.config', () => {
  test('declares LBike branding and auto-update registration', () => {
    expect(manifest.name).toBe('LBike');
    expect(manifest.theme_color).toBe('#1A1A1A');
    expect(manifest.background_color).toBe('#1A1A1A');
    expect(manifest.display).toBe('standalone');
    expect(registerType).toBe('autoUpdate');
  });

  test('every manifest icon file exists under public/', () => {
    for (const icon of manifest.icons) {
      const path = resolve(__dirname, '../../public', icon.src.replace(/^\//, ''));
      expect(existsSync(path)).toBe(true);
    }
  });

  test('manifest has a short name, description, and start url', () => {
    expect(manifest.short_name).toBe('LBike');
    expect(manifest.description).toBe('Regista e partilha as tuas pedaladas, corridas e caminhadas.');
    expect(manifest.start_url).toBe('/');
  });
});

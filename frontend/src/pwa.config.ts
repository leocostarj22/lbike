export const registerType = 'autoUpdate' as const;

export const manifest = {
  name: 'LBike',
  short_name: 'LBike',
  theme_color: '#1A1A1A',
  background_color: '#1A1A1A',
  display: 'standalone' as const,
  icons: [
    { src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' },
  ],
};

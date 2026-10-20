export const registerType = 'autoUpdate' as const;

export const manifest = {
  name: 'LBike',
  short_name: 'LBike',
  description: 'Regista e partilha as tuas pedaladas, corridas e caminhadas.',
  start_url: '/',
  theme_color: '#1A1A1A',
  background_color: '#1A1A1A',
  display: 'standalone' as const,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

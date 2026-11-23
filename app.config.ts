const config = {
  expo: {
    name: 'Lumbre',
    slug: 'lumbre',
    scheme: 'lumbre',
    platforms: ['android'],
    version: '1.0.0',
    orientation: 'portrait' as const,
    userInterfaceStyle: 'automatic' as const,
    icon: './assets/brand/lumbre-icon.png',
    plugins: [
      [
        'expo-sqlite',
        {
          enableFTS: true,
        },
      ],
    ],
    android: {
      package: 'app.lumbre.reader',
      icon: './assets/brand/lumbre-icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/brand/lumbre-adaptive-foreground.png',
        monochromeImage: './assets/brand/lumbre-monochrome.png',
        backgroundColor: '#315B4B',
      },
    },
  },
};

export default config;

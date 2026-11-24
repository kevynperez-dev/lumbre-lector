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
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 37,
            kotlinVersion: '2.3.20',
          },
        },
      ],
      './plugins/with-core-library-desugaring',
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

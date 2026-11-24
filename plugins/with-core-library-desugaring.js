const fs = require('node:fs/promises');
const path = require('node:path');
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');

const COMPILE_SDK_LINE = 'compileSdk rootProject.ext.compileSdkVersion';
const CORE_LIBRARY_DESUGARING =
  'coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:2.1.5"';

function withCoreLibraryDesugaring(config) {
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Lumbre expects the generated Android app Gradle file to use Groovy.');
    }

    let contents = config.modResults.contents;

    if (!/coreLibraryDesugaringEnabled\s+true/.test(contents)) {
      if (!contents.includes(COMPILE_SDK_LINE)) {
        throw new Error('Could not locate compileSdk in android/app/build.gradle.');
      }

      contents = contents.replace(
        COMPILE_SDK_LINE,
        `${COMPILE_SDK_LINE}\n\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n        coreLibraryDesugaringEnabled true\n    }`,
      );
    }

    if (!/coreLibraryDesugaring\s+[('"].*desugar_jdk_libs/.test(contents)) {
      if (!contents.includes('dependencies {')) {
        throw new Error('Could not locate dependencies in android/app/build.gradle.');
      }

      contents = contents.replace(
        'dependencies {',
        `dependencies {\n    ${CORE_LIBRARY_DESUGARING}`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const rulesPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      const reflectionRule =
        '-keep class com.reactnativereadium.reader.ReaderViewModel { *; }';
      let rules = '';

      try {
        rules = await fs.readFile(rulesPath, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      if (!rules.includes(reflectionRule)) {
        await fs.appendFile(rulesPath, `\n${reflectionRule}\n`);
      }

      return config;
    },
  ]);
}

module.exports = withCoreLibraryDesugaring;

import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
Config.setBrowserExecutable('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);

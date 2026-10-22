import {Config} from '@remotion/cli/config';

// The server's ESM imports use .js paths for TypeScript source files.
Config.overrideWebpackConfig(config => ({
  ...config,
  resolve: {
    ...config.resolve,
    extensionAlias: {...config.resolve?.extensionAlias, '.js': ['.js', '.ts', '.tsx']},
  },
}));

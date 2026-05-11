const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// pnpm hoists node_modules to the workspace root, so Metro needs to watch
// that directory to resolve packages. We watch node_modules specifically
// (not the full workspace root) to avoid Metro watching backend/cdk.out/
// directories that CDK creates and deletes mid-flight.
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });

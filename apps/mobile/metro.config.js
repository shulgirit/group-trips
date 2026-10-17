// Metro for the pnpm monorepo. Expo's default config already watches the
// workspace root; on top of that, every `react` import resolves to this app's
// copy. Shared packages (e.g. @convex-dev/better-auth, also used by the web
// app on a newer React) would otherwise bundle a second React and break hooks:
// React Native's renderer must match its own React version exactly.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const fromApp = path.join(__dirname, "package.json");

const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return (resolve ?? context.resolveRequest)(
      { ...context, originModulePath: fromApp },
      moduleName,
      platform
    );
  }
  return (resolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

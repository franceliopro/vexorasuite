const Module = require("node:module");

const originalLoad = Module._load;
globalThis.__vexoraOriginalModuleLoad = originalLoad;
const typescript7Path = /(?:^|[\\/])typescript@7\.0\.2[\\/]node_modules[\\/]typescript(?:[\\/]|$)/i;

function isTypeScript7(request) {
  return request === "typescript" || typescript7Path.test(request);
}

// TypeScript 7 has no programmatic compiler API. Jest transforms (ts-jest) still
// require the TS 6 API, while `tsc` and typechecks continue to use TS 7.
Module._load = function load(request, parent, isMain) {
  if (isTypeScript7(request)) {
    return originalLoad.call(this, "typescript6", parent, isMain);
  }
  return originalLoad.call(this, request, parent, isMain);
};

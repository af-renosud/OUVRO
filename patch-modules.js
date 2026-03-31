/**
 * Patches @react-native 0.81.x packages that ship Flow/TypeScript source syntax
 * in plain .js files, which Node.js 22 cannot execute directly without stripping types.
 *
 * React Native 0.81.5 ships these files uncompiled, expecting Node.js type-stripping.
 * This script uses Babel's flow-strip-types plugin to pre-compile them.
 */
const babel = require("@babel/core");
const fs = require("fs");

const TARGETS = [
  "node_modules/@react-native/babel-plugin-codegen/index.js",
  "node_modules/@react-native/js-polyfills/index.js",
  "node_modules/@react-native/js-polyfills/error-guard.js",
  "node_modules/@react-native/assets-registry/path-support.js",
  "node_modules/@react-native/assets-registry/registry.js",
];

const TS_TARGETS = [
  "node_modules/@react-native/babel-plugin-codegen/index.js",
];

let patched = 0;
let skipped = 0;

for (const file of TARGETS) {
  if (!fs.existsSync(file)) {
    console.log(`[patch-modules] skip (not found): ${file}`);
    skipped++;
    continue;
  }

  const code = fs.readFileSync(file, "utf-8");

  const marker = "/* patched-by-patch-modules */";
  if (code.includes(marker)) {
    console.log(`[patch-modules] already patched: ${file}`);
    skipped++;
    continue;
  }

  try {
    const result = babel.transformSync(code, {
      filename: file,
      plugins: ["@babel/plugin-transform-flow-strip-types"],
      retainLines: true,
      configFile: false,
      babelrc: false,
    });
    fs.writeFileSync(file, marker + "\n" + result.code);
    console.log(`[patch-modules] patched: ${file}`);
    patched++;
  } catch (e) {
    console.error(`[patch-modules] FAILED: ${file} — ${e.message}`);
    process.exit(1);
  }
}

console.log(`[patch-modules] done — ${patched} patched, ${skipped} skipped`);

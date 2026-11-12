// Dependency-free runner using the repository's installed TypeScript compiler.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, overrides = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), overrides);
    return require(name);
  };
  vm.runInNewContext(js, { exports, require: localRequire, console, process, Request, Response, Buffer }, { filename: file });
  return exports;
}
module.exports = { load };
if (require.main === module) {
  load(path.join(__dirname, 'device-protocol.test.ts'));
  require('./route-test.cjs');
  require('./reconcile-test.cjs');
}

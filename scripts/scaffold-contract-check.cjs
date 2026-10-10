// Run with the react-server condition so server-only keeps its real boundary.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const mongodb = require("mongodb");
const root = path.resolve(__dirname, "..");

function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const entry = new Module(file, module);
    entry.filename = file;
    entry.paths = Module._nodeModulePaths(path.dirname(file));
    cache.set(file, entry);
    const originalRequire = entry.require.bind(entry);
    entry.require = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".") && fs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) return load(path.resolve(path.dirname(file), `${name}.ts`));
      return originalRequire(name);
    };
    entry._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText, file);
    return entry.exports;
  }
  return load;
}

function checkTypes(optionsText) {
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const fixture = path.join(root, "scripts", "contract-type-fixture.ts");
  const source = `import { resourceResponse } from "@/server/http/responses";
resourceResponse({}, "req_test", ${optionsText});`;
  const options = { ...parsed.options, incremental: false, noEmit: true };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...rest) => path.resolve(file) === fixture
    ? ts.createSourceFile(file, source, languageVersion, true)
    : originalGetSourceFile(file, languageVersion, ...rest);
  return ts.getPreEmitDiagnostics(ts.createProgram([fixture], options, host));
}

async function main() {
  const load = sourceLoader();
  const config = load("src/server/config.ts");
  const responses = load("src/server/http/responses.ts");
  const { ApiError, errorResponse } = load("src/server/http/errors.ts");
  const { getDatabase } = load("src/server/db/connection.ts");
  const requestId = responses.createRequestId();
  assert.match(requestId, /^req_[0-9a-f-]{36}$/);
  const headers = responses.productHeaders(requestId);
  assert.equal(headers.get("X-Request-Id"), requestId);
  assert.equal(headers.get("Cache-Control"), "private, no-store");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  const resource = responses.resourceResponse({ id: "safe" }, requestId);
  assert.equal(resource.status, 200);
  assert.deepEqual(await resource.json(), { data: { id: "safe" }, meta: { requestId } });
  const created = responses.resourceResponse({ id: "safe" }, requestId, {
    status: 201, location: "/api/v1/example/safe", version: 3,
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("Location"), "/api/v1/example/safe");
  assert.equal(created.headers.get("X-Resource-Version"), "3");
  const page = { limit: 20, hasMore: false, nextCursor: null };
  assert.deepEqual(await responses.listResponse([], page, requestId).json(), {
    data: [], page, meta: { requestId },
  });
  const operation = { operationId: "op_safe", status: "queued", statusUrl: "/api/v1/operations/op_safe" };
  const accepted = responses.acceptedResponse(operation, requestId);
  assert.equal(accepted.status, 202);
  assert.equal(accepted.headers.get("Location"), operation.statusUrl);
  assert.equal(accepted.headers.get("Retry-After"), "2");
  assert.deepEqual(await accepted.json(), { data: operation, meta: { requestId } });
  const empty = responses.noContentResponse(requestId);
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), "");
  const unknown = errorResponse(new Error("synthetic-sensitive-value"), requestId);
  assert.equal(unknown.status, 500);
  assert.deepEqual(await unknown.json(), { error: {
    code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", requestId,
  } });
  const fields = [{ path: "name", code: "required", message: "Name is required." }];
  assert.deepEqual((await errorResponse(new ApiError(422, "VALIDATION_FAILED", "Invalid input", { fields }), requestId).json()).error.fields, fields);
  assert.equal((await errorResponse(new ApiError(403, "FORBIDDEN", "Forbidden", { fields }), requestId).json()).error.fields, undefined);
  const conflict = errorResponse(new ApiError(409, "VERSION_CONFLICT", "Reload", { currentVersion: 4 }), requestId);
  assert.equal((await conflict.json()).error.currentVersion, 4);
  const limited = errorResponse(new ApiError(429, "RATE_LIMITED", "Retry later", { retryAfterSeconds: 10 }), requestId);
  assert.equal(limited.headers.get("Retry-After"), "10");
  const method = errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Unsupported", { allow: ["GET", "POST"] }), requestId);
  assert.equal(method.headers.get("Allow"), "GET, POST");

  // Synthetic environment only; restore the caller's configuration without printing it.
  const keys = ["APP_ORIGIN", "NODE_ENV", "MONGODB_URI", "MONGODB_DB_NAME"];
  const saved = new Map(keys.map((key) => [key, process.env[key]]));
  const savedPool = globalThis.kalyanapuraMongoPromise;
  try {
    delete globalThis.kalyanapuraMongoPromise;
    process.env.NODE_ENV = "development";
    process.env.APP_ORIGIN = "http://localhost:3000";
    assert.equal(config.getAppOrigin(), "http://localhost:3000");
    for (const origin of ["invalid", "https://", "", undefined]) {
      if (origin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = origin;
      let failure;
      assert.throws(config.getAppOrigin, (error) => {
        assert.ok(error instanceof config.CapabilityConfigurationError);
        assert.equal(error.message, "Application origin configuration is missing or invalid.");
        failure = error;
        return true;
      });
      const response = errorResponse(failure, requestId);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: {
        code: "TEMPORARILY_UNAVAILABLE", message: "This capability is not configured.", requestId,
      } });
    }
    for (const origin of ["https://example.com/path", "https://user:pass@example.com", "ftp://example.com", "https://example.com?x=1"]) {
      process.env.APP_ORIGIN = origin;
      assert.throws(config.getAppOrigin, config.CapabilityConfigurationError);
    }
    process.env.NODE_ENV = "production";
    process.env.APP_ORIGIN = "http://localhost:3000";
    assert.throws(config.getAppOrigin, config.CapabilityConfigurationError);
    process.env.APP_ORIGIN = "https://example.com";
    assert.equal(config.getAppOrigin(), "https://example.com");
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
    assert.throws(config.getDatabaseConfig, config.CapabilityConfigurationError);
    process.env.MONGODB_DB_NAME = "scaffold_check";
    for (const uri of ["mongodb://?", "mongodb://localhost:invalid", "mongodb://localhost/?unknownOption=1"]) {
      process.env.MONGODB_URI = uri;
      await assert.rejects(getDatabase(), (error) => {
        assert.ok(error instanceof config.CapabilityConfigurationError);
        assert.equal(error.message, "Database configuration is missing or invalid.");
        return true;
      });
    }
    try { await getDatabase(); } catch (error) {
      const response = errorResponse(error, requestId);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: {
        code: "TEMPORARILY_UNAVAILABLE", message: "This capability is not configured.", requestId,
      } });
    }
    assert.equal(globalThis.kalyanapuraMongoPromise, undefined);

    // Exercise recovery/reuse without network access or a live database.
    let attempts = 0;
    let closed = 0;
    class TestClient {
      constructor(uri, options) {
        assert.equal(uri, "mongodb://127.0.0.1:27017");
        assert.deepEqual(options, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
        attempts += 1;
      }
      async connect() { if (attempts === 1) throw new Error("synthetic-network-failure"); return this; }
      async close() { closed += 1; }
      db(name) { return { databaseName: name }; }
    }
    const isolated = sourceLoader({ mongodb: { ...mongodb, MongoClient: TestClient } });
    const fakeConfig = isolated("src/server/config.ts");
    const fakeDatabase = isolated("src/server/db/connection.ts").getDatabase;
    assert.equal(attempts, 0, "Import must not connect");
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
    await assert.rejects(fakeDatabase(), fakeConfig.CapabilityUnavailableError);
    assert.equal(globalThis.kalyanapuraMongoPromise, undefined);
    assert.equal(closed, 1);
    const results = await Promise.all([fakeDatabase(), fakeDatabase()]);
    assert.equal(attempts, 2, "Concurrent reads reuse the recovered client");
    assert.equal(results[0].databaseName, "scaffold_check");
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (savedPool === undefined) delete globalThis.kalyanapuraMongoPromise;
    else globalThis.kalyanapuraMongoPromise = savedPool;
  }
  for (const options of ["{}", "{ status: 200 }", '{ status: 201, location: "/resource" }']) {
    assert.deepEqual(checkTypes(options), [], "Valid resource options must compile");
  }
  const invalid = checkTypes("{ status: 201 }");
  assert.ok(invalid.some((diagnostic) => diagnostic.code === 2345 && diagnostic.file.fileName.endsWith("contract-type-fixture.ts")), "TypeScript must reject 201 without Location");
  console.log("PASS: HTTP contracts, sanitized configuration, connection recovery/reuse, and TypeScript 201 regression.");
}

module.exports = { sourceLoader };
if (require.main === module) main().catch((error) => { console.error("FAIL: scaffold contract checks:", error.message); process.exitCode = 1; });

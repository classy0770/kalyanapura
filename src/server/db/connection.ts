import "server-only";

import { MongoClient, MongoParseError, MongoRuntimeError, type Db } from "mongodb";

import { CapabilityConfigurationError, CapabilityUnavailableError, getDatabaseConfig } from "@/server/config";

const processCache = globalThis as typeof globalThis & {
  kalyanapuraMongoPromise?: Promise<MongoClient>;
};

export async function getMongoClient(): Promise<MongoClient> {
  const config = getDatabaseConfig();

  if (!processCache.kalyanapuraMongoPromise) {
    let client: MongoClient;
    try {
      client = new MongoClient(config.uri, {
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
      });
    } catch (error) {
      // The driver's connection-string parser has its own MongoParseError class.
      // Invalid host URLs are instead wrapped in MongoRuntimeError.
      const parserError = error instanceof Error && error.name === "MongoParseError";
      const invalidHost = error instanceof MongoRuntimeError &&
        error.cause instanceof TypeError && "code" in error.cause &&
        error.cause.code === "ERR_INVALID_URL";
      if (error instanceof MongoParseError || parserError || invalidHost) {
        throw new CapabilityConfigurationError("Database");
      }
      throw error;
    }
    const promise: Promise<MongoClient> = client.connect().catch(async () => {
      if (processCache.kalyanapuraMongoPromise === promise) {
        delete processCache.kalyanapuraMongoPromise;
      }
      await client.close().catch(() => undefined);
      // Do not expose URI credentials or raw driver errors to callers.
      throw new CapabilityUnavailableError("Database");
    });
    processCache.kalyanapuraMongoPromise = promise;
  }

  return processCache.kalyanapuraMongoPromise;
}

export async function getDatabase(): Promise<Db> {
  const config = getDatabaseConfig();
  return (await getMongoClient()).db(config.name);
}

// No connection or collection/index creation occurs during module import.
// Reuse one pool through development reloads and production requests.

import { MongoClient, MongoClientOptions, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;

// Optimized options for Vercel serverless environment
const options: MongoClientOptions = {
  // Connection pool settings for serverless
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  // Timeouts
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  // Retry settings
  retryWrites: true,
  retryReads: true,
};

// Global type declaration for development caching
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  // Each serverless function instance gets its own connection.
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

// Database name from env or default
const DB_NAME = process.env.MONGODB_DB || 'ai-day-planner';

// Export a helper function for getting the database
export async function getDatabase(dbName: string = DB_NAME): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

// Health check function for API routes
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await clientPromise;
    await client.db().admin().ping();
    return true;
  } catch {
    return false;
  }
}

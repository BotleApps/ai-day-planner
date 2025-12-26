import { MongoClient, MongoClientOptions } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

async function connectToDatabase(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClient?: MongoClient;
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (globalWithMongo._mongoClient) {
      return globalWithMongo._mongoClient;
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect().then((connectedClient) => {
        globalWithMongo._mongoClient = connectedClient;
        return connectedClient;
      });
    }
    return globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    return client.connect();
  }
}

// Create the client promise
clientPromise = connectToDatabase();

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

// Export a helper function for getting the database
export async function getDatabase(dbName: string = 'ai-day-planner') {
  const client = await clientPromise;
  return client.db(dbName);
}

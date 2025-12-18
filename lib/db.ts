import { MongoClient, MongoClientOptions, type Document } from 'mongodb'

// Use a global cached client in development to avoid creating too many connections
// in Next.js hot-reload environments
interface GlobalWithMongo {
  _mongoClient?: MongoClient
  _mongoClientPromise?: Promise<MongoClient>
}

const g = globalThis as unknown as GlobalWithMongo

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined')
}
const uri = process.env.MONGODB_URI
// Try to infer a database name from env or URI; fallback to a sensible default
const inferredFromUri = (() => {
  try {
    const u = new URL(uri.replace('mongodb://', 'http://'))
    const path = (u.pathname || '').replace(/^\/+/, '')
    return path || undefined
  } catch {
    return undefined
  }
})()
const defaultDbName = process.env.MONGODB_DB_NAME || inferredFromUri || 'job_portal'
const options: MongoClientOptions = {
  // Adjust options as needed (e.g., serverSelectionTimeoutMS)
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (!g._mongoClientPromise) {
  client = new MongoClient(uri, options)
  g._mongoClient = client
  g._mongoClientPromise = client.connect()
}

clientPromise = g._mongoClientPromise!

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise
}

export async function getDb(dbName?: string) {
  const client = await getMongoClient()
  // If you have a specific DB name, pass it; otherwise use the database portion
  // of the URI or fall back to 'job_portal'
  return client.db(dbName || defaultDbName)
}

export async function getCollection<T extends Document = Document>(collectionName: string, dbName?: string) {
  const db = await getDb(dbName)
  return db.collection<T>(collectionName)
}

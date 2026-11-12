import mongoose from 'mongoose';
import { Admin } from '@/models/Admin';
import { ClaimLead } from '@/models/ClaimLead';
import { ContactInquiry } from '@/models/ContactInquiry';
import { RateLimit } from '@/models/RateLimit';

type CachedConnection = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  indexesPromise: Promise<void> | null;
};

declare global {
  var mongooseConnection: CachedConnection | undefined;
}

const cached = globalThis.mongooseConnection ?? { connection: null, promise: null, indexesPromise: null };
globalThis.mongooseConnection = cached;

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      autoIndex: false,
      bufferCommands: false,
      tls: true,
      maxPoolSize: 8,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    }).catch((error: unknown) => {
      cached.promise = null;
      throw error;
    });
  }

  cached.connection = await cached.promise;
  if (!cached.indexesPromise) {
    cached.indexesPromise = Promise.all([
      ClaimLead.createIndexes(),
      ContactInquiry.createIndexes(),
      Admin.createIndexes(),
      RateLimit.createIndexes(),
    ]).then(() => undefined).catch((error: unknown) => {
      cached.indexesPromise = null;
      throw error;
    });
  }
  await cached.indexesPromise;
  return cached.connection;
}
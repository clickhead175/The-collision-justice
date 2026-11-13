import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function syncIndexes() {
  await connectToDatabase();
  await Promise.all(['ClaimLead', 'ClaimAudit', 'ContactInquiry', 'Admin', 'RateLimit'].map((name) => mongoose.model(name).createIndexes()));
  console.log('MongoDB indexes are ready.');
}

syncIndexes()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Index setup failed.');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
import nextEnv from '@next/env';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid ADMIN_EMAIL.');
  if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('ADMIN_PASSWORD must contain 12 to 72 bytes.');
  }
  await connectToDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.name = existing.name || 'Primary Administrator';
    existing.role = 'superadmin';
    existing.passwordHash = passwordHash;
    existing.sessionVersion = (existing.sessionVersion || 0) + 1;
    await existing.save();
  } else {
    await Admin.create({ email, name: 'Primary Administrator', role: 'superadmin', passwordHash, sessionVersion: 0 });
  }
  console.log(`Admin account ${email} is ready.`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Admin seeding failed.');
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
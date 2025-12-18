#!/usr/bin/env node
import bcrypt from 'bcryptjs'
import { MongoClient, ObjectId } from 'mongodb'

async function main() {
  const [,, identifier, newPassword] = process.argv
  if (!identifier || !newPassword) {
    console.error('Usage: node scripts/reset-password.mjs <email|userId> <newPassword>')
    process.exit(1)
  }

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is not defined')
    process.exit(1)
  }
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'job-portal'

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)
    const users = db.collection('users')

    let filter
    try {
      filter = { _id: new ObjectId(identifier) }
    } catch {
      filter = { email: identifier }
    }

    const user = await users.findOne(filter)
    if (!user) {
      console.error('User not found for identifier:', identifier)
      process.exit(2)
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    const r = await users.updateOne(filter, { $set: { passwordHash, updatedAt: new Date() }, $unset: { password: '' } })
    if (!r.matchedCount) {
      console.error('Failed to update password: user not matched')
      process.exit(3)
    }
    console.log('Password updated for user:', user.email || user._id)
  } catch (e) {
    console.error('Error:', e?.message || e)
    process.exit(4)
  } finally {
    await client.close()
  }
}

main()

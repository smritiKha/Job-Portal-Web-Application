#!/usr/bin/env node
import { MongoClient, ObjectId } from 'mongodb'

async function main() {
  const [,, mongoUri, emailOrId, role] = process.argv
  if (!mongoUri || !emailOrId || !role) {
    console.error('Usage: node scripts/set-role.mjs <mongoUri> <email|userId> <job_seeker|employer|admin>')
    process.exit(1)
  }
  if (!['job_seeker','employer','admin'].includes(role)) {
    console.error('Role must be one of job_seeker, employer, admin')
    process.exit(1)
  }
  const client = new MongoClient(mongoUri)
  try {
    await client.connect()
    const db = client.db()
    const users = db.collection('users')
    let q
    if (emailOrId.includes('@')) q = { email: String(emailOrId).toLowerCase() }
    else {
      try { q = { _id: new ObjectId(emailOrId) } } catch { console.error('Invalid userId'); process.exit(1) }
    }
    const r = await users.updateOne(q, { $set: { role, updatedAt: new Date() } })
    if (!r.matchedCount) {
      console.error('User not found')
      process.exit(2)
    }
    console.log('Role updated:', { matched: r.matchedCount, modified: r.modifiedCount, role })
  } catch (e) {
    console.error('Error:', e?.message || e)
    process.exit(3)
  } finally {
    await client.close()
  }
}

main()

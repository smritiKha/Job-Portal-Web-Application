import { NextResponse } from 'next/server'
import { getMongoClient } from '@/lib/db'

export async function GET() {
  try {
    const client = await getMongoClient()
    const admin = client.db().admin()
    const result = await admin.ping()
    return NextResponse.json({ ok: true, result })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

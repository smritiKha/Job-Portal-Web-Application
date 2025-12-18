import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Users: unique email
    const users = await getCollection('users')
    await users.createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' })

    // Jobs: createdBy, status, companyId
    const jobs = await getCollection('jobs')
    await jobs.createIndex({ createdBy: 1 }, { name: 'jobs_createdBy' })
    await jobs.createIndex({ status: 1 }, { name: 'jobs_status' })
    await jobs.createIndex({ companyId: 1 }, { name: 'jobs_companyId' })
    await jobs.createIndex({ status: 1, createdAt: -1 }, { name: 'jobs_status_createdAt_desc' })

    // Applications: userId, jobId, status
    const applications = await getCollection('applications')
    await applications.createIndex({ userId: 1 }, { name: 'applications_userId' })
    await applications.createIndex({ jobId: 1 }, { name: 'applications_jobId' })
    await applications.createIndex({ status: 1 }, { name: 'applications_status' })
    await applications.createIndex({ jobId: 1, status: 1, createdAt: -1 }, { name: 'applications_job_status_createdAt_desc' })

    // Interviews: applicationId, scheduledAt
    const interviews = await getCollection('interviews')
    await interviews.createIndex({ applicationId: 1 }, { name: 'interviews_applicationId' })
    await interviews.createIndex({ scheduledAt: -1 }, { name: 'interviews_scheduledAt_desc' })

    // Audit Logs: createdAt, action, targetType+targetId, actorId
    const audits = await getCollection('audit_logs')
    await audits.createIndex({ createdAt: -1 }, { name: 'audit_createdAt_desc' })
    await audits.createIndex({ action: 1, createdAt: -1 }, { name: 'audit_action_createdAt_desc' })
    await audits.createIndex({ targetType: 1, targetId: 1, createdAt: -1 }, { name: 'audit_targetType_targetId_createdAt_desc' })
    await audits.createIndex({ actorId: 1, createdAt: -1 }, { name: 'audit_actorId_createdAt_desc' })

    // Messages: senderId, recipientId, createdAt, unread queries
    const messages = await getCollection('messages')
    await messages.createIndex({ senderId: 1, recipientId: 1, createdAt: -1 }, { name: 'messages_pair_createdAt_desc' })
    await messages.createIndex({ recipientId: 1, readAt: 1 }, { name: 'messages_recipient_readAt' })
    await messages.createIndex({ senderId: 1, createdAt: -1 }, { name: 'messages_sender_createdAt_desc' })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

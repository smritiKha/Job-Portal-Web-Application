import { getCollection } from '@/lib/db'

export type AuditEvent = {
  actorId: string
  actorRole: string
  action: string
  targetType: string
  targetId?: string
  meta?: Record<string, any>
  createdAt?: Date
}

export async function logAudit(event: AuditEvent) {
  try {
    const col = await getCollection<AuditEvent>('audit_logs')
    const doc: AuditEvent = { ...event, createdAt: new Date() }
    await (col as any).insertOne(doc)
  } catch (err) {
    // Non-fatal: do not block primary action
    console.error('audit_log_failed', (err as Error)?.message || String(err))
  }
}

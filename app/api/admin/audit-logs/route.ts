import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { ObjectId } from 'mongodb'

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const actorId = searchParams.get('actorId')
    const action = searchParams.get('action')
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')
    const from = searchParams.get('from') // ISO date
    const to = searchParams.get('to') // ISO date
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const skip = (page - 1) * limit

    const match: any = {}
    if (actorId) match.actorId = actorId
    if (action) match.action = action
    if (targetType) match.targetType = targetType
    if (targetId) match.targetId = targetId
    if (from || to) {
      match.createdAt = {}
      if (from) match.createdAt.$gte = new Date(from)
      if (to) match.createdAt.$lte = new Date(to)
    }

    const col = await getCollection<any>('audit_logs')
    const total = await col.countDocuments(match)

    const items = await (col as any).aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'actorId',
          foreignField: '_id', // actorId is string, but users._id is ObjectId; attempt string match too
          as: 'actorUserByObjId'
        }
      },
      // Also attempt match by string id: join by converting _id to string
      {
        $lookup: {
          from: 'users',
          let: { actorId: '$actorId' },
          pipeline: [
            { $addFields: { _idStr: { $toString: '$_id' } } },
            { $match: { $expr: { $eq: ['$_idStr', '$$actorId'] } } },
            { $project: { _idStr: 0 } }
          ],
          as: 'actorUserByString'
        }
      },
      {
        $addFields: {
          actorUser: { $ifNull: [{ $arrayElemAt: ['$actorUserByString', 0] }, { $arrayElemAt: ['$actorUserByObjId', 0] }] }
        }
      },
      { $project: { actorUserByString: 0, actorUserByObjId: 0 } },
      {
        $project: {
          actorId: 1,
          actorRole: 1,
          action: 1,
          targetType: 1,
          targetId: 1,
          meta: 1,
          createdAt: 1,
          actorUser: { _id: '$actorUser._id', name: '$actorUser.name', email: '$actorUser.email' }
        }
      }
    ]).toArray()

    return NextResponse.json({ ok: true, logs: items, page, limit, total, hasMore: skip + items.length < total })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

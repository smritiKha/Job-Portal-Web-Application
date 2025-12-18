import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { decryptText } from '@/lib/crypto'

interface MessageDoc {
  _id?: ObjectId
  senderId: ObjectId
  recipientId: ObjectId
  ciphertext: string
  iv: string
  tag: string
  createdAt: Date
  readAt?: Date | null
}

// GET /api/conversations -> list peers with last message and unread count
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const me = new ObjectId(auth.id)
    const messages = await getCollection<MessageDoc>('messages')
    const url = new URL(req.url)
    const peerIdParam = url.searchParams.get('peerId')

    const items = await (messages as any).aggregate([
      { $match: { $or: [ { senderId: me }, { recipientId: me } ] } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          peerId: {
            $cond: [ { $eq: ['$senderId', me] }, '$recipientId', '$senderId' ]
          }
        }
      },
      {
        $group: {
          _id: '$peerId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: { $cond: [ { $and: [ { $eq: ['$recipientId', me] }, { $eq: ['$readAt', null] } ] }, 1, 0 ] } },
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'peer'
        }
      },
      { $unwind: { path: '$peer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          peerId: '$_id',
          peer: { _id: '$peer._id', name: '$peer.name', email: '$peer.email', avatar: '$peer.avatar' },
          peerPresenceOnline: '$peer.settings.presence.online',
          lastMessage: 1,
          unreadCount: 1,
        }
      },
    ]).toArray()

    const conversations = items.map((it: any) => ({
      peerId: String(it.peerId),
      peer: it.peer ? { id: String(it.peer._id), name: it.peer.name || 'User', email: it.peer.email || '', avatar: it.peer.avatar || '' } : { id: String(it.peerId), name: 'User', email: '', avatar: '' },
      peerPresenceOnline: Boolean(it.peerPresenceOnline ?? false),
      lastMessage: {
        id: String(it.lastMessage._id),
        senderId: String(it.lastMessage.senderId),
        recipientId: String(it.lastMessage.recipientId),
        content: safeDecrypt(it.lastMessage.ciphertext, it.lastMessage.iv, it.lastMessage.tag),
        createdAt: it.lastMessage.createdAt,
      },
      unread: Number(it.unreadCount || 0),
    }))

    // Optionally include a stub conversation for a selected peer (no messages yet)
    if (peerIdParam) {
      try {
        const pid = new ObjectId(peerIdParam)
        const exists = conversations.some((c: any) => c.peerId === String(pid))
        if (!exists) {
          const usersCol = await getCollection<any>('users')
          const u = await usersCol.findOne({ _id: pid }, { projection: { name: 1, email: 1, avatar: 1 } })
          if (u) {
            conversations.unshift({
              peerId: String(pid),
              peer: { id: String(pid), name: u.name || 'User', email: u.email || '', avatar: u.avatar || '' },
              peerPresenceOnline: Boolean(u?.settings?.presence?.online ?? false),
              lastMessage: undefined as any,
              unread: 0,
            } as any)
          }
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, conversations })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

function safeDecrypt(ciphertext: string, iv: string, tag: string) {
  try { return decryptText(ciphertext, iv, tag) } catch { return '[unreadable]' }
}

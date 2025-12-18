import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const auth = await getAuthUser()
    if (!auth?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const applications = await getCollection('applications')
    const application = await applications.findOne({
      userId: auth.id,
      jobId: jobId
    })

    return NextResponse.json({
      hasApplied: !!application
    })
  } catch (error) {
    console.error('Error checking application status:', error)
    return NextResponse.json(
      { error: 'Failed to check application status' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { Collection, Document, ObjectId } from 'mongodb'

export interface Application extends Document {
  _id: ObjectId
  jobId: string
  userId: string
  status?: string
  appliedAt?: Date
  updatedAt?: Date
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const auth = await getAuthUser(request)
    if (!auth?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      )
    }

    // 2. Get database connection
    let applications: Collection<Application>
    try {
      applications = await getCollection('applications')
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error'
      console.error('Database connection error:', errorMessage)
      return NextResponse.json(
        { 
          error: 'Database connection error',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        },
        { status: 503 }
      )
    }

    // 3. Query applications
    try {
      const userApplications = await applications
        .find({ userId: auth.id })
        .project<Pick<Application, '_id' | 'jobId' | 'status' | 'appliedAt' | 'updatedAt'>>({ 
          _id: 1,
          jobId: 1,
          status: 1,
          appliedAt: 1,
          updatedAt: 1
        })
        .sort({ appliedAt: -1 })
        .toArray()

      return NextResponse.json(userApplications)
    } catch (queryError) {
      const errorMessage = queryError instanceof Error ? queryError.message : 'Unknown query error'
      console.error('Query error:', errorMessage)
      return NextResponse.json(
        { 
          error: 'Failed to fetch applications',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    console.error('Unexpected error in /api/applications/my:', errorMessage)
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

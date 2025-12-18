import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { DREAM_JOBS } from '@/lib/constants/dream-jobs';
import { getCollection } from '@/lib/db';

export async function GET(request: Request) {
  try {
    // Prevent caching
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, max-age=0');
    headers.set('Pragma', 'no-cache');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' }, 
        { status: 400, headers }
      );
    }

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400, headers }
      );
    }

    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }
    
    // If user has a dream job set, return it; otherwise return the first job as default
    const jobId = user.dreamJobId || DREAM_JOBS[0].id;
    const job = DREAM_JOBS.find(job => job.id === jobId) || DREAM_JOBS[0];
    
    return NextResponse.json({ 
      success: true,
      dreamJob: job,
      lastUpdated: new Date().toISOString()
    }, { headers });
  } catch (error) {
    console.error('Error fetching dream job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dream job' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, jobId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }
    
    const job = DREAM_JOBS.find(job => job.id === jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Update the user's dream job in the database
    const usersCollection = await getCollection('users');
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { dreamJobId: jobId } },
      { upsert: true }
    );
    
    return NextResponse.json({ 
      success: true,
      dreamJob: job
    });
  } catch (error) {
    console.error('Error setting dream job:', error);
    return NextResponse.json(
      { error: 'Failed to set dream job' },
      { status: 500 }
    );
  }
}

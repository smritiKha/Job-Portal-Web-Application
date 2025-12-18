export async function hasUserApplied(jobId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/applications/check?jobId=${encodeURIComponent(jobId)}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to check application status');
    }
    
    const data = await response.json();
    return data?.hasApplied || false;
  } catch (error) {
    console.error('Error checking application status:', error);
    return false;
  }
}

export async function getAppliedJobs(): Promise<Set<string>> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null;
    
    if (!token) {
      console.warn('No authentication token found');
      return new Set();
    }

    const response = await fetch('/api/applications/my', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch applied jobs:', response.status, errorText);
      throw new Error(`Failed to fetch applied jobs: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return new Set(data.map((app: any) => {
        // Handle both _id and jobId fields, converting ObjectId to string
        const jobId = app.jobId || (app._id ? String(app._id) : null);
        return jobId ? String(jobId) : '';
      }).filter(Boolean));
    }
    
    console.warn('Unexpected response format from /api/applications/my:', data);
    return new Set();
  } catch (error) {
    console.error('Error in getAppliedJobs:', error);
    return new Set();
  }
}

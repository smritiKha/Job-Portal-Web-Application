const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateUsersSchema() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Add dreamJobId field to all users
    const result = await db.collection('users').updateMany(
      {},
      { 
        $setOnInsert: { dreamJobId: null }
      },
      { upsert: false }
    );
    
    console.log(`Updated ${result.modifiedCount} users with dreamJobId field`);
    
  } catch (error) {
    console.error('Error updating users schema:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

updateUsersSchema();

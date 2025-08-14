require('dotenv').config({ path: '.env.production' });

const DatabaseService = require('./src/services/DatabaseService');

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase database connection...');
  console.log(`📊 Database URL: ${process.env.SUPABASE_URL}`);
  
  try {
    // Initialize database service
    await DatabaseService.initialize();
    console.log('✅ Database service initialized successfully');
    
    // Test basic query
    const { data, error } = await DatabaseService.supabase
      .from('organizations')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    console.log('✅ Database query test successful');
    
    // Test table existence
    const tables = [
      'organizations',
      'users', 
      'user_organizations',
      'tasks',
      'orders',
      'customers',
      'deliveries',
      'inventory',
      'support_tickets',
      'invoices'
    ];
    
    console.log('🔍 Checking table schema...');
    
    for (const table of tables) {
      try {
        const { data, error } = await DatabaseService.supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error && error.code !== 'PGRST116') {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: OK`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }
    
    console.log('🎉 Database connection test completed successfully!');
    console.log('📊 Your Supabase database is ready for production');
    
    return true;
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('🔧 Please check your Supabase configuration in .env.production');
    return false;
  }
}

// Run the test
testDatabaseConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
  });

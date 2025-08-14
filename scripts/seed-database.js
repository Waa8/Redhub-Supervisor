require('dotenv').config({ path: '.env.production' });

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Use service key to bypass RLS for seeding
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    console.log('✅ Using Supabase service key for seeding');

    // Create demo organization
    console.log('📊 Creating demo organization...');
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Demo Company',
        slug: 'demo-company',
        description: 'Demo organization for testing',
        is_active: true,
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en'
        }
      })
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }
    console.log('✅ Organization created:', organization.name);

    // Create demo users
    console.log('👥 Creating demo users...');
    
    const users = [
      {
        username: 'admin',
        email: 'admin@demo.com',
        password: 'admin123',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        username: 'manager',
        email: 'manager@demo.com',
        password: 'manager123',
        first_name: 'Manager',
        last_name: 'User',
        role: 'manager'
      },
      {
        username: 'agent',
        email: 'agent@demo.com',
        password: 'agent123',
        first_name: 'Agent',
        last_name: 'User',
        role: 'agent'
      }
    ];

    for (const userData of users) {
      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 12);
      
      // Create user
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          email: userData.email,
          password_hash: passwordHash,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          is_active: true,
          email_verified: true,
          timezone: 'UTC',
          language: 'en',
          preferences: {}
        })
        .select()
        .single();

      if (userError) {
        throw userError;
      }

      // Add user to organization
      const { error: userOrgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: organization.id,
          role: userData.role,
          is_active: true
        });

      if (userOrgError) {
        throw userOrgError;
      }

      console.log(`✅ User created: ${userData.username} (${userData.role})`);
    }

    // Create demo customers
    console.log('🏢 Creating demo customers...');
    
    const customers = [
      {
        name: 'ABC Corporation',
        email: 'contact@abc-corp.com',
        phone: '+1-555-0101',
        customer_type: 'business',
        tier: 'gold',
        company_name: 'ABC Corporation',
        billing_address: {
          street: '123 Business Ave',
          city: 'New York',
          region: 'NY',
          postcode: '10001',
          country: 'USA'
        },
        shipping_address: {
          street: '123 Business Ave',
          city: 'New York',
          region: 'NY',
          postcode: '10001',
          country: 'USA'
        }
      },
      {
        name: 'John Smith',
        email: 'john.smith@email.com',
        phone: '+1-555-0102',
        customer_type: 'individual',
        tier: 'silver',
        billing_address: {
          street: '456 Residential St',
          city: 'Los Angeles',
          region: 'CA',
          postcode: '90001',
          country: 'USA'
        }
      }
    ];

    for (let i = 0; i < customers.length; i++) {
      const customerData = {
        ...customers[i],
        customer_code: `CUST-${String(i + 1).padStart(6, '0')}`,
        organization_id: organization.id,
        is_active: true
      };

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (customerError) {
        throw customerError;
      }
      console.log(`✅ Customer created: ${customer.name}`);
    }

    // Create demo tasks
    console.log('📋 Creating demo tasks...');
    
    const { data: adminUser } = await supabase.from('users').select('*').eq('username', 'admin').single();
    const { data: managerUser } = await supabase.from('users').select('*').eq('username', 'manager').single();
    const { data: agentUser } = await supabase.from('users').select('*').eq('username', 'agent').single();

    const tasks = [
      {
        title: 'Setup Production Environment',
        description: 'Configure and deploy the production environment with all necessary services',
        status: 'completed',
        priority: 'high',
        assigned_to: adminUser.id,
        created_by: adminUser.id,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        progress: 100
      },
      {
        title: 'Process Customer Orders',
        description: 'Review and process pending customer orders from the queue',
        status: 'in_progress',
        priority: 'medium',
        assigned_to: agentUser.id,
        created_by: managerUser.id,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        progress: 60
      },
      {
        title: 'Update Customer Database',
        description: 'Clean and update customer contact information in the database',
        status: 'pending',
        priority: 'low',
        assigned_to: agentUser.id,
        created_by: managerUser.id,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        progress: 0
      }
    ];

    for (const taskData of tasks) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          organization_id: organization.id
        })
        .select()
        .single();

      if (taskError) {
        throw taskError;
      }
      console.log(`✅ Task created: ${task.title}`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('Demo Login Credentials:');
    console.log('👤 Admin: username=admin, password=admin123');
    console.log('👤 Manager: username=manager, password=manager123');
    console.log('👤 Agent: username=agent, password=agent123');
    console.log('');
    console.log('🌐 Access your application at: http://localhost:5002');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('✅ Seeding process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Seeding process failed:', error);
    process.exit(1);
  });

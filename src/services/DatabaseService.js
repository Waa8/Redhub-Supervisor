const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL || 'https://rtonquedpcuntembyfxj.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseKey) {
        throw new Error('Supabase key not configured');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        db: {
          schema: 'public'
        }
      });

      // Create a service client for admin operations (bypasses RLS)
      this.serviceClient = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          db: {
            schema: 'public'
          }
        }
      );

      // Test connection with a simple query
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('count')
          .limit(1);

        // PGRST116 means table not found, which is OK for first run
        if (error && error.code !== 'PGRST116') {
          console.warn('Database test query warning:', error.message);
        }
      } catch (testError) {
        console.warn('Database test query failed (continuing anyway):', testError.message);
      }

      console.log('Supabase database connection established successfully');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createDemoData() {
    // Create demo users
    const adminUser = {
      id: uuidv4(),
      username: 'admin',
      email: 'admin@productivityapp.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO/G', // admin123
      first_name: 'Admin',
      last_name: 'User',
      phone: '+1234567890',
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const managerUser = {
      id: uuidv4(),
      username: 'manager',
      email: 'manager@productivityapp.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO/G', // manager123
      first_name: 'Manager',
      last_name: 'User',
      phone: '+1234567891',
      role: 'manager',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const agentUser = {
      id: uuidv4(),
      username: 'agent',
      email: 'agent@productivityapp.com',
      password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO/G', // agent123
      first_name: 'Agent',
      last_name: 'User',
      phone: '+1234567892',
      role: 'agent',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.data.users.set(adminUser.id, adminUser);
    this.data.users.set(managerUser.id, managerUser);
    this.data.users.set(agentUser.id, agentUser);

    // Create demo customer
    const demoCustomer = {
      id: uuidv4(),
      customer_code: 'CUST-001',
      name: 'Demo Customer',
      email: 'customer@example.com',
      phone: '+1234567893',
      customer_type: 'individual',
      tier: 'gold',
      billing_address: {
        street: '123 Main St',
        city: 'Demo City',
        country: 'Demo Country'
      },
      shipping_address: {
        street: '123 Main St',
        city: 'Demo City',
        country: 'Demo Country'
      },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.data.customers.set(demoCustomer.id, demoCustomer);

    // Create demo tasks
    const demoTasks = [
      {
        id: uuidv4(),
        title: 'Review new orders',
        description: 'Review and process new customer orders',
        status: 'pending',
        priority: 'high',
        assigned_to: agentUser.id,
        created_by: managerUser.id,
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tags: ['orders', 'review'],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Update inventory levels',
        description: 'Check and update warehouse inventory levels',
        status: 'in_progress',
        priority: 'medium',
        assigned_to: agentUser.id,
        created_by: managerUser.id,
        tags: ['inventory', 'warehouse'],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    demoTasks.forEach(task => {
      this.data.tasks.set(task.id, task);
    });

    // Create demo orders
    const demoOrders = [
      {
        id: uuidv4(),
        order_number: 'ORD-250113-0001',
        customer_id: demoCustomer.id,
        order_status: 'pending',
        order_type: 'standard',
        total_amount: 150.00,
        currency: 'USD',
        delivery_address: demoCustomer.shipping_address,
        delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        special_instructions: 'Handle with care',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    demoOrders.forEach(order => {
      this.data.orders.set(order.id, order);
    });
  }

  // Authentication-specific queries (bypasses RLS)
  async findUserForAuth(field, value) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.serviceClient
        .from('users')
        .select('*')
        .eq(field, value)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Auth user lookup error:', error);
      throw error;
    }
  }

  // Supabase query methods
  async query(text, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        query: text,
        params: params
      });

      if (error) throw error;

      return {
        rows: data || [],
        rowCount: data ? data.length : 0
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    // Supabase handles transactions automatically for RPC calls
    try {
      const result = await callback(this);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async query(text, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      // For Supabase, we don't use raw SQL queries directly
      // Instead, we use the table-based API
      console.warn('Direct SQL queries not supported with Supabase - use table methods instead');
      return {
        rows: [],
        rowCount: 0
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    // Supabase handles transactions automatically for RPC calls
    try {
      const result = await callback(this);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async close() {
    console.log('In-memory database closed');
  }

  // Supabase CRUD operations
  async findById(table, id) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error(`Error finding ${table} by ID:`, error);
      return null;
    }
  }

  async findByField(table, field, value) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('*')
        .eq(field, value);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error finding ${table} by ${field}:`, error);
      return [];
    }
  }

  async create(table, data) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data: result, error } = await this.supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error creating ${table}:`, error);
      throw error;
    }
  }

  async update(table, id, data) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data: result, error } = await this.supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error updating ${table}:`, error);
      throw error;
    }
  }

  async delete(table, id) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data: result, error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error deleting ${table}:`, error);
      throw error;
    }
  }

  // Advanced Supabase operations
  async findAll(table, conditions = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      let query = this.supabase.from(table).select(options.select || '*');

      // Apply conditions
      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error finding all ${table}:`, error);
      return [];
    }
  }

  async count(table, conditions = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      let query = this.supabase.from(table).select('*', { count: 'exact', head: true });

      // Apply conditions
      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Error counting ${table}:`, error);
      return 0;
    }
  }

  // Advanced query builder
  async findWithJoins(table, joins = [], conditions = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      // Build select string with joins
      let selectString = '*';
      if (joins.length > 0) {
        const joinSelects = joins.map(join => {
          if (typeof join === 'string') {
            return `${join}(*)`;
          } else {
            return `${join.table}(${join.select || '*'})`;
          }
        });
        selectString = `*, ${joinSelects.join(', ')}`;
      }

      let query = this.supabase.from(table).select(selectString);

      // Apply conditions
      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error finding ${table} with joins:`, error);
      return [];
    }
  }

  // Bulk operations
  async bulkCreate(table, dataArray) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from(table)
        .insert(dataArray)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error bulk creating ${table}:`, error);
      throw error;
    }
  }

  async bulkUpdate(table, updates) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      const results = [];
      for (const update of updates) {
        const { id, ...data } = update;
        const result = await this.update(table, id, data);
        results.push(result);
      }
      return results;
    } catch (error) {
      console.error(`Error bulk updating ${table}:`, error);
      throw error;
    }
  }

  // Search functionality
  async search(table, searchTerm, searchFields = [], options = {}) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    try {
      let query = this.supabase.from(table).select(options.select || '*');

      if (searchFields.length > 0) {
        // Use text search on specified fields
        const searchConditions = searchFields.map(field =>
          `${field}.ilike.%${searchTerm}%`
        ).join(',');
        query = query.or(searchConditions);
      } else {
        // Use full-text search if available
        query = query.textSearch('search_vector', searchTerm);
      }

      // Apply additional conditions
      if (options.conditions) {
        Object.entries(options.conditions).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error searching ${table}:`, error);
      return [];
    }
  }
}

module.exports = new DatabaseService();

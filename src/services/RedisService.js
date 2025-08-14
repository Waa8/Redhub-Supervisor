class RedisService {
  constructor() {
    this.cache = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize in-memory cache
      this.isInitialized = true;
      console.log('In-memory cache initialized successfully');
      return true;
    } catch (error) {
      console.error('Cache initialization failed:', error);
      return false;
    }
  }

  async get(key) {
    if (!this.isInitialized) return null;

    try {
      const prefixedKey = this.prefixKey(key);
      const item = this.cache.get(prefixedKey);

      if (!item) return null;

      // Check TTL
      if (item.expires && item.expires < Date.now()) {
        this.cache.delete(prefixedKey);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    if (!this.isInitialized) return false;

    try {
      const prefixedKey = this.prefixKey(key);
      const item = {
        value,
        expires: ttl ? Date.now() + (ttl * 1000) : null
      };

      this.cache.set(prefixedKey, item);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.del(this.prefixKey(key));
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isInitialized) return false;
    
    try {
      const result = await this.client.exists(this.prefixKey(key));
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async expire(key, ttl) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.expire(this.prefixKey(key), ttl);
      return true;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  async increment(key, amount = 1) {
    if (!this.isInitialized) return null;
    
    try {
      const result = await this.client.incrBy(this.prefixKey(key), amount);
      return result;
    } catch (error) {
      console.error('Redis increment error:', error);
      return null;
    }
  }

  async setHash(key, field, value) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.hSet(this.prefixKey(key), field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis hash set error:', error);
      return false;
    }
  }

  async getHash(key, field) {
    if (!this.isInitialized) return null;
    
    try {
      const value = await this.client.hGet(this.prefixKey(key), field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis hash get error:', error);
      return null;
    }
  }

  async getAllHash(key) {
    if (!this.isInitialized) return {};
    
    try {
      const hash = await this.client.hGetAll(this.prefixKey(key));
      const result = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Redis hash getall error:', error);
      return {};
    }
  }

  async addToSet(key, value) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.sAdd(this.prefixKey(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis set add error:', error);
      return false;
    }
  }

  async removeFromSet(key, value) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.sRem(this.prefixKey(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis set remove error:', error);
      return false;
    }
  }

  async getSet(key) {
    if (!this.isInitialized) return [];
    
    try {
      const members = await this.client.sMembers(this.prefixKey(key));
      return members.map(member => {
        try {
          return JSON.parse(member);
        } catch {
          return member;
        }
      });
    } catch (error) {
      console.error('Redis set get error:', error);
      return [];
    }
  }

  async pushToList(key, value) {
    if (!this.isInitialized) return false;
    
    try {
      await this.client.lPush(this.prefixKey(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis list push error:', error);
      return false;
    }
  }

  async popFromList(key) {
    if (!this.isInitialized) return null;
    
    try {
      const value = await this.client.lPop(this.prefixKey(key));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis list pop error:', error);
      return null;
    }
  }

  async getListLength(key) {
    if (!this.isInitialized) return 0;
    
    try {
      return await this.client.lLen(this.prefixKey(key));
    } catch (error) {
      console.error('Redis list length error:', error);
      return 0;
    }
  }

  prefixKey(key) {
    const prefix = process.env.CACHE_PREFIX || 'productivity_app';
    return `${prefix}:${key}`;
  }

  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('Redis connection closed');
    }
  }

  // Cache helper methods
  async cacheData(key, data, ttl = 3600) {
    return await this.set(key, data, ttl);
  }

  async getCachedData(key) {
    return await this.get(key);
  }

  async invalidateCache(pattern) {
    if (!this.isInitialized) return false;
    
    try {
      const keys = await this.client.keys(this.prefixKey(pattern));
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis cache invalidation error:', error);
      return false;
    }
  }
}

module.exports = new RedisService();

const axios = require('axios');

class AIService {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.deepseekBaseUrl = 'https://api.deepseek.com/v1';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.deepseekApiKey) {
        console.warn('DeepSeek API key not configured - AI features will be disabled');
        return false;
      }

      // Test API connection
      const response = await axios.get(`${this.deepseekBaseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('✅ DeepSeek AI service connected successfully');
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      console.warn('⚠️ DeepSeek AI service initialization failed:', error.message);
      return false;
    }
  }

  // AI-powered task description enhancement
  async enhanceTaskDescription(title, description) {
    if (!this.isInitialized) {
      return { title, description };
    }

    try {
      const prompt = `Enhance this task description to be more clear and actionable:
Title: ${title}
Description: ${description}

Please provide:
1. An improved, clear title
2. A detailed, actionable description
3. Suggested priority level
4. Estimated time to complete

Format as JSON with keys: title, description, priority, estimatedHours`;

      const response = await axios.post(`${this.deepseekBaseUrl}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a productivity expert helping to improve task descriptions for better clarity and actionability.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;
      const enhancement = JSON.parse(aiResponse);

      return {
        originalTitle: title,
        originalDescription: description,
        enhancedTitle: enhancement.title,
        enhancedDescription: enhancement.description,
        suggestedPriority: enhancement.priority,
        estimatedHours: enhancement.estimatedHours
      };
    } catch (error) {
      console.error('AI task enhancement error:', error.message);
      return { title, description };
    }
  }

  // AI-powered customer service response suggestions
  async generateTicketResponse(ticketSubject, ticketDescription, customerHistory = []) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const prompt = `Generate a professional customer service response for this support ticket:

Subject: ${ticketSubject}
Description: ${ticketDescription}
Customer History: ${customerHistory.slice(0, 3).map(h => `- ${h.subject}: ${h.resolution || 'Unresolved'}`).join('\n')}

Please provide:
1. A professional, empathetic response
2. Suggested resolution steps
3. Estimated resolution time
4. Priority level recommendation

Format as JSON with keys: response, resolutionSteps, estimatedTime, priority`;

      const response = await axios.post(`${this.deepseekBaseUrl}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a professional customer service expert providing helpful, empathetic responses to customer inquiries.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.4
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;
      return JSON.parse(aiResponse);
    } catch (error) {
      console.error('AI ticket response generation error:', error.message);
      return null;
    }
  }

  // AI-powered order analysis and recommendations
  async analyzeOrderPattern(customerOrders, customerProfile) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const orderSummary = customerOrders.slice(0, 10).map(order => ({
        date: order.created_at,
        total: order.total_amount,
        items: order.items?.length || 0,
        status: order.order_status
      }));

      const prompt = `Analyze this customer's order pattern and provide insights:

Customer Profile:
- Type: ${customerProfile.customer_type}
- Tier: ${customerProfile.tier}
- Total Orders: ${customerOrders.length}

Recent Orders: ${JSON.stringify(orderSummary, null, 2)}

Please provide:
1. Order pattern analysis
2. Recommended products or services
3. Optimal contact timing
4. Upselling opportunities
5. Risk assessment (payment delays, cancellations)

Format as JSON with keys: analysis, recommendations, contactTiming, upsellOpportunities, riskAssessment`;

      const response = await axios.post(`${this.deepseekBaseUrl}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst expert in customer behavior analysis and sales optimization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;
      return JSON.parse(aiResponse);
    } catch (error) {
      console.error('AI order analysis error:', error.message);
      return null;
    }
  }

  // AI-powered inventory optimization
  async optimizeInventory(inventoryData, salesData) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const prompt = `Analyze inventory and sales data to provide optimization recommendations:

Current Inventory: ${JSON.stringify(inventoryData.slice(0, 20), null, 2)}
Recent Sales: ${JSON.stringify(salesData.slice(0, 10), null, 2)}

Please provide:
1. Overstocked items that should be promoted
2. Understocked items that need reordering
3. Seasonal trends and recommendations
4. Optimal reorder points and quantities
5. Cost optimization opportunities

Format as JSON with keys: overstocked, understocked, seasonalTrends, reorderRecommendations, costOptimization`;

      const response = await axios.post(`${this.deepseekBaseUrl}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an inventory management expert specializing in supply chain optimization and demand forecasting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;
      return JSON.parse(aiResponse);
    } catch (error) {
      console.error('AI inventory optimization error:', error.message);
      return null;
    }
  }

  // AI-powered performance insights
  async generatePerformanceInsights(userMetrics, teamMetrics) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const prompt = `Analyze performance metrics and provide actionable insights:

User Metrics: ${JSON.stringify(userMetrics, null, 2)}
Team Metrics: ${JSON.stringify(teamMetrics, null, 2)}

Please provide:
1. Performance strengths and areas for improvement
2. Productivity recommendations
3. Training suggestions
4. Goal setting recommendations
5. Team collaboration insights

Format as JSON with keys: strengths, improvements, recommendations, training, collaboration`;

      const response = await axios.post(`${this.deepseekBaseUrl}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a performance management expert providing actionable insights for productivity improvement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 700,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = response.data.choices[0].message.content;
      return JSON.parse(aiResponse);
    } catch (error) {
      console.error('AI performance insights error:', error.message);
      return null;
    }
  }
}

module.exports = new AIService();

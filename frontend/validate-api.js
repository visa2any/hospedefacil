#!/usr/bin/env node
/**
 * HospedeFácil System Validation Script
 * Tests all API endpoints and validates system functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

class SystemValidator {
  constructor() {
    this.results = {
      api: { passed: 0, failed: 0, tests: [] },
      frontend: { passed: 0, failed: 0, tests: [] },
      data: { passed: 0, failed: 0, tests: [] },
      performance: { passed: 0, failed: 0, tests: [] },
      errors: []
    };
  }

  async validateSystem() {
    console.log('🔍 Starting HospedeFácil System Validation...\n');
    
    try {
      // Test API endpoints
      await this.testApiEndpoints();
      
      // Test data quality
      await this.testDataQuality();
      
      // Test performance
      await this.testPerformance();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Critical validation error:', error);
    }
  }

  async testApiEndpoints() {
    console.log('🔗 Testing API Endpoints...');
    
    // Test 1: Search API with local properties
    await this.testSearchAPI('local');
    
    // Test 2: Search API with all sources
    await this.testSearchAPI('all');
    
    // Test 3: Property details API
    await this.testPropertyDetailsAPI();
    
    console.log('');
  }

  async testSearchAPI(sourceType) {
    const testName = `Search API (${sourceType} properties)`;
    const startTime = Date.now();
    
    try {
      const payload = {
        destination: 'São Paulo',
        adults: 2,
        children: 0,
        limit: 5,
        includeLocal: sourceType === 'local' || sourceType === 'all',
        includeLiteApi: sourceType === 'liteapi' || sourceType === 'all'
      };

      const response = await fetch(`${API_BASE}/properties/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ ${testName}: ${data.data.properties.length} properties found (${responseTime}ms)`);
        
        // Validate response structure
        if (this.validateSearchResponse(data)) {
          this.results.api.passed++;
          this.results.api.tests.push({
            name: testName,
            status: 'passed',
            responseTime,
            propertyCount: data.data.properties.length,
            sources: data.metadata.source
          });
        } else {
          throw new Error('Invalid response structure');
        }
      } else {
        throw new Error(`API returned error: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${testName}: ${error.message}`);
      this.results.api.failed++;
      this.results.api.tests.push({
        name: testName,
        status: 'failed',
        error: error.message
      });
      this.results.errors.push({ test: testName, error: error.message });
    }
  }

  async testPropertyDetailsAPI() {
    const testName = 'Property Details API';
    const startTime = Date.now();
    
    try {
      // First get a property ID from search
      const searchResponse = await fetch(`${API_BASE}/properties/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: 'Rio de Janeiro',
          adults: 2,
          limit: 1,
          includeLocal: true,
          includeLiteApi: false
        }),
        timeout: 15000
      });

      const searchData = await searchResponse.json();
      if (!searchResponse.ok || !searchData.success || !searchData.data.properties.length) {
        throw new Error('Could not get property for testing');
      }

      const propertyId = searchData.data.properties[0].id;
      
      // Now test property details
      const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
        method: 'GET',
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ ${testName}: Property details retrieved (${responseTime}ms)`);
        this.results.api.passed++;
        this.results.api.tests.push({
          name: testName,
          status: 'passed',
          responseTime,
          propertyId
        });
      } else {
        throw new Error(`API returned error: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${testName}: ${error.message}`);
      this.results.api.failed++;
      this.results.api.tests.push({
        name: testName,
        status: 'failed',
        error: error.message
      });
      this.results.errors.push({ test: testName, error: error.message });
    }
  }

  async testDataQuality() {
    console.log('🏠 Testing Data Quality...');
    
    const testName = 'Data Quality Assessment';
    try {
      // Get sample properties from multiple cities
      const cities = ['São Paulo', 'Rio de Janeiro', 'Brasília'];
      let totalProperties = 0;
      let validProperties = 0;

      for (const city of cities) {
        const response = await fetch(`${API_BASE}/properties/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: city,
            adults: 2,
            limit: 10,
            includeLocal: true,
            includeLiteApi: false
          }),
          timeout: 15000
        });

        const data = await response.json();
        if (response.ok && data.success) {
          totalProperties += data.data.properties.length;
          
          // Validate each property
          for (const property of data.data.properties) {
            if (this.validatePropertyData(property)) {
              validProperties++;
            }
          }
        }
      }

      const validityRate = totalProperties > 0 ? (validProperties / totalProperties) * 100 : 0;
      
      if (validityRate >= 90) {
        console.log(`✅ ${testName}: ${validityRate.toFixed(1)}% data validity (${validProperties}/${totalProperties})`);
        this.results.data.passed++;
      } else {
        throw new Error(`Low data validity: ${validityRate.toFixed(1)}%`);
      }

      this.results.data.tests.push({
        name: testName,
        status: validityRate >= 90 ? 'passed' : 'failed',
        validityRate,
        totalProperties,
        validProperties
      });

    } catch (error) {
      console.log(`❌ ${testName}: ${error.message}`);
      this.results.data.failed++;
      this.results.errors.push({ test: testName, error: error.message });
    }
    
    console.log('');
  }

  async testPerformance() {
    console.log('⚡ Testing Performance...');
    
    const testName = 'Performance Test';
    try {
      const startTime = Date.now();
      
      // Test concurrent searches
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          fetch(`${API_BASE}/properties/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              destination: 'São Paulo',
              adults: 2,
              limit: 5,
              includeLocal: true,
              includeLiteApi: false
            }),
            timeout: 20000
          })
        );
      }

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / responses.length;

      let successCount = 0;
      for (const response of responses) {
        if (response.ok) {
          const data = await response.json();
          if (data.success) successCount++;
        }
      }

      if (successCount === responses.length && avgTime < 5000) {
        console.log(`✅ ${testName}: ${successCount}/${responses.length} requests succeeded (avg: ${avgTime.toFixed(0)}ms)`);
        this.results.performance.passed++;
      } else {
        throw new Error(`Performance issue: ${successCount}/${responses.length} succeeded, avg time: ${avgTime.toFixed(0)}ms`);
      }

      this.results.performance.tests.push({
        name: testName,
        status: 'passed',
        successRate: (successCount / responses.length) * 100,
        averageTime: avgTime
      });

    } catch (error) {
      console.log(`❌ ${testName}: ${error.message}`);
      this.results.performance.failed++;
      this.results.errors.push({ test: testName, error: error.message });
    }
    
    console.log('');
  }

  validateSearchResponse(data) {
    return data.success &&
           data.data &&
           Array.isArray(data.data.properties) &&
           data.data.pagination &&
           data.metadata;
  }

  validatePropertyData(property) {
    return property.id &&
           property.name &&
           property.location &&
           typeof property.basePricePerNight === 'number' &&
           property.basePricePerNight > 0 &&
           Array.isArray(property.images) &&
           property.source;
  }

  generateReport() {
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    
    const total = {
      passed: this.results.api.passed + this.results.frontend.passed + 
              this.results.data.passed + this.results.performance.passed,
      failed: this.results.api.failed + this.results.frontend.failed + 
              this.results.data.failed + this.results.performance.failed
    };

    console.log(`🔗 API Tests: ${this.results.api.passed} passed, ${this.results.api.failed} failed`);
    console.log(`🏠 Data Tests: ${this.results.data.passed} passed, ${this.results.data.failed} failed`);
    console.log(`⚡ Performance Tests: ${this.results.performance.passed} passed, ${this.results.performance.failed} failed`);
    console.log(`📊 TOTAL: ${total.passed} passed, ${total.failed} failed`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.results.errors.forEach(error => {
        console.log(`  • ${error.test}: ${error.error}`);
      });
    }

    const successRate = total.passed + total.failed > 0 ? 
      (total.passed / (total.passed + total.failed)) * 100 : 0;

    console.log(`\n🎯 Overall Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 90) {
      console.log('🎉 System validation PASSED!');
      process.exit(0);
    } else if (successRate >= 70) {
      console.log('⚠️ System validation passed with warnings');
      process.exit(0);
    } else {
      console.log('💥 System validation FAILED');
      process.exit(1);
    }
  }
}

// Run validation
if (require.main === module) {
  const validator = new SystemValidator();
  validator.validateSystem().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = SystemValidator;
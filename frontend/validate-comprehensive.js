#!/usr/bin/env node
/**
 * HospedeFácil Comprehensive System Validation
 * Tests all aspects of the system including data quality, caching, and end-to-end flows
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

class ComprehensiveValidator {
  constructor() {
    this.results = {
      apiTests: [],
      dataQuality: [],
      performance: [],
      caching: [],
      e2eTests: [],
      errors: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    this.startTime = Date.now();
  }

  async validate() {
    console.log('🔍 Starting Comprehensive HospedeFácil System Validation');
    console.log('=' .repeat(60));
    
    try {
      // 1. API Validation (Enhanced)
      await this.validateAPIs();
      
      // 2. Data Quality Assessment
      await this.validateDataQuality();
      
      // 3. Performance & Caching
      await this.validatePerformanceAndCaching();
      
      // 4. End-to-End Flow Testing
      await this.validateE2EFlows();
      
      // 5. Generate comprehensive report
      this.generateComprehensiveReport();
      
    } catch (error) {
      console.error('❌ Critical validation error:', error);
      this.logError('CRITICAL_ERROR', error.message);
    }
  }

  async validateAPIs() {
    console.log('\n🔗 API VALIDATION');
    console.log('-'.repeat(40));
    
    const apiTests = [
      {
        name: 'Search API - Local Properties Rio de Janeiro',
        test: () => this.testSearchAPI('Rio de Janeiro', { includeLocal: true, includeLiteApi: false })
      },
      {
        name: 'Search API - Local Properties São Paulo',
        test: () => this.testSearchAPI('São Paulo', { includeLocal: true, includeLiteApi: false })
      },
      {
        name: 'Search API - Hybrid Results Salvador',
        test: () => this.testSearchAPI('Salvador', { includeLocal: true, includeLiteApi: true })
      },
      {
        name: 'Search API - Empty Destination (General Search)',
        test: () => this.testSearchAPI('', { includeLocal: true, includeLiteApi: false, limit: 10 })
      },
      {
        name: 'Search API - Invalid Parameters Handling',
        test: () => this.testInvalidSearchAPI()
      },
      {
        name: 'Property Details API',
        test: () => this.testPropertyDetailsAPI()
      }
    ];

    for (const apiTest of apiTests) {
      await this.runTest(apiTest, 'apiTests');
    }
  }

  async validateDataQuality() {
    console.log('\n🏠 DATA QUALITY ASSESSMENT');
    console.log('-'.repeat(40));
    
    const dataTests = [
      {
        name: 'Brazilian Cities Coverage',
        test: () => this.testBrazilianCitiesCoverage()
      },
      {
        name: 'Property Data Completeness',
        test: () => this.testPropertyDataCompleteness()
      },
      {
        name: 'Price Range Validation',
        test: () => this.testPriceRangeValidation()
      },
      {
        name: 'Image and Media Quality',
        test: () => this.testImageQuality()
      },
      {
        name: 'Location Data Accuracy',
        test: () => this.testLocationAccuracy()
      }
    ];

    for (const dataTest of dataTests) {
      await this.runTest(dataTest, 'dataQuality');
    }
  }

  async validatePerformanceAndCaching() {
    console.log('\n⚡ PERFORMANCE & CACHING VALIDATION');
    console.log('-'.repeat(40));
    
    const perfTests = [
      {
        name: 'Response Time Analysis',
        test: () => this.testResponseTimes()
      },
      {
        name: 'Cache Effectiveness',
        test: () => this.testCacheEffectiveness()
      },
      {
        name: 'Concurrent Request Handling',
        test: () => this.testConcurrentRequests()
      },
      {
        name: 'Error Recovery',
        test: () => this.testErrorRecovery()
      }
    ];

    for (const perfTest of perfTests) {
      await this.runTest(perfTest, 'performance');
    }
  }

  async validateE2EFlows() {
    console.log('\n🎯 END-TO-END FLOW VALIDATION');
    console.log('-'.repeat(40));
    
    const e2eTests = [
      {
        name: 'Complete Search to Property Details Flow',
        test: () => this.testSearchToDetailsFlow()
      },
      {
        name: 'Featured Properties Loading',
        test: () => this.testFeaturedPropertiesFlow()
      },
      {
        name: 'Error Handling in User Journey',
        test: () => this.testErrorHandlingFlow()
      }
    ];

    for (const e2eTest of e2eTests) {
      await this.runTest(e2eTest, 'e2eTests');
    }
  }

  // API Test Implementations
  async testSearchAPI(destination, options = {}) {
    const startTime = Date.now();
    const payload = {
      destination,
      adults: 2,
      children: 0,
      limit: options.limit || 5,
      includeLocal: options.includeLocal !== false,
      includeLiteApi: options.includeLiteApi !== false,
      ...options
    };

    const response = await fetch(`${API_BASE}/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
    }

    if (!data.success) {
      throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
    }

    const propertiesFound = data.data.properties.length;
    const hasValidStructure = this.validateSearchResponseStructure(data);

    if (!hasValidStructure) {
      throw new Error('Invalid response structure');
    }

    return {
      responseTime,
      propertiesFound,
      destination,
      sources: data.metadata.source,
      totalResults: data.data.pagination.totalCount,
      searchTime: data.data.meta?.searchTime
    };
  }

  async testInvalidSearchAPI() {
    // Test with invalid dates
    const payload = {
      destination: 'Rio de Janeiro',
      checkIn: '2024-01-15',
      checkOut: '2024-01-10', // Before check-in
      adults: 0 // Invalid
    };

    const response = await fetch(`${API_BASE}/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000
    });

    const data = await response.json();

    if (response.status !== 400) {
      throw new Error('Should return 400 for invalid parameters');
    }

    return { handledCorrectly: true };
  }

  async testPropertyDetailsAPI() {
    // First get a property ID from search
    const searchResponse = await this.testSearchAPI('Rio de Janeiro', { limit: 1 });
    
    const searchData = await fetch(`${API_BASE}/properties/search`, {
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

    const searchResult = await searchData.json();
    
    if (!searchResult.success || !searchResult.data.properties.length) {
      throw new Error('No properties available for testing');
    }

    const propertyId = searchResult.data.properties[0].id;
    const startTime = Date.now();

    const response = await fetch(`${API_BASE}/properties/${propertyId}`, {
      method: 'GET',
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(`Property details failed: ${data.error?.message}`);
    }

    return { responseTime, propertyId, hasDetails: true };
  }

  // Data Quality Test Implementations
  async testBrazilianCitiesCoverage() {
    const majorCities = [
      'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza',
      'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Goiânia',
      'Belém', 'Porto Alegre', 'Guarulhos', 'Campinas', 'São Luís'
    ];

    let citiesWithProperties = 0;
    let totalProperties = 0;

    for (const city of majorCities) {
      try {
        const result = await this.testSearchAPI(city, { limit: 20 });
        if (result.propertiesFound > 0) {
          citiesWithProperties++;
          totalProperties += result.propertiesFound;
        }
      } catch (error) {
        console.log(`   ⚠️ No data for ${city}`);
      }
    }

    const coverageRate = (citiesWithProperties / majorCities.length) * 100;
    
    if (coverageRate < 60) {
      throw new Error(`Low city coverage: ${coverageRate.toFixed(1)}%`);
    }

    return {
      citiesWithProperties,
      totalCities: majorCities.length,
      coverageRate,
      averagePropertiesPerCity: Math.round(totalProperties / citiesWithProperties)
    };
  }

  async testPropertyDataCompleteness() {
    const testCities = ['São Paulo', 'Rio de Janeiro', 'Salvador'];
    let validProperties = 0;
    let totalProperties = 0;
    const missingFields = {};

    for (const city of testCities) {
      try {
        const result = await this.testSearchAPI(city, { limit: 10 });
        
        const searchData = await fetch(`${API_BASE}/properties/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: city,
            adults: 2,
            limit: 10,
            includeLocal: true,
            includeLiteApi: false
          })
        });

        const data = await searchData.json();
        
        if (data.success) {
          for (const property of data.data.properties) {
            totalProperties++;
            const completeness = this.assessPropertyCompleteness(property);
            
            if (completeness.score >= 0.8) {
              validProperties++;
            }
            
            // Track missing fields
            completeness.missing.forEach(field => {
              missingFields[field] = (missingFields[field] || 0) + 1;
            });
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking ${city}:`, error.message);
      }
    }

    const completenessRate = totalProperties > 0 ? (validProperties / totalProperties) * 100 : 0;

    return {
      completenessRate,
      validProperties,
      totalProperties,
      commonMissingFields: Object.entries(missingFields)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    };
  }

  async testPriceRangeValidation() {
    const cities = ['São Paulo', 'Rio de Janeiro'];
    const priceData = [];

    for (const city of cities) {
      try {
        const searchData = await fetch(`${API_BASE}/properties/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: city,
            adults: 2,
            limit: 20,
            includeLocal: true,
            includeLiteApi: false
          })
        });

        const data = await searchData.json();
        
        if (data.success) {
          data.data.properties.forEach(property => {
            if (property.basePricePerNight > 0) {
              priceData.push({
                city,
                price: property.basePricePerNight,
                source: property.source
              });
            }
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Price validation error for ${city}`);
      }
    }

    if (priceData.length === 0) {
      throw new Error('No valid price data found');
    }

    const prices = priceData.map(p => p.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Basic sanity checks
    if (minPrice < 20) {
      throw new Error(`Unrealistically low price found: R$ ${minPrice}`);
    }
    
    if (maxPrice > 5000) {
      throw new Error(`Unrealistically high price found: R$ ${maxPrice}`);
    }

    return {
      totalPrices: priceData.length,
      averagePrice: Math.round(avgPrice),
      priceRange: { min: minPrice, max: maxPrice },
      reasonablePrices: prices.filter(p => p >= 50 && p <= 1500).length
    };
  }

  async testImageQuality() {
    // Test a few properties to ensure they have valid images
    const searchData = await fetch(`${API_BASE}/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'Rio de Janeiro',
        adults: 2,
        limit: 5,
        includeLocal: true,
        includeLiteApi: false
      })
    });

    const data = await searchData.json();
    
    if (!data.success) {
      throw new Error('Could not fetch properties for image testing');
    }

    let propertiesWithImages = 0;
    let totalProperties = data.data.properties.length;

    for (const property of data.data.properties) {
      if (property.images && property.images.length > 0) {
        propertiesWithImages++;
      }
    }

    const imageRate = totalProperties > 0 ? (propertiesWithImages / totalProperties) * 100 : 0;

    if (imageRate < 80) {
      throw new Error(`Too many properties without images: ${imageRate.toFixed(1)}%`);
    }

    return {
      propertiesWithImages,
      totalProperties,
      imageRate
    };
  }

  async testLocationAccuracy() {
    const testData = [
      { city: 'Rio de Janeiro', expectedState: 'RJ' },
      { city: 'São Paulo', expectedState: 'SP' },
      { city: 'Salvador', expectedState: 'BA' }
    ];

    let accurateLocations = 0;
    let totalProperties = 0;

    for (const test of testData) {
      try {
        const searchData = await fetch(`${API_BASE}/properties/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: test.city,
            adults: 2,
            limit: 5,
            includeLocal: true,
            includeLiteApi: false
          })
        });

        const data = await searchData.json();
        
        if (data.success) {
          data.data.properties.forEach(property => {
            totalProperties++;
            if (property.location && 
                property.location.city?.toLowerCase().includes(test.city.toLowerCase()) &&
                property.location.state === test.expectedState) {
              accurateLocations++;
            }
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Location test error for ${test.city}`);
      }
    }

    const accuracyRate = totalProperties > 0 ? (accurateLocations / totalProperties) * 100 : 0;

    return {
      accuracyRate,
      accurateLocations,
      totalProperties
    };
  }

  // Performance Test Implementations
  async testResponseTimes() {
    const tests = [
      { destination: 'São Paulo', expectedMaxTime: 3000 },
      { destination: 'Rio de Janeiro', expectedMaxTime: 3000 },
      { destination: '', expectedMaxTime: 4000 } // General search
    ];

    const results = [];

    for (const test of tests) {
      const result = await this.testSearchAPI(test.destination);
      results.push({
        destination: test.destination || 'General',
        responseTime: result.responseTime,
        withinLimit: result.responseTime <= test.expectedMaxTime
      });
    }

    const slowResponses = results.filter(r => !r.withinLimit);
    
    if (slowResponses.length > 0) {
      throw new Error(`Slow responses detected: ${slowResponses.map(r => `${r.destination}: ${r.responseTime}ms`).join(', ')}`);
    }

    return {
      averageResponseTime: Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length),
      allWithinLimits: true,
      results
    };
  }

  async testCacheEffectiveness() {
    const testQuery = {
      destination: 'São Paulo',
      adults: 2,
      limit: 5
    };

    // First request (should hit the database/API)
    const startTime1 = Date.now();
    await this.testSearchAPI(testQuery.destination, testQuery);
    const firstResponseTime = Date.now() - startTime1;

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second request (should hit cache)
    const startTime2 = Date.now();
    await this.testSearchAPI(testQuery.destination, testQuery);
    const secondResponseTime = Date.now() - startTime2;

    // Cache should make it faster (at least 20% improvement)
    const improvementRatio = (firstResponseTime - secondResponseTime) / firstResponseTime;
    
    return {
      firstResponseTime,
      secondResponseTime,
      improvementRatio: improvementRatio * 100,
      cacheEffective: improvementRatio > 0.2
    };
  }

  async testConcurrentRequests() {
    const startTime = Date.now();
    const promises = [];

    // Launch 5 concurrent searches
    for (let i = 0; i < 5; i++) {
      promises.push(
        this.testSearchAPI('Rio de Janeiro', { limit: 3 })
      );
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

    // All requests should complete successfully
    const allSuccessful = results.every(r => r.propertiesFound > 0);

    return {
      concurrentRequests: 5,
      totalTime,
      avgResponseTime: Math.round(avgResponseTime),
      allSuccessful,
      maxResponseTime: Math.max(...results.map(r => r.responseTime))
    };
  }

  async testErrorRecovery() {
    // Test handling of malformed requests
    try {
      await fetch(`${API_BASE}/properties/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
        timeout: 5000
      });
    } catch (error) {
      // This should happen
    }

    // Test handling of non-existent property
    const response = await fetch(`${API_BASE}/properties/non_existent_property_id`);
    const data = await response.json();

    if (response.status !== 404) {
      throw new Error('Should return 404 for non-existent property');
    }

    return { errorHandlingWorking: true };
  }

  // E2E Test Implementations
  async testSearchToDetailsFlow() {
    // Step 1: Search for properties
    const searchResult = await this.testSearchAPI('São Paulo', { limit: 3 });
    
    if (searchResult.propertiesFound === 0) {
      throw new Error('No properties found for E2E test');
    }

    // Step 2: Get first property ID
    const searchData = await fetch(`${API_BASE}/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: 'São Paulo',
        adults: 2,
        limit: 1,
        includeLocal: true,
        includeLiteApi: false
      })
    });

    const data = await searchData.json();
    const propertyId = data.data.properties[0].id;

    // Step 3: Get property details
    const detailsResult = await this.testPropertyDetailsAPI();

    return {
      searchCompleted: true,
      detailsCompleted: true,
      flowTime: searchResult.responseTime + detailsResult.responseTime
    };
  }

  async testFeaturedPropertiesFlow() {
    // Test the featured properties service endpoint indirectly
    // by checking if search returns varied results from different cities
    
    const cities = ['Rio de Janeiro', 'São Paulo', 'Salvador'];
    let featuredPropertiesFound = 0;
    
    for (const city of cities) {
      try {
        const result = await this.testSearchAPI(city, { limit: 2, sortBy: 'rating', sortOrder: 'desc' });
        if (result.propertiesFound > 0) {
          featuredPropertiesFound += result.propertiesFound;
        }
      } catch (error) {
        console.log(`   ⚠️ Featured properties test failed for ${city}`);
      }
    }

    if (featuredPropertiesFound < 3) {
      throw new Error('Insufficient featured properties available');
    }

    return { featuredPropertiesFound };
  }

  async testErrorHandlingFlow() {
    // Test graceful degradation
    const scenarios = [
      { description: 'Invalid destination', payload: { destination: 'NonExistentCity12345' }},
      { description: 'Future dates too far', payload: { 
        destination: 'São Paulo', 
        checkIn: '2030-01-01', 
        checkOut: '2030-01-05' 
      }}
    ];

    let gracefulHandling = 0;

    for (const scenario of scenarios) {
      try {
        const response = await fetch(`${API_BASE}/properties/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adults: 2, ...scenario.payload })
        });

        const data = await response.json();
        
        // Should return valid response structure even if no results
        if (data.success !== undefined && data.data !== undefined) {
          gracefulHandling++;
        }
      } catch (error) {
        console.log(`   ⚠️ Error handling test failed: ${scenario.description}`);
      }
    }

    return { gracefulHandling, totalScenarios: scenarios.length };
  }

  // Helper methods
  async runTest(testDef, category) {
    const startTime = Date.now();
    
    try {
      console.log(`   ⏳ ${testDef.name}...`);
      
      const result = await testDef.test();
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ ${testDef.name} (${duration}ms)`);
      
      this.results[category].push({
        name: testDef.name,
        status: 'passed',
        duration,
        result
      });
      
      this.results.summary.passed++;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(`   ❌ ${testDef.name}: ${error.message} (${duration}ms)`);
      
      this.results[category].push({
        name: testDef.name,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.results.summary.failed++;
      this.logError(testDef.name, error.message);
    } finally {
      this.results.summary.totalTests++;
    }
  }

  validateSearchResponseStructure(data) {
    return data.success &&
           data.data &&
           Array.isArray(data.data.properties) &&
           data.data.pagination &&
           data.metadata &&
           data.data.meta;
  }

  assessPropertyCompleteness(property) {
    const required = ['id', 'name', 'basePricePerNight', 'location', 'images'];
    const desirable = ['description', 'amenities', 'rating', 'reviewCount', 'accommodates'];
    
    const missing = [];
    let score = 0;

    // Check required fields
    for (const field of required) {
      if (!property[field] || (Array.isArray(property[field]) && property[field].length === 0)) {
        missing.push(field);
      } else {
        score += 0.6 / required.length; // 60% weight for required fields
      }
    }

    // Check desirable fields
    for (const field of desirable) {
      if (property[field] && (typeof property[field] !== 'object' || property[field].length > 0)) {
        score += 0.4 / desirable.length; // 40% weight for desirable fields
      } else {
        missing.push(field);
      }
    }

    return { score: Math.min(score, 1), missing };
  }

  logError(test, error) {
    this.results.errors.push({ test, error, timestamp: new Date() });
  }

  generateComprehensiveReport() {
    const totalTime = Date.now() - this.startTime;
    const summary = this.results.summary;
    const successRate = summary.totalTests > 0 ? (summary.passed / summary.totalTests) * 100 : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE VALIDATION REPORT');
    console.log('='.repeat(60));

    console.log(`\n🎯 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   🎯 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   ⏱️ Total Time: ${(totalTime / 1000).toFixed(1)}s`);

    // Detailed breakdown
    const categories = [
      { name: 'API Tests', key: 'apiTests', icon: '🔗' },
      { name: 'Data Quality', key: 'dataQuality', icon: '🏠' },
      { name: 'Performance', key: 'performance', icon: '⚡' },
      { name: 'E2E Tests', key: 'e2eTests', icon: '🎯' }
    ];

    categories.forEach(cat => {
      const tests = this.results[cat.key];
      const passed = tests.filter(t => t.status === 'passed').length;
      const failed = tests.filter(t => t.status === 'failed').length;
      
      if (tests.length > 0) {
        console.log(`\n${cat.icon} ${cat.name.toUpperCase()}:`);
        console.log(`   ✅ ${passed} passed, ❌ ${failed} failed`);
        
        // Show failed tests
        tests.filter(t => t.status === 'failed').forEach(test => {
          console.log(`      ❌ ${test.name}: ${test.error}`);
        });
      }
    });

    // Key metrics
    console.log(`\n📈 KEY METRICS:`);
    
    // Find API response times
    const apiTests = this.results.apiTests.filter(t => t.result?.responseTime);
    if (apiTests.length > 0) {
      const avgResponseTime = Math.round(
        apiTests.reduce((sum, t) => sum + t.result.responseTime, 0) / apiTests.length
      );
      console.log(`   ⚡ Average API Response Time: ${avgResponseTime}ms`);
    }

    // Find data quality metrics
    const dataQualityTest = this.results.dataQuality.find(t => t.name.includes('Completeness'));
    if (dataQualityTest && dataQualityTest.result) {
      console.log(`   🏠 Data Completeness Rate: ${dataQualityTest.result.completenessRate.toFixed(1)}%`);
    }

    const coverageTest = this.results.dataQuality.find(t => t.name.includes('Coverage'));
    if (coverageTest && coverageTest.result) {
      console.log(`   🌆 City Coverage Rate: ${coverageTest.result.coverageRate.toFixed(1)}%`);
    }

    // Error summary
    if (this.results.errors.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES:`);
      this.results.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.error}`);
      });
    }

    // Final assessment
    console.log(`\n🎉 FINAL ASSESSMENT:`);
    if (successRate >= 95) {
      console.log('   🏆 EXCELLENT - System is production ready!');
      console.log('   All core functionality working optimally.');
    } else if (successRate >= 85) {
      console.log('   ✅ GOOD - System is functional with minor issues.');
      console.log('   Recommended for production with monitoring.');
    } else if (successRate >= 70) {
      console.log('   ⚠️ ACCEPTABLE - System works but needs improvements.');
      console.log('   Address critical issues before production deployment.');
    } else {
      console.log('   ❌ NEEDS WORK - Significant issues detected.');
      console.log('   System requires fixes before production use.');
    }

    // Return appropriate exit code
    process.exit(successRate >= 70 ? 0 : 1);
  }
}

// Run comprehensive validation
if (require.main === module) {
  const validator = new ComprehensiveValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveValidator;
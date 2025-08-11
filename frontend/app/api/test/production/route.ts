// Production Test API Endpoint - System validation and health testing
import { NextRequest, NextResponse } from 'next/server'
import { productionTestSuite, productionReadinessChecker } from '@/lib/tests/integration-tests'
import { requireAdmin, withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'

async function productionTestHandler(request: NextRequest, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('type') || 'full'
    const skipNonCritical = searchParams.get('skipNonCritical') === 'true'

    console.log(`🧪 Production test requested: ${testType} by ${user.email}`)

    let results

    switch (testType) {
      case 'readiness':
        results = await productionReadinessChecker.checkReadiness()
        break
      
      case 'full':
      default:
        results = await productionTestSuite.runAllTests()
        break
    }

    // Log test execution
    console.log(`✅ Production tests completed: ${JSON.stringify(results.summary || results)}`)

    return NextResponse.json({
      success: true,
      testType,
      data: results,
      metadata: {
        timestamp: new Date(),
        requestedBy: user.email,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      }
    })

  } catch (error) {
    console.error('❌ Production test failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Test execution failed',
        message: error.message
      },
      { status: 500 }
    )
  }
}

// Apply middleware chain
const handler = withSecurity(
  withCors(
    withRateLimit(
      requireAdmin(productionTestHandler),
      {
        maxRequests: 5, // Limit test runs
        windowMs: 15 * 60 * 1000, // per 15 minutes
        keyGenerator: (req) => 'production_tests'
      }
    ),
    {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['GET', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true
    }
  )
)

export { handler as GET }
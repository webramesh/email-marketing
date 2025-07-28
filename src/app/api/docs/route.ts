/**
 * API Documentation endpoint
 * Serves OpenAPI/Swagger specification
 */

import { NextRequest, NextResponse } from 'next/server'
import { swaggerSpec } from '@/lib/api/documentation'

/**
 * GET /api/docs
 * Get OpenAPI specification
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(swaggerSpec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error) {
    console.error('Error serving API documentation:', error)
    return NextResponse.json(
      { error: 'Failed to load API documentation' },
      { status: 500 }
    )
  }
}
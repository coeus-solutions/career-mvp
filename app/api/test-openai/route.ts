import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key' }, { status: 500 });
  }

  try {
    // Test the API key with a simple models endpoint
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ 
        error: 'API key validation failed',
        status: response.status,
        message: error
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Check if realtime models are available
    const realtimeModels = data.data.filter((model: { id: string }) => 
      model.id.includes('realtime') || model.id.includes('gpt-4o')
    );

    return NextResponse.json({
      success: true,
      totalModels: data.data.length,
      realtimeModels: realtimeModels.map((m: { id: string }) => m.id),
      apiKeyValid: true
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to test API key',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
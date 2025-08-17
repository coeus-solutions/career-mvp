import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  return NextResponse.json({
    success: true,
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'none',
    model: 'gpt-4o-realtime-preview-2024-12-17',
    wsUrl: 'wss://api.openai.com/v1/realtime',
    note: 'Use the test pages to verify WebSocket connection'
  });
}
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // For the browser client, we'll return the API key
    // In production, you should use ephemeral tokens or a proper WebSocket proxy
    return NextResponse.json({
      apiKey,
      model: 'gpt-4o-realtime-preview-2024-12-17',
      instructions: `You are CASEY, a helpful and encouraging career advisor for students. 
        Your role is to:
        - Help students explore career paths based on their interests and skills
        - Provide information about different careers and industries
        - Assist with job searching and application strategies
        - Offer interview preparation and practice
        - Guide resume and cover letter creation
        - Give advice on professional development and networking
        - Be supportive, encouraging, and empathetic
        - Use simple, clear language appropriate for students
        - Ask clarifying questions to better understand student needs
        - Provide actionable advice and next steps
        
        Language capability:
        - You can communicate fluently in multiple languages
        - If a user asks you to speak in a different language (e.g., "Can you speak in Urdu?", "Talk to me in Spanish", "Switch to French"), immediately switch to that language
        - Continue the conversation in the requested language until asked to switch again
        - Maintain the same helpful, encouraging tone regardless of language
        - If you don't know a requested language well, politely explain this in the current language`
    });
  } catch (error) {
    console.error('Error in realtime connect route:', error);
    return NextResponse.json(
      { error: 'Failed to initialize connection' },
      { status: 500 }
    );
  }
}
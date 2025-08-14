import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, sourceLanguage } = await request.json();
    
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    // Use OpenAI GPT to translate the text
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the given text from ${sourceLanguage || 'the detected language'} to ${targetLanguage}. Provide only the translation without any additional text or explanations.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
    });

    const translation = completion.choices[0]?.message?.content?.trim();

    if (!translation) {
      throw new Error('No translation received');
    }

    return NextResponse.json({
      success: true,
      translation,
      sourceLanguage: sourceLanguage || 'auto-detected',
      targetLanguage,
      originalText: text,
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    );
  }
}

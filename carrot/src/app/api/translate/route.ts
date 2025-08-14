import { NextRequest, NextResponse } from 'next/server';

// Free translation service using LibreTranslate or Google Translate API
const TRANSLATION_SERVICE_URL = process.env.TRANSLATION_SERVICE_URL || 'https://libretranslate.de/translate';

export async function POST(request: NextRequest) {
  let text: string | undefined;
  let targetLanguage: string | undefined;
  let sourceLanguage: string = 'auto';
  
  try {
    const requestData = await request.json();
    text = requestData.text;
    targetLanguage = requestData.targetLanguage;
    sourceLanguage = requestData.sourceLanguage || 'auto';

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: 'text and targetLanguage are required' }, { status: 400 });
    }

    console.log(`🌍 Translating text to ${targetLanguage}...`);

    // Use LibreTranslate (free, open-source translation service)
    const response = await fetch(TRANSLATION_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      }),
    });

    if (!response.ok) {
      console.error(`Translation service error: ${response.status}`);
      throw new Error(`Translation service returned ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.translatedText) {
      throw new Error('No translation returned from service');
    }

    console.log(`✅ Translation completed: ${text.substring(0, 50)}... → ${result.translatedText.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      translation: result.translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      originalText: text
    });

  } catch (error) {
    console.error('Translation API error:', error);
    
    // Fallback: Return a simple message if translation fails
    return NextResponse.json({
      success: false,
      error: 'Translation service temporarily unavailable',
      translation: `[Translation temporarily unavailable]`,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage: targetLanguage || 'en',
      originalText: text || ''
    }, { status: 200 }); // Return 200 with fallback message instead of error
  }
}

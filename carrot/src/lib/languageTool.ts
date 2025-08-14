/**
 * LanguageTool grammar cleanup service
 * Uses the free LanguageTool API to fix grammar, punctuation, and capitalization
 */

interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: {
    id: string;
    description: string;
    category: {
      id: string;
      name: string;
    };
  };
}

interface LanguageToolResponse {
  software: {
    name: string;
    version: string;
  };
  warnings: {
    incompleteResults: boolean;
  };
  language: {
    name: string;
    code: string;
  };
  matches: LanguageToolMatch[];
}

/**
 * Enhanced speech-specific rules for transcript processing
 */
function applyEnhancedSpeechRules(text: string): { processed: string; rulesApplied: number } {
  let processed = text;
  let rulesApplied = 0;
  
  // Enhanced speech-specific rules
  const speechFixes = [
    // Domain-specific fixes (your specific use case)
    { from: /\bcare patch\b/gi, to: 'Carrot Patch' },
    { from: /\bcarrot\b(?=.*(?:sidebar|categories|app))/gi, to: 'Carrot' },
    { from: /\brabbit\b(?=.*(?:ai|AI|assistant))/gi, to: 'Rabbit' },
    
    // Speech flow improvements
    { from: /\bcoming to play\b/gi, to: 'coming into play' },
    { from: /\bin other\b/gi, to: 'and other' },
    { from: /\bI'm so basically\b/gi, to: 'So basically' },
    
    // Common speech contractions
    { from: /\bshould of\b/gi, to: 'should have' },
    { from: /\bcould of\b/gi, to: 'could have' },
    { from: /\bwould of\b/gi, to: 'would have' },
    
    // Punctuation improvements
    { from: /(\w+)\s+but\s+/gi, to: '$1, but ' },
    { from: /\bso basically\b/gi, to: '. So basically,' },
    
    // Sentence structure
    { from: /\.\s+([a-z])/g, to: (match: string, letter: string) => '. ' + letter.toUpperCase() },
    { from: /\b(\w+)\s+\1\b/gi, to: '$1' }, // Remove repeated words
    
    // Clean up spacing
    { from: /\s+/g, to: ' ' },
    { from: /^\s+|\s+$/g, to: '' }
  ];
  
  // Apply each rule and track changes
  for (const fix of speechFixes) {
    const before = processed;
    processed = processed.replace(fix.from, fix.to);
    if (before !== processed) {
      rulesApplied++;
    }
  }
  
  return { processed, rulesApplied };
}

/**
 * Enhanced grammar cleanup with speech-specific rules for transcripts
 * @param text Raw transcription text to clean up
 * @returns Promise<string> Cleaned up text with proper grammar and speech corrections
 */
export async function cleanupGrammar(text: string): Promise<string> {
  try {
    console.log('🎯 Starting enhanced LanguageTool grammar cleanup for text:', text.substring(0, 50) + '...');
    
    // First apply our enhanced speech-specific rules
    const speechResult = applyEnhancedSpeechRules(text);
    console.log(`✅ Applied ${speechResult.rulesApplied} speech-specific rules`);
    
    // Then use LanguageTool API for additional grammar checking
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: speechResult.processed, // Use speech-enhanced text for LanguageTool
        language: 'en-US',
        enabledOnly: 'false'
      })
    });

    if (!response.ok) {
      console.error('❌ LanguageTool API error:', response.status, response.statusText);
      return speechResult.processed; // Return speech-enhanced text if API fails
    }

    const result: LanguageToolResponse = await response.json();
    console.log(`🔧 LanguageTool found ${result.matches.length} additional grammar issues`);

    // Apply corrections in reverse order to maintain correct offsets
    let correctedText = speechResult.processed; // Start with speech-enhanced text
    const sortedMatches = result.matches
      .filter(match => match.replacements.length > 0)
      .sort((a, b) => b.offset - a.offset); // Sort by offset descending

    let appliedFixes = 0;
    for (const match of sortedMatches) {
      const replacement = match.replacements[0].value;
      const before = correctedText.substring(match.offset, match.offset + match.length);
      
      // Apply the correction
      correctedText = 
        correctedText.substring(0, match.offset) + 
        replacement + 
        correctedText.substring(match.offset + match.length);
      
      console.log(`🔧 Fixed: "${before}" → "${replacement}" (${match.rule.category.name})`);
      appliedFixes++;
    }

    // Basic capitalization fix for first letter if not already handled
    if (correctedText.length > 0 && correctedText[0] !== correctedText[0].toUpperCase()) {
      correctedText = correctedText[0].toUpperCase() + correctedText.slice(1);
      console.log('🔧 Applied first letter capitalization');
    }

    // Basic punctuation fix for end of sentence if not already handled
    const lastChar = correctedText.trim().slice(-1);
    if (lastChar && !'.!?'.includes(lastChar)) {
      correctedText = correctedText.trim() + '.';
      console.log('🔧 Added ending punctuation');
    }

    console.log(`✅ Enhanced grammar cleanup completed: ${speechResult.rulesApplied} speech rules + ${appliedFixes} LanguageTool fixes applied`);
    console.log('🔧 Final enhanced text:', correctedText);
    
    return correctedText;

  } catch (error) {
    console.error('❌ LanguageTool API failed, using enhanced speech rules only:', error);
    // Return speech-enhanced text if LanguageTool API fails
    const fallbackResult = applyEnhancedSpeechRules(text);
    console.log(`✅ Fallback: Applied ${fallbackResult.rulesApplied} speech-specific rules`);
    return fallbackResult.processed;
  }
}

/**
 * Simple fallback grammar cleanup for basic issues
 * Used as backup if LanguageTool API is unavailable
 */
export function basicGrammarCleanup(text: string): string {
  let cleaned = text.trim();
  
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }
  
  // Add ending punctuation if missing
  const lastChar = cleaned.slice(-1);
  if (lastChar && !'.!?'.includes(lastChar)) {
    cleaned += '.';
  }
  
  // Fix common issues
  cleaned = cleaned.replace(/\bi\b/g, 'I'); // Fix lowercase "i"
  cleaned = cleaned.replace(/\s+/g, ' '); // Fix multiple spaces
  
  return cleaned;
}

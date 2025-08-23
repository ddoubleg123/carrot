#!/usr/bin/env python3

import os
import json
import tempfile
import logging
from flask import Flask, request, jsonify
import vosk
import soundfile as sf
import numpy as np
from pydub import AudioSegment
import requests
try:
    from google.cloud import firestore  # type: ignore
    from google.cloud import storage  # type: ignore
except Exception as e:  # pragma: no cover
    firestore = None  # type: ignore
    storage = None  # type: ignore
    logger.warning(f"Google Cloud libraries unavailable: {e}")
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize Vosk model
MODEL_PATH = os.environ.get('MODEL_PATH', '/app/models/vosk-model-small-en-us-0.15')
model = vosk.Model(MODEL_PATH)

# Initialize Google Cloud clients (optional)
db = None
storage_client = None
try:
    if firestore is not None:
        db = firestore.Client()
    if storage is not None:
        storage_client = storage.Client()
except Exception as e:  # pragma: no cover
    logger.warning(f"Google Cloud clients not initialized (continuing without GCP): {e}")

def download_audio_from_firebase(audio_url):
    """Download audio file from Firebase Storage"""
    try:
        response = requests.get(audio_url, timeout=30)
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.error(f"Failed to download audio: {e}")
        raise

def convert_audio_to_wav(audio_data):
    """Convert audio to WAV format suitable for Vosk"""
    try:
        # Save audio data to temporary file
        with tempfile.NamedTemporaryFile(suffix='.audio', delete=False) as temp_input:
            temp_input.write(audio_data)
            temp_input_path = temp_input.name

        # Convert to WAV using pydub
        audio = AudioSegment.from_file(temp_input_path)
        
        # Convert to mono, 16kHz (Vosk requirements)
        audio = audio.set_channels(1)
        audio = audio.set_frame_rate(16000)
        
        # Export to WAV
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_output:
            audio.export(temp_output.name, format="wav")
            temp_output_path = temp_output.name
        
        # Clean up input file
        os.unlink(temp_input_path)
        
        return temp_output_path
    except Exception as e:
        logger.error(f"Failed to convert audio: {e}")
        raise

def transcribe_audio(wav_file_path):
    """Transcribe audio using Vosk"""
    try:
        # Read audio file
        data, samplerate = sf.read(wav_file_path)
        
        # Ensure 16kHz sample rate
        if samplerate != 16000:
            logger.warning(f"Audio sample rate is {samplerate}, expected 16000")
        
        # Create recognizer
        rec = vosk.KaldiRecognizer(model, samplerate)
        rec.SetWords(True)
        
        # Process audio in chunks
        results = []
        chunk_size = 4000
        
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            
            # Convert to bytes
            chunk_bytes = (chunk * 32767).astype(np.int16).tobytes()
            
            if rec.AcceptWaveform(chunk_bytes):
                result = json.loads(rec.Result())
                if result.get('text'):
                    results.append(result['text'])
        
        # Get final result
        final_result = json.loads(rec.FinalResult())
        if final_result.get('text'):
            results.append(final_result['text'])
        
        # Combine all results
        full_transcription = ' '.join(results).strip()
        
        return full_transcription if full_transcription else "No speech detected in audio."
        
    except Exception as e:
        logger.error(f"Failed to transcribe audio: {e}")
        raise

def cleanup_transcription_with_languagetool(raw_text, language='en-US'):
    """Enhanced transcription cleanup using LanguageTool API with improved processing"""
    try:
        logger.info(f"Starting enhanced LanguageTool grammar cleanup for text: '{raw_text[:100]}...'")
        
        # Pre-process text for better LanguageTool results
        preprocessed_text = preprocess_transcription(raw_text)
        logger.info(f"Preprocessed text: '{preprocessed_text[:100]}...'")
        
        # LanguageTool public API endpoint (free)
        languagetool_url = "https://api.languagetool.org/v2/check"
        
        # Enhanced request data with more comprehensive checking
        data = {
            'text': preprocessed_text,
            'language': language,
            'enabledOnly': 'false',
            'disabledRules': '',  # Enable all rules for comprehensive checking
            'enabledCategories': 'TYPOS,GRAMMAR,PUNCTUATION,STYLE,REDUNDANCY'
        }
        
        logger.info(f"Making LanguageTool API request to: {languagetool_url}")
        
        # Make request to LanguageTool API with longer timeout
        response = requests.post(languagetool_url, data=data, timeout=15)
        logger.info(f"LanguageTool API response status: {response.status_code}")
        
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"LanguageTool API response: {result}")
        
        # Apply corrections to the text with enhanced logic
        cleaned_text = preprocessed_text
        matches = result.get('matches', [])
        
        logger.info(f"LanguageTool found {len(matches)} potential improvements")
        
        # Filter and prioritize matches for better results
        filtered_matches = filter_languagetool_matches(matches)
        
        # Sort matches by offset in descending order to avoid position shifts
        filtered_matches.sort(key=lambda x: x['offset'], reverse=True)
        
        corrections_applied = 0
        for match in filtered_matches:
            if match.get('replacements') and len(match['replacements']) > 0:
                # Get the best replacement suggestion
                replacement = match['replacements'][0]['value']
                offset = match['offset']
                length = match['length']
                
                # Apply the replacement
                cleaned_text = (
                    cleaned_text[:offset] + 
                    replacement + 
                    cleaned_text[offset + length:]
                )
                corrections_applied += 1
        
        # Post-process for transcription-specific improvements
        cleaned_text = postprocess_transcription(cleaned_text)
        
        logger.info(f"LanguageTool cleanup completed. Applied {corrections_applied} corrections. Original: {len(raw_text)} chars, Cleaned: {len(cleaned_text)} chars")
        return cleaned_text
        
    except Exception as e:
        logger.error(f"LanguageTool cleanup failed: {e}")
        # Return enhanced basic cleanup if LanguageTool fails
        return enhanced_basic_cleanup(raw_text)

def preprocess_transcription(text):
    """Enhanced pre-processing with advanced speech-specific rules for transcription text"""
    try:
        logger.info(f"🎯 Starting enhanced speech preprocessing for: '{text[:50]}...'")
        
        # Clean up common transcription artifacts
        text = text.strip()
        rules_applied = 0
        
        # ENHANCED SPEECH-SPECIFIC RULES
        
        # Domain-specific fixes (Carrot app context)
        original_text = text
        text = re.sub(r'\bcare patch\b', 'Carrot Patch', text, flags=re.IGNORECASE)
        text = re.sub(r'\bcarrot\b(?=.*(?:sidebar|categories|app))', 'Carrot', text, flags=re.IGNORECASE)
        text = re.sub(r'\brabbit\b(?=.*(?:ai|AI|assistant))', 'Rabbit', text, flags=re.IGNORECASE)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Applied domain-specific corrections (Carrot Patch, Carrot, Rabbit)")
        
        # Speech flow improvements
        original_text = text
        text = re.sub(r'\bcoming to play\b', 'coming into play', text, flags=re.IGNORECASE)
        text = re.sub(r'\bin other\b', 'and other', text, flags=re.IGNORECASE)
        text = re.sub(r'\bI\'m so basically\b', 'So basically', text, flags=re.IGNORECASE)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Applied speech flow improvements")
        
        # Common speech contractions (enhanced)
        original_text = text
        text = re.sub(r'\bshould of\b', 'should have', text, flags=re.IGNORECASE)
        text = re.sub(r'\bcould of\b', 'could have', text, flags=re.IGNORECASE)
        text = re.sub(r'\bwould of\b', 'would have', text, flags=re.IGNORECASE)
        text = re.sub(r'\bwe\'re going to\b', 'we will', text, flags=re.IGNORECASE)
        text = re.sub(r'\bgoing to\b', 'will', text, flags=re.IGNORECASE)
        text = re.sub(r'\bkinda\b', 'kind of', text, flags=re.IGNORECASE)
        text = re.sub(r'\bgonna\b', 'going to', text, flags=re.IGNORECASE)
        text = re.sub(r'\bwanna\b', 'want to', text, flags=re.IGNORECASE)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Applied enhanced contraction corrections")
        
        # Remove repeated words
        original_text = text
        text = re.sub(r'\b(\w+)\s+\1\b', r'\1', text, flags=re.IGNORECASE)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Removed repeated words")
        
        # Enhanced punctuation for run-on sentences
        original_text = text
        text = re.sub(r'(\w+)\s+but\s+', r'\1, but ', text, flags=re.IGNORECASE)
        text = re.sub(r'\bso basically\b', '. So basically,', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(and|but|so|then|now|well|okay)\s+', r'\1, ', text, flags=re.IGNORECASE)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Applied enhanced punctuation rules")
        
        # Capitalize after periods
        original_text = text
        text = re.sub(r'\.\s+([a-z])', lambda m: '. ' + m.group(1).upper(), text)
        if text != original_text:
            rules_applied += 1
            logger.info("✅ Applied sentence capitalization")
        
        # Normalize whitespace and ensure first letter is capitalized
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        if text:
            text = text[0].upper() + text[1:]
            
        logger.info(f"🎉 Enhanced preprocessing completed: {rules_applied} rule categories applied")
        logger.info(f"📝 Enhanced result: '{text[:100]}...'")
        
        return text
        
    except Exception as e:
        logger.error(f"Preprocessing failed: {e}")
        return text

def filter_languagetool_matches(matches):
    """Filter and prioritize LanguageTool matches for better transcription results"""
    try:
        filtered = []
        
        for match in matches:
            rule_id = match.get('rule', {}).get('id', '')
            category = match.get('rule', {}).get('category', {}).get('id', '')
            
            # Prioritize important grammar and punctuation fixes
            if any(priority in rule_id.upper() or priority in category.upper() for priority in [
                'PUNCTUATION', 'GRAMMAR', 'TYPOS', 'UPPERCASE_SENTENCE_START',
                'MISSING_COMMA', 'SENTENCE_FRAGMENT', 'RUN_ON_SENTENCE'
            ]):
                filtered.append(match)
            
            # Include style improvements but with lower priority
            elif 'STYLE' in category.upper() and len(match.get('replacements', [])) > 0:
                # Only include style changes that are clearly better
                original = match.get('context', {}).get('text', '')[match.get('context', {}).get('offset', 0):match.get('context', {}).get('offset', 0) + match.get('context', {}).get('length', 0)]
                replacement = match['replacements'][0]['value']
                
                # Avoid overly complex style changes
                if len(replacement) <= len(original) * 1.5:
                    filtered.append(match)
        
        logger.info(f"Filtered {len(matches)} matches down to {len(filtered)} high-priority corrections")
        return filtered
        
    except Exception as e:
        logger.error(f"Match filtering failed: {e}")
        return matches

def postprocess_transcription(text):
    """Post-process transcription for final improvements"""
    try:
        # Ensure proper sentence endings
        text = text.strip()
        if text and not text.endswith(('.', '!', '?')):
            text += '.'
        
        # Fix spacing around punctuation
        text = re.sub(r'\s+([,.!?;:])', r'\1', text)
        text = re.sub(r'([.!?])\s*([a-z])', lambda m: m.group(1) + ' ' + m.group(2).upper(), text)
        
        # Clean up multiple spaces
        text = re.sub(r'\s+', ' ', text)
        
        # Ensure proper capitalization after sentence breaks
        sentences = re.split(r'([.!?]\s*)', text)
        cleaned_sentences = []
        
        for i, sentence in enumerate(sentences):
            if i % 2 == 0 and sentence.strip():  # Actual sentence content
                sentence = sentence.strip()
                if sentence:
                    sentence = sentence[0].upper() + sentence[1:]
                cleaned_sentences.append(sentence)
            else:  # Punctuation
                cleaned_sentences.append(sentence)
        
        return ''.join(cleaned_sentences)
        
    except Exception as e:
        logger.error(f"Post-processing failed: {e}")
        return text

def enhanced_basic_cleanup(text):
    """Enhanced fallback cleanup when LanguageTool is unavailable"""
    try:
        logger.info(f"Using enhanced basic cleanup fallback for: '{text[:100]}...'")
        
        # Start with preprocessing
        text = preprocess_transcription(text)
        
        # Advanced sentence detection and punctuation
        text = text.strip()
        
        # Capitalize first letter
        if text:
            text = text[0].upper() + text[1:]
        
        # Add periods after natural sentence breaks
        text = re.sub(r'\b(and then|but then|so then|now|well|okay|alright)\s+', r'. \1 ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(and|but|so)\s+([a-z])', r', \1 \2', text, flags=re.IGNORECASE)
        
        # Fix common transcription patterns
        text = re.sub(r'\bher grammar\b', 'and grammar', text, flags=re.IGNORECASE)
        text = re.sub(r'\bthan understand\b', 'can understand', text, flags=re.IGNORECASE)
        text = re.sub(r'\baccount all\b', 'count all', text, flags=re.IGNORECASE)
        
        # Apply post-processing (adds final punctuation and capitalization)
        text = postprocess_transcription(text)
        
        logger.info(f"Enhanced basic cleanup result: '{text[:100]}...'")
        return text
        
    except Exception as e:
        logger.error(f"Enhanced basic cleanup failed: {e}")
        return basic_transcription_cleanup(text)

def basic_transcription_cleanup(text):
    """Basic cleanup for transcription text when LanguageTool is unavailable"""
    try:
        # Capitalize first letter
        text = text.strip()
        if text:
            text = text[0].upper() + text[1:]
        
        # Add periods at the end if missing
        if text and not text.endswith(('.', '!', '?')):
            text += '.'
        
        # Basic sentence capitalization after periods
        sentences = re.split(r'([.!?]\s*)', text)
        cleaned_sentences = []
        
        for i, sentence in enumerate(sentences):
            if i % 2 == 0 and sentence.strip():  # Actual sentence content
                sentence = sentence.strip()
                if sentence:
                    sentence = sentence[0].upper() + sentence[1:]
                cleaned_sentences.append(sentence)
            else:  # Punctuation
                cleaned_sentences.append(sentence)
        
        return ''.join(cleaned_sentences)
        
    except Exception as e:
        logger.error(f"Basic cleanup failed: {e}")
        return text

def update_post_transcription(post_id, transcription, status='completed'):
    """Update post with enhanced transcription via Next.js API (Prisma)"""
    try:
        # Call the Next.js API to update Prisma database instead of Firestore
        api_url = os.environ.get('NEXTJS_API_URL', 'https://your-app-domain.com') + '/api/transcribe'
        
        payload = {
            'postId': post_id,
            'transcription': transcription,
            'status': status
        }
        
        logger.info(f"Updating post {post_id} via Next.js API with enhanced transcription")
        
        response = requests.post(api_url, json=payload, timeout=30)
        response.raise_for_status()
        
        logger.info(f"✅ Successfully updated post {post_id} with enhanced transcription in Prisma")
        
    except Exception as e:
        logger.error(f"❌ Failed to update post {post_id} via Next.js API: {e}")
        # Fallback: still try Firestore for backup
        try:
            if db is not None and firestore is not None:
                post_ref = db.collection('posts').document(post_id)
                post_ref.update({
                    'transcription': transcription,
                    'transcriptionStatus': status,
                    'transcriptionProcessedAt': firestore.SERVER_TIMESTAMP
                })
                logger.info(f"📝 Fallback: Updated post {post_id} in Firestore")
            else:
                logger.warning("Firestore fallback unavailable; skipping Firestore update.")
        except Exception as fallback_error:
            logger.error(f"❌ Both Prisma and Firestore updates failed for post {post_id}: {fallback_error}")
            raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'model_loaded': model is not None})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Main transcription endpoint"""
    try:
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        post_id = data.get('postId')
        audio_url = data.get('audioUrl')
        video_url = data.get('videoUrl')
        media_type = data.get('mediaType', 'audio')
        
        if not post_id or (not audio_url and not video_url):
            return jsonify({'error': 'postId and either audioUrl or videoUrl are required'}), 400
        
        logger.info(f"Starting transcription for post {post_id} (media type: {media_type})")
        
        # Download media file from Firebase
        media_url = audio_url or video_url
        logger.info(f"Downloading {media_type} file...")
        media_data = download_audio_from_firebase(media_url)  # This function works for any media file
        
        # Convert to WAV (extracts audio from video if needed)
        logger.info(f"Converting {media_type} to WAV...")
        wav_file_path = convert_audio_to_wav(media_data)
        
        try:
            # Transcribe audio
            logger.info("Transcribing audio...")
            raw_transcription = transcribe_audio(wav_file_path)
            
            # Clean up transcription with LanguageTool
            logger.info("Cleaning up transcription with LanguageTool...")
            cleaned_transcription = cleanup_transcription_with_languagetool(raw_transcription)
            
            logger.info(f"Transcription completed for post {post_id}")
            logger.info(f"Raw: {raw_transcription[:100]}...")
            logger.info(f"Cleaned: {cleaned_transcription[:100]}...")
            
            return jsonify({
                'success': True,
                'postId': post_id,
                'transcription': cleaned_transcription,
                'status': 'completed'
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(wav_file_path):
                os.unlink(wav_file_path)
    
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        
        return jsonify({
            'success': False,
            'postId': post_id if 'post_id' in locals() else None,
            'transcription': f"Transcription failed: {str(e)}",
            'error': str(e),
            'status': 'failed'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)

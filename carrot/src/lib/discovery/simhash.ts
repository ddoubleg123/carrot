/**
 * SimHash Implementation for Content Fingerprinting
 * 
 * Generates 64-bit SimHash fingerprints for near-duplicate detection
 * using Hamming distance comparison.
 */

/**
 * Generate SimHash fingerprint from text content
 */
export function generateSimHash(text: string): string {
  // Clean and normalize text
  const cleanedText = cleanText(text);
  
  // Extract features (words and n-grams)
  const features = extractFeatures(cleanedText);
  
  // Generate hash vector
  const hashVector = generateHashVector(features);
  
  // Convert to 64-bit SimHash
  const simHash = vectorToSimHash(hashVector);
  
  return simHash;
}

/**
 * Clean and normalize text for fingerprinting
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract features from text (words and n-grams)
 */
function extractFeatures(text: string): string[] {
  const words = text.split(' ').filter(word => word.length > 2);
  const features: string[] = [];
  
  // Add individual words
  features.push(...words);
  
  // Add 2-grams
  for (let i = 0; i < words.length - 1; i++) {
    features.push(`${words[i]} ${words[i + 1]}`);
  }
  
  // Add 3-grams
  for (let i = 0; i < words.length - 2; i++) {
    features.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  
  return features;
}

/**
 * Generate hash vector from features
 */
function generateHashVector(features: string[]): number[] {
  const vector = new Array(64).fill(0);
  
  for (const feature of features) {
    const hash = simpleHash(feature);
    
    // Convert hash to 64-bit binary and update vector
    for (let i = 0; i < 64; i++) {
      const bit = (hash >> i) & 1;
      vector[i] += bit === 1 ? 1 : -1;
    }
  }
  
  return vector;
}

/**
 * Convert hash vector to 64-bit SimHash
 */
function vectorToSimHash(vector: number[]): string {
  let simHash = 0;
  
  for (let i = 0; i < 64; i++) {
    if (vector[i] > 0) {
      simHash |= (1 << i);
    }
  }
  
  return simHash.toString(36);
}

/**
 * Simple hash function for features
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate Hamming distance between two SimHash values
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  // Convert from base36 to numbers
  const num1 = parseInt(hash1, 36);
  const num2 = parseInt(hash2, 36);
  
  // XOR to find differing bits
  const xor = num1 ^ num2;
  
  // Count set bits (Hamming distance)
  let distance = 0;
  let temp = xor;
  
  while (temp !== 0) {
    distance += temp & 1;
    temp >>= 1;
  }
  
  return distance;
}

/**
 * Check if two hashes are near-duplicates
 */
export function isNearDuplicate(hash1: string, hash2: string, threshold: number = 3): boolean {
  const distance = calculateHammingDistance(hash1, hash2);
  return distance <= threshold;
}

/**
 * Generate content fingerprint for a discovered item
 */
export function generateContentFingerprint(item: {
  title: string;
  content?: string;
  description?: string;
}): string {
  // Combine title, content, and description
  const fullText = [
    item.title,
    item.content || '',
    item.description || ''
  ].join(' ').trim();
  
  return generateSimHash(fullText);
}

/**
 * Batch compare hashes for efficiency
 */
export function batchCompareHashes(
  targetHash: string, 
  candidateHashes: string[], 
  threshold: number = 3
): { isDuplicate: boolean; closestDistance: number; closestHash?: string } {
  let closestDistance = Infinity;
  let closestHash: string | undefined;
  
  for (const candidateHash of candidateHashes) {
    const distance = calculateHammingDistance(targetHash, candidateHash);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestHash = candidateHash;
    }
    
    if (distance <= threshold) {
      return {
        isDuplicate: true,
        closestDistance: distance,
        closestHash
      };
    }
  }
  
  return {
    isDuplicate: false,
    closestDistance,
    closestHash
  };
}

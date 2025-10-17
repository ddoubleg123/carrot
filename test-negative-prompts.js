// Test script to show enhanced prompts with negative prompts
console.log('🎨 ENHANCED PROMPTS WITH NEGATIVE PROMPTS TEST\n');

// Simulate the enhanced prompt templates
const ENHANCED_PROMPT_TEMPLATES = {
  "Hyper-Realistic (Photorealistic)": {
    base: "professional photography, photorealistic, high quality, detailed",
    lighting: "studio lighting, dramatic shadows, golden hour lighting, perfect illumination",
    composition: "cinematic composition, rule of thirds, depth of field, bokeh background",
    quality: "8K resolution, award-winning photography, sharp focus, ultra-detailed",
    mood: "authentic, lifelike, natural expression, realistic textures",
    technical: "shot with Canon EOS R5, 85mm lens, f/1.4 aperture, professional studio setup",
    negative: "cartoon, anime, animated, stylized, illustration, drawing, sketch, painting, artistic, cartoonish, comic book, manga, cel-shaded, flat colors, thick outlines, simplified, exaggerated, unrealistic, fake, artificial, synthetic, computer generated art, digital art, concept art, fantasy art"
  }
};

function buildEnhancedPrompt(userPrompt, artisticStyle) {
  const template = ENHANCED_PROMPT_TEMPLATES[artisticStyle];
  
  const positivePrompt = [
    userPrompt,
    template.base,
    template.lighting,
    template.composition,
    template.quality,
    template.mood,
    template.technical
  ].join(", ");
  
  return {
    positive: positivePrompt,
    negative: template.negative
  };
}

// Test with Donald Trump example
const testPrompt = "Donald Trump eating a taco inside the oval office in the white house";
const result = buildEnhancedPrompt(testPrompt, "Hyper-Realistic (Photorealistic)");

console.log('📸 POSITIVE PROMPT:');
console.log(result.positive);
console.log('\n🚫 NEGATIVE PROMPT:');
console.log(result.negative);
console.log('\n✅ This should prevent animated/cartoon styles!');

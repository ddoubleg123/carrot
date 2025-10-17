// Enhanced Prompt Templates - Matching Your Actual Dropdown Options
// Each template creates cinematic, detailed prompts for different artistic styles

export interface PromptTemplate {
  base: string;
  lighting: string;
  composition: string;
  quality: string;
  mood: string;
  technical: string;
  negative: string;
}

export const ENHANCED_PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  "Hyper-Realistic (Photorealistic)": {
    base: "professional photography, photorealistic, detailed",
    lighting: "studio lighting, dramatic shadows, golden hour lighting, perfect illumination",
    composition: "cinematic composition, rule of thirds, depth of field, bokeh background",
    quality: "8K resolution, award-winning photography, sharp focus, ultra-detailed",
    mood: "authentic, lifelike, natural expression, realistic textures",
    technical: "shot with Canon EOS R5, 85mm lens, f/1.4 aperture, professional studio setup",
    negative: "cartoon, anime, animated, stylized, illustration, drawing, sketch, painting, artistic, cartoonish, comic book, manga, cel-shaded, flat colors, thick outlines, simplified, exaggerated, unrealistic, fake, artificial, synthetic, computer generated art, digital art, concept art, fantasy art, 3d render, cgi, video game, digital illustration"
  },

  "Illustration (Stylized Art)": {
    base: "professional illustration, stylized art, creative interpretation, artistic vision",
    lighting: "creative lighting, artistic shadows, mood lighting, expressive illumination",
    composition: "artistic composition, creative framing, stylized elements, artistic vision",
    quality: "high-quality illustration, detailed artwork, professional illustration",
    mood: "creative, expressive, artistic, imaginative, unique vision",
    technical: "professional illustration, artistic technique, creative composition, stylized approach",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted"
  },

  "Animation (Cartoon/Anime Style)": {
    base: "anime style, cartoon animation, vibrant colors, dynamic character design",
    lighting: "anime lighting, bright colors, high contrast, vibrant illumination",
    composition: "anime composition, dynamic angles, expressive poses, character design",
    quality: "high-quality anime art, detailed character design, professional animation",
    mood: "energetic, vibrant, expressive, dynamic, colorful",
    technical: "anime art style, character design, professional animation, vibrant colors",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, 3d render, cgi"
  },

  "Painting (Artistic Brushwork)": {
    base: "oil painting, artistic brushwork, fine art, classical painting technique",
    lighting: "painterly lighting, artistic shadows, brush stroke illumination, artistic mood",
    composition: "classical composition, artistic framing, painterly elements, fine art approach",
    quality: "masterpiece quality, fine art painting, detailed brushwork, artistic excellence",
    mood: "artistic, expressive, creative, classical, refined",
    technical: "oil painting technique, classical art, fine art approach, master painter style",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, digital art, cgi, 3d render"
  },

  "Digital Art (Modern CGI)": {
    base: "digital art, modern cgi, computer generated, high-tech aesthetic",
    lighting: "digital lighting, cgi illumination, modern tech lighting, futuristic glow",
    composition: "digital composition, modern framing, tech elements, cgi approach",
    quality: "high-quality digital art, professional cgi, detailed digital work",
    mood: "modern, futuristic, tech-savvy, innovative, digital",
    technical: "digital art technique, cgi rendering, modern digital approach, tech aesthetic",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, traditional art, painting, drawing"
  },

  "Sketch (Pencil/Drawing)": {
    base: "pencil sketch, hand-drawn, artistic drawing, detailed line work",
    lighting: "sketch lighting, artistic shadows, drawing illumination, artistic mood",
    composition: "sketch composition, artistic framing, drawing elements, artistic approach",
    quality: "detailed sketch, professional drawing, artistic line work, fine art sketch",
    mood: "artistic, expressive, creative, hand-crafted, detailed",
    technical: "pencil technique, hand-drawn art, artistic drawing, detailed line work",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, digital art, cgi, 3d render"
  },

  "Watercolor (Soft & Flowing)": {
    base: "watercolor painting, soft flowing colors, artistic brushwork, gentle aesthetic",
    lighting: "soft lighting, gentle illumination, watercolor mood, artistic shadows",
    composition: "watercolor composition, flowing elements, artistic framing, gentle approach",
    quality: "high-quality watercolor, detailed brushwork, artistic excellence, soft technique",
    mood: "gentle, soft, flowing, artistic, peaceful",
    technical: "watercolor technique, soft brushwork, flowing colors, artistic approach",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, digital art, cgi, 3d render, harsh, sharp, detailed"
  },

  "Oil Painting (Classic Art)": {
    base: "oil painting, classical art, traditional painting, fine art technique",
    lighting: "classical lighting, artistic shadows, oil painting illumination, traditional mood",
    composition: "classical composition, traditional framing, fine art elements, classical approach",
    quality: "masterpiece quality, classical art, detailed oil painting, artistic excellence",
    mood: "classical, refined, artistic, traditional, elegant",
    technical: "oil painting technique, classical art, traditional approach, master painter style",
    negative: "photography, photorealistic, realistic, lifelike, natural, authentic, documentary, journalistic, candid, snapshot, amateur, low quality, blurry, distorted, digital art, cgi, 3d render"
  },

  "Minimalist (Clean & Simple)": {
    base: "minimalist photography, clean aesthetic, simple elegance, refined composition",
    lighting: "clean lighting, simple illumination, minimal shadows, elegant mood",
    composition: "minimalist composition, clean lines, simple framing, elegant approach",
    quality: "minimalist photography, clean aesthetic, refined quality, simple elegance",
    mood: "minimalist, clean, elegant, simple, refined",
    technical: "clean technique, minimal processing, elegant composition, refined approach",
    negative: "cluttered, busy, complex, detailed, ornate, decorative, colorful, vibrant, artistic, stylized, cartoon, anime, animated, illustration, drawing, sketch, painting"
  },

  "Vintage (Retro Photography)": {
    base: "vintage photography, retro style, classic look, timeless aesthetic",
    lighting: "warm vintage lighting, sepia tones, nostalgic illumination, classic mood",
    composition: "classic framing, vintage composition, timeless style, retro approach",
    quality: "vintage film quality, classic photography, retro aesthetic, timeless appeal",
    mood: "nostalgic, timeless, classic, vintage charm, retro style",
    technical: "vintage film technique, classic photography, retro processing, timeless approach",
    negative: "modern, contemporary, digital, cgi, 3d render, cartoon, anime, animated, stylized, illustration, drawing, sketch, painting, artificial, synthetic"
  }
};

// Function to build enhanced prompts using templates
export function buildEnhancedPrompt(
  userPrompt: string, 
  artisticStyle: string, 
  sourceDomain?: string, 
  patchTheme?: string
): { positive: string; negative: string } {
  const template = ENHANCED_PROMPT_TEMPLATES[artisticStyle] || ENHANCED_PROMPT_TEMPLATES["Hyper-Realistic (Photorealistic)"];
  
  // Add domain/theme specific enhancements - only for relevant content
  let domainEnhancements = "";
  
  // Check if content is actually sports-related before adding sports terms
  const content = userPrompt.toLowerCase();
  const isSportsContent = content.includes('sports') || content.includes('athletic') || 
                         content.includes('game') || content.includes('team') || 
                         content.includes('basketball') || content.includes('football') ||
                         content.includes('soccer') || content.includes('baseball');
  
  if (sourceDomain?.toLowerCase().includes("nationalgeographic")) {
    domainEnhancements += ", National Geographic style, documentary excellence, world-class photography";
  }
  if (patchTheme?.toLowerCase().includes("sports") && isSportsContent) {
    domainEnhancements += ", sports photography, action shot, dynamic movement, athletic excellence";
  }
  if (patchTheme?.toLowerCase().includes("news")) {
    domainEnhancements += ", news photography, journalistic style, editorial quality";
  }
  if (patchTheme?.toLowerCase().includes("tech")) {
    domainEnhancements += ", technology photography, modern innovation, sleek design";
  }
  
  // Check if this is a multi-person scenario and adjust style accordingly
  const isMultiPerson = userPrompt.toLowerCase().includes(' and ') || 
                       userPrompt.toLowerCase().includes(' with ') ||
                       userPrompt.toLowerCase().includes(' together ');
  
  let adjustedTemplate = { ...template };
  
  if (isMultiPerson) {
    // Override for multi-person scenes: use documentary style instead of studio
    adjustedTemplate.lighting = "natural lighting, documentary style, candid illumination";
    adjustedTemplate.composition = "both subjects visible in frame, natural candid composition, documentary framing";
    adjustedTemplate.technical = "documentary photography, photojournalistic approach, natural setting";
  }
  
  // Build the enhanced positive prompt
  const positivePrompt = [
    userPrompt,
    adjustedTemplate.base,
    adjustedTemplate.lighting,
    adjustedTemplate.composition,
    adjustedTemplate.quality,
    adjustedTemplate.mood,
    adjustedTemplate.technical,
    domainEnhancements
  ].filter(Boolean).join(", ");
  
  return {
    positive: positivePrompt,
    negative: template.negative
  };
}
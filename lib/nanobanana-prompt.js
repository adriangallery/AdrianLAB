/**
 * Configuración del prompt para transformación Nanobanana
 * Transforma imágenes pixel art a estilo Pixar/Disney 3D de alta fidelidad
 */

export const NANOBANANA_PROMPT_CONFIG = {
  style_definition: {
    name: "High-Fidelity 3D Animation Style",
    studio_reference: "Pixar/Disney Animation Studios",
    core_aesthetic: "Feature film CGI render"
  },
  subject_concept: "Pixel Art into Pixar-3D Style",
  prompt_instruction: "IMMEDIATELY GENERATE THE IMAGE. Create a high-budget 3D Pixar-style render of the subject. It is of the UTMOST IMPORTANCE to replicate the EXACT picture composition of the source image. If the subject is a character, maintain their likeness using the extracted metadata clues.",
  metadata_analysis: {
    instruction: "Before generating, analyze the source image or metadata to identify and preserve the following specific traits:",
    clues_to_extract: {
      hairstyle: "Identify style (e.g., messy, slicked back, afro), texture (hair strands vs. solid shape), and color.",
      facial_hair: "Note presence of beard, mustache, or stubble. Render with stylized grooming (clumped strands).",
      clothing: "Extract garment type (e.g., Hawaiian shirt, hoodie), fabric texture (cotton, wool), and distinct patterns.",
      accessories: "Look for eyewear, hats, headphones, or jewelry. Render these as high-quality separate props.",
      physical_features: "Note skin tone, eye shape/color, and any distinct markings (freckles, scars).",
      expression: "Map the 2D emotion to a 3D facial rig (e.g., if mouth is open pixelated, render as detailed open mouth with teeth/tongue)."
    }
  },
  visual_elements: {
    geometry: "Softened edges, rounded forms, exaggerated but balanced proportions. 'Chunky' stylized shapes. For electronics: simplified chips/GPIO pins. For characters: large expressive eyes, smooth skin shader.",
    lighting: "Warm, inviting studio lighting. Soft highlights, rim lighting to separate subject from background. Global illumination.",
    materials: "Physically Based Rendering (PBR). Subsurface scattering on skin/organic parts. Distinct texture separation (matte cloth vs. glossy plastic/eyes).",
    color_palette: "Vibrant, high saturation, cohesive color theory. Maintain the subject's original iconic colors but boost vibrancy.",
    composition: "CRITICAL: EXACTLY replicate the perspective, framing, subject placement, and background elements of the source image. Cinematic framing, depth of field (bokeh) to focus on the main subject."
  },
  negative_prompt: [
    "dusty",
    "scratched",
    "rusty",
    "photorealistic",
    "jagged edges",
    "industrial blueprint",
    "2D flat",
    "uncanny valley"
  ],
  midjourney_style_tags: "--v 6.0 --stylize 250 --style raw",
  stable_diffusion_trigger_words: "3d render, cute style, stylized character, subsurface scattering, octane render, pixar style, disney style, volumetric lighting, 8k"
};

/**
 * Construye el prompt final para Nano Banana
 * @param {Array<{name: string, category: string}>|null} traitsInfo - Información opcional de traits del NFT
 * @returns {string} - Prompt completo formateado
 */
export function buildNanobananaPrompt(traitsInfo = null) {
  const config = NANOBANANA_PROMPT_CONFIG;
  
  // Construir prompt principal combinando todas las instrucciones
  let prompt = `${config.prompt_instruction}\n\n`;
  prompt += `Style: ${config.style_definition.name} (${config.style_definition.studio_reference})\n`;
  prompt += `Subject: ${config.subject_concept}\n\n`;
  prompt += `Visual Requirements:\n`;
  prompt += `- Geometry: ${config.visual_elements.geometry}\n`;
  prompt += `- Lighting: ${config.visual_elements.lighting}\n`;
  prompt += `- Materials: ${config.visual_elements.materials}\n`;
  prompt += `- Colors: ${config.visual_elements.color_palette}\n`;
  prompt += `- Composition: ${config.visual_elements.composition}\n\n`;
  prompt += `Metadata Analysis: ${config.metadata_analysis.instruction}\n`;
  prompt += `Extract and preserve: ${Object.values(config.metadata_analysis.clues_to_extract).join('; ')}\n\n`;
  
  // Añadir información de traits si está disponible (contexto orientativo)
  if (traitsInfo && traitsInfo.length > 0) {
    prompt += `Context: The character may have the following elements (use as light reference only):\n`;
    traitsInfo.forEach(trait => {
      prompt += `- ${trait.name} (${trait.category})\n`;
    });
    prompt += `\n`;
  }
  
  prompt += `Style Tags: ${config.stable_diffusion_trigger_words}\n`;
  prompt += `Avoid: ${config.negative_prompt.join(', ')}`;
  
  return prompt;
}


/**
 * Spintax Processing Utility
 * 
 * Spintax allows for dynamic content generation by providing multiple variations
 * of text that can be randomly selected. Format: {option1|option2|option3}
 */

export interface SpintaxOptions {
  seed?: number // For deterministic randomization
  maxDepth?: number // Prevent infinite recursion
}

/**
 * Process spintax text and return a random variation
 */
export function processSpintax(text: string, options: SpintaxOptions = {}): string {
  const { seed, maxDepth = 10 } = options
  
  // Use seeded random if provided for deterministic results
  let randomSeed = seed || Math.random()
  const seededRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }
  
  const random = seed ? seededRandom : Math.random
  
  return processSpintaxRecursive(text, random, 0, maxDepth)
}

/**
 * Recursive spintax processing function
 */
function processSpintaxRecursive(
  text: string, 
  random: () => number, 
  depth: number, 
  maxDepth: number
): string {
  if (depth >= maxDepth) {
    return text // Prevent infinite recursion
  }
  
  // Find spintax patterns: {option1|option2|option3}
  const spintaxRegex = /\{([^{}]+)\}/g
  
  return text.replace(spintaxRegex, (match, content) => {
    const options = content.split('|').map((option: string) => option.trim())
    const selectedOption = options[Math.floor(random() * options.length)]
    
    // Recursively process the selected option in case it contains nested spintax
    return processSpintaxRecursive(selectedOption, random, depth + 1, maxDepth)
  })
}

/**
 * Generate multiple unique variations of spintax text
 */
export function generateSpintaxVariations(
  text: string, 
  count: number, 
  options: SpintaxOptions = {}
): string[] {
  const variations = new Set<string>()
  const maxAttempts = count * 10 // Prevent infinite loops
  let attempts = 0
  
  while (variations.size < count && attempts < maxAttempts) {
    const variation = processSpintax(text, { ...options, seed: undefined })
    variations.add(variation)
    attempts++
  }
  
  return Array.from(variations)
}

/**
 * Count the total number of possible spintax combinations
 */
export function countSpintaxCombinations(text: string): number {
  const spintaxRegex = /\{([^{}]+)\}/g
  let totalCombinations = 1
  let match
  
  while ((match = spintaxRegex.exec(text)) !== null) {
    const options = match[1].split('|')
    totalCombinations *= options.length
  }
  
  return totalCombinations
}

/**
 * Validate spintax syntax
 */
export function validateSpintax(text: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for unmatched braces
  const openBraces = (text.match(/\{/g) || []).length
  const closeBraces = (text.match(/\}/g) || []).length
  
  if (openBraces !== closeBraces) {
    errors.push('Unmatched braces: ensure each { has a corresponding }')
  }
  
  // Check for empty spintax groups
  const emptyGroups = text.match(/\{\s*\}/g)
  if (emptyGroups) {
    errors.push('Empty spintax groups found: {}')
  }
  
  // Check for spintax groups with only one option
  const spintaxRegex = /\{([^{}]+)\}/g
  let match
  
  while ((match = spintaxRegex.exec(text)) !== null) {
    const options = match[1].split('|').map(opt => opt.trim()).filter(opt => opt.length > 0)
    if (options.length < 2) {
      errors.push(`Spintax group with less than 2 options: {${match[1]}}`)
    }
  }
  
  // Check for nested braces (not supported in this implementation)
  const nestedBraces = text.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g)
  if (nestedBraces) {
    errors.push('Nested spintax groups are not supported')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Extract all spintax options from text for preview
 */
export function extractSpintaxOptions(text: string): Array<{ original: string; options: string[] }> {
  const spintaxRegex = /\{([^{}]+)\}/g
  const results: Array<{ original: string; options: string[] }> = []
  let match
  
  while ((match = spintaxRegex.exec(text)) !== null) {
    const options = match[1].split('|').map(opt => opt.trim()).filter(opt => opt.length > 0)
    results.push({
      original: match[0],
      options
    })
  }
  
  return results
}

/**
 * Preview spintax by showing all possible combinations (limited for performance)
 */
export function previewSpintax(text: string, maxPreview: number = 10): string[] {
  const totalCombinations = countSpintaxCombinations(text)
  
  if (totalCombinations <= maxPreview) {
    // Generate all combinations if small enough
    return generateAllCombinations(text)
  } else {
    // Generate random sample
    return generateSpintaxVariations(text, maxPreview)
  }
}

/**
 * Generate all possible spintax combinations (use with caution for large texts)
 */
function generateAllCombinations(text: string): string[] {
  const spintaxRegex = /\{([^{}]+)\}/
  const match = text.match(spintaxRegex)
  
  if (!match) {
    return [text] // No more spintax to process
  }
  
  const options = match[1].split('|').map(opt => opt.trim())
  const combinations: string[] = []
  
  for (const option of options) {
    const newText = text.replace(match[0], option)
    const subCombinations = generateAllCombinations(newText)
    combinations.push(...subCombinations)
  }
  
  return combinations
}
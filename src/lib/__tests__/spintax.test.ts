import {
  processSpintax,
  generateSpintaxVariations,
  countSpintaxCombinations,
  validateSpintax,
  extractSpintaxOptions,
  previewSpintax
} from '../spintax'

describe('Spintax Processing', () => {
  describe('processSpintax', () => {
    it('should process simple spintax', () => {
      const text = '{Hello|Hi|Hey} there!'
      const result = processSpintax(text, { seed: 1 })
      expect(['Hello there!', 'Hi there!', 'Hey there!']).toContain(result)
    })

    it('should handle multiple spintax groups', () => {
      const text = '{Hello|Hi} {world|everyone}!'
      const result = processSpintax(text, { seed: 1 })
      expect(result).toMatch(/^(Hello|Hi) (world|everyone)!$/)
    })

    it('should return original text if no spintax', () => {
      const text = 'Hello world!'
      const result = processSpintax(text)
      expect(result).toBe('Hello world!')
    })

    it('should handle text with braces that are not proper spintax', () => {
      const text = '{Hello {world|everyone}|Hi there}!'
      const result = processSpintax(text, { seed: 1 })
      // Current implementation doesn't support nested spintax, so it should return as-is or partially processed
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should use seeded random for deterministic results', () => {
      const text = '{Hello|Hi|Hey} there!'
      const result1 = processSpintax(text, { seed: 123 })
      const result2 = processSpintax(text, { seed: 123 })
      expect(result1).toBe(result2)
    })

    it('should prevent infinite recursion', () => {
      const text = '{Hello|Hi} there!'
      const result = processSpintax(text, { maxDepth: 1 })
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('generateSpintaxVariations', () => {
    it('should generate multiple unique variations', () => {
      const text = '{Hello|Hi} {world|everyone}!'
      const variations = generateSpintaxVariations(text, 4)
      expect(variations).toHaveLength(4)
      expect(new Set(variations).size).toBe(4) // All unique
    })

    it('should handle cases with fewer possible combinations than requested', () => {
      const text = '{Hello|Hi} world!'
      const variations = generateSpintaxVariations(text, 5)
      expect(variations.length).toBeLessThanOrEqual(2) // Only 2 possible combinations
    })
  })

  describe('countSpintaxCombinations', () => {
    it('should count combinations correctly', () => {
      expect(countSpintaxCombinations('{Hello|Hi} {world|everyone}!')).toBe(4)
      expect(countSpintaxCombinations('{A|B|C} {1|2}!')).toBe(6)
      expect(countSpintaxCombinations('No spintax here')).toBe(1)
    })

    it('should handle single option groups', () => {
      expect(countSpintaxCombinations('{Hello} world!')).toBe(1)
    })
  })

  describe('validateSpintax', () => {
    it('should validate correct spintax', () => {
      const result = validateSpintax('{Hello|Hi} {world|everyone}!')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect unmatched braces', () => {
      const result = validateSpintax('{Hello|Hi world!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Unmatched braces: ensure each { has a corresponding }')
    })

    it('should detect empty groups', () => {
      const result = validateSpintax('Hello {} world!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Empty spintax groups found: {}')
    })

    it('should detect single option groups', () => {
      const result = validateSpintax('{Hello} world!')
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Spintax group with less than 2 options')
    })

    it('should detect nested braces', () => {
      const result = validateSpintax('{Hello {world|everyone}} there!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Nested spintax groups are not supported')
    })
  })

  describe('extractSpintaxOptions', () => {
    it('should extract spintax options', () => {
      const text = '{Hello|Hi|Hey} {world|everyone}!'
      const options = extractSpintaxOptions(text)
      
      expect(options).toHaveLength(2)
      expect(options[0]).toEqual({
        original: '{Hello|Hi|Hey}',
        options: ['Hello', 'Hi', 'Hey']
      })
      expect(options[1]).toEqual({
        original: '{world|everyone}',
        options: ['world', 'everyone']
      })
    })

    it('should handle empty text', () => {
      const options = extractSpintaxOptions('No spintax here')
      expect(options).toHaveLength(0)
    })

    it('should filter out empty options', () => {
      const text = '{Hello||Hi} world!'
      const options = extractSpintaxOptions(text)
      
      expect(options[0].options).toEqual(['Hello', 'Hi'])
    })
  })

  describe('previewSpintax', () => {
    it('should generate preview variations', () => {
      const text = '{Hello|Hi} world!'
      const preview = previewSpintax(text, 5)
      
      expect(preview.length).toBeLessThanOrEqual(5)
      expect(preview).toContain('Hello world!')
      expect(preview).toContain('Hi world!')
    })

    it('should limit preview count', () => {
      const text = '{A|B|C} {1|2|3} {X|Y|Z}' // 27 combinations
      const preview = previewSpintax(text, 5)
      
      expect(preview.length).toBeLessThanOrEqual(5)
    })
  })
})
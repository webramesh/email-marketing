/**
 * Plugin Architecture System
 * Extensible plugin system for third-party integrations
 */

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: PluginCategory
  status: PluginStatus
  config: PluginConfig
  hooks: PluginHook[]
  permissions: string[]
  dependencies?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export enum PluginCategory {
  AI = 'AI',
  ANALYTICS = 'ANALYTICS',
  AUTOMATION = 'AUTOMATION',
  INTEGRATION = 'INTEGRATION',
  EMAIL_PROVIDER = 'EMAIL_PROVIDER',
  PAYMENT = 'PAYMENT',
  STORAGE = 'STORAGE',
  UTILITY = 'UTILITY'
}

export enum PluginStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  UPDATING = 'UPDATING'
}

export interface PluginConfig {
  settings: Record<string, PluginConfigField>
  values: Record<string, any>
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'password' | 'url' | 'email'
  label: string
  description?: string
  required: boolean
  default?: any
  options?: Array<{ value: any; label: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    custom?: string
  }
}

export interface PluginHook {
  event: string
  handler: string
  priority: number
  conditions?: Record<string, any>
}

export interface PluginContext {
  tenantId: string
  userId?: string
  plugin: Plugin
  config: Record<string, any>
  logger: PluginLogger
  storage: PluginStorage
  http: PluginHttpClient
}

export interface PluginLogger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
}

export interface PluginStorage {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
}

export interface PluginHttpClient {
  get(url: string, options?: any): Promise<any>
  post(url: string, data?: any, options?: any): Promise<any>
  put(url: string, data?: any, options?: any): Promise<any>
  delete(url: string, options?: any): Promise<any>
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: PluginCategory
  main: string
  config: Record<string, PluginConfigField>
  hooks: PluginHook[]
  permissions: string[]
  dependencies?: string[]
  minPlatformVersion?: string
  maxPlatformVersion?: string
}

export interface PluginExecutionResult {
  success: boolean
  data?: any
  error?: string
  metadata?: Record<string, any>
}

export abstract class BasePlugin {
  protected context: PluginContext

  constructor(context: PluginContext) {
    this.context = context
  }

  abstract initialize(): Promise<void>
  abstract execute(event: string, data: any): Promise<PluginExecutionResult>
  abstract cleanup(): Promise<void>

  protected log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: any) {
    this.context.logger[level](message, meta)
  }

  protected async getConfig(key: string, defaultValue?: any): Promise<any> {
    return this.context.config[key] ?? defaultValue
  }

  protected async setStorage(key: string, value: any): Promise<void> {
    await this.context.storage.set(`${this.context.plugin.id}:${key}`, value)
  }

  protected async getStorage(key: string): Promise<any> {
    return await this.context.storage.get(`${this.context.plugin.id}:${key}`)
  }

  protected async httpRequest(method: string, url: string, data?: any, options?: any): Promise<any> {
    switch (method.toLowerCase()) {
      case 'get':
        return await this.context.http.get(url, options)
      case 'post':
        return await this.context.http.post(url, data, options)
      case 'put':
        return await this.context.http.put(url, data, options)
      case 'delete':
        return await this.context.http.delete(url, options)
      default:
        throw new Error(`Unsupported HTTP method: ${method}`)
    }
  }
}

// Plugin Registry
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map()
  private instances: Map<string, BasePlugin> = new Map()
  private hooks: Map<string, Array<{ plugin: Plugin; handler: string; priority: number }>> = new Map()

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin)
    
    // Register hooks
    plugin.hooks.forEach(hook => {
      if (!this.hooks.has(hook.event)) {
        this.hooks.set(hook.event, [])
      }
      
      this.hooks.get(hook.event)!.push({
        plugin,
        handler: hook.handler,
        priority: hook.priority
      })
      
      // Sort by priority (higher priority first)
      this.hooks.get(hook.event)!.sort((a, b) => b.priority - a.priority)
    })
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    // Remove from registry
    this.plugins.delete(pluginId)
    
    // Remove instance
    this.instances.delete(pluginId)
    
    // Remove hooks
    plugin.hooks.forEach(hook => {
      const eventHooks = this.hooks.get(hook.event)
      if (eventHooks) {
        const index = eventHooks.findIndex(h => h.plugin.id === pluginId)
        if (index !== -1) {
          eventHooks.splice(index, 1)
        }
      }
    })
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: PluginCategory): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.category === category)
  }

  /**
   * Execute plugin hooks for an event
   */
  async executeHooks(event: string, data: any, context: Partial<PluginContext>): Promise<any[]> {
    const eventHooks = this.hooks.get(event) || []
    const results: any[] = []

    for (const hook of eventHooks) {
      try {
        if (hook.plugin.status !== PluginStatus.ACTIVE) continue

        const instance = await this.getPluginInstance(hook.plugin, context as PluginContext)
        const result = await instance.execute(event, data)
        results.push(result)
      } catch (error) {
        console.error(`Error executing plugin hook ${hook.plugin.id}:${hook.handler}:`, error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * Get or create plugin instance
   */
  private async getPluginInstance(plugin: Plugin, context: PluginContext): Promise<BasePlugin> {
    if (this.instances.has(plugin.id)) {
      return this.instances.get(plugin.id)!
    }

    // In a real implementation, you would dynamically load the plugin module
    // For now, we'll use a factory pattern
    const instance = await this.createPluginInstance(plugin, context)
    await instance.initialize()
    
    this.instances.set(plugin.id, instance)
    return instance
  }

  /**
   * Create plugin instance (factory method)
   */
  private async createPluginInstance(plugin: Plugin, context: PluginContext): Promise<BasePlugin> {
    // This would typically load the plugin module dynamically
    // For now, we'll return a mock instance
    return new (class extends BasePlugin {
      async initialize(): Promise<void> {
        this.log('info', `Initializing plugin ${plugin.name}`)
      }

      async execute(event: string, data: any): Promise<PluginExecutionResult> {
        this.log('info', `Executing plugin ${plugin.name} for event ${event}`)
        return { success: true, data }
      }

      async cleanup(): Promise<void> {
        this.log('info', `Cleaning up plugin ${plugin.name}`)
      }
    })(context)
  }
}

// Global plugin registry instance
export const pluginRegistry = new PluginRegistry()

// Plugin utilities
export class PluginUtils {
  /**
   * Validate plugin manifest
   */
  static validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!manifest.id || typeof manifest.id !== 'string') {
      errors.push('Plugin ID is required and must be a string')
    }

    if (!manifest.name || typeof manifest.name !== 'string') {
      errors.push('Plugin name is required and must be a string')
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      errors.push('Plugin version is required and must be a string')
    }

    if (!manifest.main || typeof manifest.main !== 'string') {
      errors.push('Plugin main file is required and must be a string')
    }

    if (!Object.values(PluginCategory).includes(manifest.category)) {
      errors.push('Plugin category must be a valid category')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Check plugin compatibility
   */
  static checkCompatibility(manifest: PluginManifest, platformVersion: string): boolean {
    if (manifest.minPlatformVersion && this.compareVersions(platformVersion, manifest.minPlatformVersion) < 0) {
      return false
    }

    if (manifest.maxPlatformVersion && this.compareVersions(platformVersion, manifest.maxPlatformVersion) > 0) {
      return false
    }

    return true
  }

  /**
   * Compare version strings
   */
  private static compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)
    const maxLength = Math.max(aParts.length, bParts.length)

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0
      const bPart = bParts[i] || 0

      if (aPart > bPart) return 1
      if (aPart < bPart) return -1
    }

    return 0
  }
}
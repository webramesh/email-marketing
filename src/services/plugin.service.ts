/**
 * Plugin Management Service
 */

import { prisma } from '@/lib/prisma';
import {
  Plugin,
  PluginCategory,
  PluginStatus,
  PluginManifest,
  PluginUtils,
  pluginRegistry,
} from '@/lib/plugins';

export interface CreatePluginRequest {
  manifest: PluginManifest;
  tenantId: string;
}

export interface UpdatePluginRequest {
  status?: PluginStatus;
  config?: Record<string, any>;
}

export class PluginService {
  /**
   * Install a plugin
   */
  static async installPlugin(
    tenantId: string,
    manifest: PluginManifest,
    config: Record<string, any> = {}
  ): Promise<Plugin> {
    // Validate manifest
    const validation = PluginUtils.validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid plugin manifest: ${validation.errors.join(', ')}`);
    }

    // Check compatibility
    const platformVersion = '1.0.0'; // This would come from your app version
    if (!PluginUtils.checkCompatibility(manifest, platformVersion)) {
      throw new Error('Plugin is not compatible with current platform version');
    }

    // Check if plugin already exists
    const existingPlugin = await prisma.plugin.findFirst({
      where: {
        pluginId: manifest.id,
        tenantId,
      },
    });

    if (existingPlugin) {
      throw new Error('Plugin is already installed');
    }

    // Create plugin record
    const plugin = await prisma.plugin.create({
      data: {
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category,
        status: PluginStatus.ACTIVE,
        config: JSON.parse(
          JSON.stringify({
            settings: manifest.config,
            values: config,
          })
        ),
        hooks: JSON.parse(JSON.stringify(manifest.hooks)),
        permissions: manifest.permissions,
        dependencies: manifest.dependencies || [],
        metadata: JSON.parse(
          JSON.stringify({
            main: manifest.main,
            minPlatformVersion: manifest.minPlatformVersion,
            maxPlatformVersion: manifest.maxPlatformVersion,
          })
        ),
        tenantId,
      },
    });

    // Convert to properly typed Plugin object
    const typedPlugin: Plugin = {
      ...plugin,
      category: plugin.category as PluginCategory,
      status: plugin.status as PluginStatus,
      config: plugin.config as any,
      hooks: plugin.hooks as any,
      permissions: plugin.permissions as string[],
      dependencies: plugin.dependencies as string[],
      metadata: plugin.metadata as any,
    };

    // Register with plugin registry
    pluginRegistry.register(typedPlugin);

    return typedPlugin;
  }

  /**
   * Get all plugins for a tenant
   */
  static async getPlugins(
    tenantId: string,
    category?: PluginCategory,
    status?: PluginStatus
  ): Promise<Plugin[]> {
    const where: any = { tenantId };

    if (category) where.category = category;
    if (status) where.status = status;

    const plugins = await prisma.plugin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return plugins.map(plugin => ({
      ...plugin,
      category: plugin.category as PluginCategory,
      status: plugin.status as PluginStatus,
      config: plugin.config as any,
      hooks: plugin.hooks as any,
      permissions: plugin.permissions as string[],
      dependencies: plugin.dependencies as string[],
      metadata: plugin.metadata as any,
    }));
  }

  /**
   * Get plugin by ID
   */
  static async getPluginById(tenantId: string, pluginId: string): Promise<Plugin | null> {
    const plugin = await prisma.plugin.findFirst({
      where: {
        pluginId,
        tenantId,
      },
    });

    if (!plugin) return null;

    return {
      ...plugin,
      category: plugin.category as PluginCategory,
      status: plugin.status as PluginStatus,
      config: plugin.config as any,
      hooks: plugin.hooks as any,
      permissions: plugin.permissions as string[],
      dependencies: plugin.dependencies as string[],
      metadata: plugin.metadata as any,
    };
  }

  /**
   * Update plugin
   */
  static async updatePlugin(
    tenantId: string,
    pluginId: string,
    data: UpdatePluginRequest
  ): Promise<Plugin | null> {
    const plugin = await prisma.plugin.findFirst({
      where: {
        pluginId,
        tenantId,
      },
    });

    if (!plugin) return null;

    const updatedPlugin = await prisma.plugin.update({
      where: { id: plugin.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Convert to properly typed Plugin object
    const typedUpdatedPlugin: Plugin = {
      ...updatedPlugin,
      category: updatedPlugin.category as PluginCategory,
      status: updatedPlugin.status as PluginStatus,
      config: updatedPlugin.config as any,
      hooks: updatedPlugin.hooks as any,
      permissions: updatedPlugin.permissions as string[],
      dependencies: updatedPlugin.dependencies as string[],
      metadata: updatedPlugin.metadata as any,
    };

    // Update registry
    if (data.status === PluginStatus.ACTIVE) {
      pluginRegistry.register(typedUpdatedPlugin);
    } else if (data.status === PluginStatus.INACTIVE) {
      pluginRegistry.unregister(pluginId);
    }

    return typedUpdatedPlugin;
  }

  /**
   * Uninstall plugin
   */
  static async uninstallPlugin(tenantId: string, pluginId: string): Promise<boolean> {
    const result = await prisma.plugin.deleteMany({
      where: {
        pluginId,
        tenantId,
      },
    });

    if (result.count > 0) {
      pluginRegistry.unregister(pluginId);
      return true;
    }

    return false;
  }

  /**
   * Get available plugin categories
   */
  static getAvailableCategories(): Array<{
    key: PluginCategory;
    label: string;
    description: string;
  }> {
    return [
      {
        key: PluginCategory.AI,
        label: 'AI & Machine Learning',
        description: 'AI-powered content generation and optimization',
      },
      {
        key: PluginCategory.ANALYTICS,
        label: 'Analytics & Reporting',
        description: 'Advanced analytics and custom reporting tools',
      },
      {
        key: PluginCategory.AUTOMATION,
        label: 'Automation & Workflows',
        description: 'Workflow automation and trigger systems',
      },
      {
        key: PluginCategory.INTEGRATION,
        label: 'Integrations',
        description: 'Third-party service integrations',
      },
      {
        key: PluginCategory.EMAIL_PROVIDER,
        label: 'Email Providers',
        description: 'Additional email sending providers',
      },
      {
        key: PluginCategory.PAYMENT,
        label: 'Payment Gateways',
        description: 'Payment processing integrations',
      },
      {
        key: PluginCategory.STORAGE,
        label: 'Storage & CDN',
        description: 'File storage and content delivery',
      },
      {
        key: PluginCategory.UTILITY,
        label: 'Utilities',
        description: 'General utility and helper plugins',
      },
    ];
  }

  /**
   * Get plugin marketplace (mock data for now)
   */
  static async getMarketplacePlugins(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      category: PluginCategory;
      version: string;
      author: string;
      rating: number;
      downloads: number;
      price: number;
      screenshots: string[];
      features: string[];
    }>
  > {
    // This would typically fetch from a plugin marketplace API
    return [
      {
        id: 'openai-content-generator',
        name: 'OpenAI Content Generator',
        description: 'Generate high-quality email content using OpenAI GPT models',
        category: PluginCategory.AI,
        version: '1.2.0',
        author: 'EmailPlatform Team',
        rating: 4.8,
        downloads: 15420,
        price: 0,
        screenshots: [],
        features: [
          'Subject line generation',
          'Email content creation',
          'A/B test variations',
          'Multiple language support',
        ],
      },
      {
        id: 'google-analytics-integration',
        name: 'Google Analytics Integration',
        description: 'Track email campaign performance in Google Analytics',
        category: PluginCategory.ANALYTICS,
        version: '2.1.0',
        author: 'Analytics Pro',
        rating: 4.6,
        downloads: 8930,
        price: 29.99,
        screenshots: [],
        features: [
          'UTM parameter automation',
          'Goal tracking',
          'Custom dimensions',
          'Real-time reporting',
        ],
      },
      {
        id: 'zapier-automation',
        name: 'Zapier Integration',
        description: 'Connect with 5000+ apps through Zapier automation',
        category: PluginCategory.INTEGRATION,
        version: '1.5.0',
        author: 'Zapier Inc.',
        rating: 4.7,
        downloads: 12350,
        price: 0,
        screenshots: [],
        features: [
          'Trigger-based automation',
          '5000+ app integrations',
          'Custom workflows',
          'Real-time sync',
        ],
      },
      {
        id: 'advanced-segmentation',
        name: 'Advanced Segmentation',
        description: 'Create complex subscriber segments with advanced conditions',
        category: PluginCategory.UTILITY,
        version: '1.0.0',
        author: 'SegmentPro',
        rating: 4.5,
        downloads: 5670,
        price: 19.99,
        screenshots: [],
        features: [
          'Behavioral segmentation',
          'Predictive analytics',
          'Dynamic segments',
          'Custom field conditions',
        ],
      },
    ];
  }

  /**
   * Execute plugin hook
   */
  static async executePluginHook(tenantId: string, event: string, data: any): Promise<any[]> {
    return await pluginRegistry.executeHooks(event, data, {
      tenantId,
      plugin: {} as Plugin, // This would be set by the registry
      config: {},
      logger: {
        info: (msg, meta) => console.log(`[Plugin] ${msg}`, meta),
        warn: (msg, meta) => console.warn(`[Plugin] ${msg}`, meta),
        error: (msg, meta) => console.error(`[Plugin] ${msg}`, meta),
        debug: (msg, meta) => console.debug(`[Plugin] ${msg}`, meta),
      },
      storage: {
        get: async _key => {
          // Implement plugin storage
          return null;
        },
        set: async (_key, _value) => {
          // Implement plugin storage
        },
        delete: async _key => {
          // Implement plugin storage
        },
        list: async _prefix => {
          // Implement plugin storage
          return [];
        },
      },
      http: {
        get: async (url, options) => {
          const response = await fetch(url, { ...options, method: 'GET' });
          return response.json();
        },
        post: async (url, data, options) => {
          const response = await fetch(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json', ...options?.headers },
          });
          return response.json();
        },
        put: async (url, data, options) => {
          const response = await fetch(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json', ...options?.headers },
          });
          return response.json();
        },
        delete: async (url, options) => {
          const response = await fetch(url, { ...options, method: 'DELETE' });
          return response.json();
        },
      },
    });
  }
}

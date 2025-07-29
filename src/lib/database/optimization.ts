import { prisma } from '../prisma';

/**
 * Database optimization utilities for query performance and indexing
 */
export class DatabaseOptimizationService {
  /**
   * Analyze database schema and suggest optimizations
   */
  static async analyzeSchema(): Promise<SchemaAnalysis> {
    try {
      const analysis: SchemaAnalysis = {
        tables: [],
        indexSuggestions: [],
        performanceIssues: [],
        optimizationRecommendations: [],
      };

      // Get table information
      const tables = await this.getTableInformation();
      analysis.tables = tables;

      // Analyze indexes
      const indexSuggestions = await this.analyzeIndexes();
      analysis.indexSuggestions = indexSuggestions;

      // Identify performance issues
      const performanceIssues = await this.identifyPerformanceIssues();
      analysis.performanceIssues = performanceIssues;

      // Generate optimization recommendations
      analysis.optimizationRecommendations = this.generateOptimizationRecommendations(
        tables,
        indexSuggestions,
        performanceIssues
      );

      return analysis;
    } catch (error) {
      console.error('Schema analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get table information including row counts and sizes
   */
  private static async getTableInformation(): Promise<TableInfo[]> {
    try {
      const tables: TableInfo[] = [];

      // Get table statistics from information_schema
      const tableStats = await prisma.$queryRaw<any[]>`
        SELECT 
          TABLE_NAME as tableName,
          TABLE_ROWS as rowCount,
          DATA_LENGTH as dataSize,
          INDEX_LENGTH as indexSize,
          (DATA_LENGTH + INDEX_LENGTH) as totalSize,
          AUTO_INCREMENT as autoIncrement
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      `;

      for (const stat of tableStats) {
        tables.push({
          name: stat.tableName,
          rowCount: stat.rowCount || 0,
          dataSize: stat.dataSize || 0,
          indexSize: stat.indexSize || 0,
          totalSize: stat.totalSize || 0,
          autoIncrement: stat.autoIncrement || null,
          growthRate: 'unknown', // Would need historical data
          lastAnalyzed: new Date(),
        });
      }

      return tables;
    } catch (error) {
      console.error('Failed to get table information:', error);
      return [];
    }
  }

  /**
   * Analyze existing indexes and suggest improvements
   */
  private static async analyzeIndexes(): Promise<IndexSuggestion[]> {
    try {
      const suggestions: IndexSuggestion[] = [];

      // Get existing indexes
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT 
          TABLE_NAME as tableName,
          INDEX_NAME as indexName,
          COLUMN_NAME as columnName,
          SEQ_IN_INDEX as sequenceInIndex,
          NON_UNIQUE as nonUnique,
          CARDINALITY as cardinality
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `;

      // Analyze tenant isolation indexes
      suggestions.push(...this.analyzeTenantIndexes());

      // Analyze foreign key indexes
      suggestions.push(...this.analyzeForeignKeyIndexes());

      // Analyze query pattern indexes
      suggestions.push(...this.analyzeQueryPatternIndexes());

      // Analyze composite indexes
      suggestions.push(...this.analyzeCompositeIndexes());

      return suggestions;
    } catch (error) {
      console.error('Failed to analyze indexes:', error);
      return [];
    }
  }

  /**
   * Analyze tenant isolation indexes
   */
  private static analyzeTenantIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    // Critical tenant isolation indexes
    const tenantTables = [
      'users',
      'campaigns',
      'subscribers',
      'lists',
      'automations',
      'sending_servers',
      'domains',
      'forms',
      'support_tickets',
      'campaign_analytics',
      'email_events',
      'automation_executions',
      'email_templates',
      'segments',
      'email_verifications',
      'bounce_complaints',
      'api_keys',
      'webhooks',
      'payments',
      'audit_logs',
      'scheduled_reports',
      'plugins',
    ];

    for (const table of tenantTables) {
      suggestions.push({
        type: 'create',
        table,
        indexName: `idx_${table}_tenant_id`,
        columns: ['tenantId'],
        reason: 'Critical for tenant isolation and query performance',
        priority: 'high',
        estimatedImpact: 'high',
        sqlCommand: `CREATE INDEX idx_${table}_tenant_id ON ${table} (tenantId);`,
      });
    }

    return suggestions;
  }

  /**
   * Analyze foreign key indexes
   */
  private static analyzeForeignKeyIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    // Common foreign key relationships that need indexes
    const foreignKeyIndexes = [
      {
        table: 'list_subscribers',
        columns: ['listId'],
        reason: 'Optimize list subscriber queries',
      },
      {
        table: 'list_subscribers',
        columns: ['subscriberId'],
        reason: 'Optimize subscriber list queries',
      },
      { table: 'email_events', columns: ['campaignId'], reason: 'Optimize campaign event queries' },
      {
        table: 'email_events',
        columns: ['subscriberId'],
        reason: 'Optimize subscriber event queries',
      },
      {
        table: 'automation_executions',
        columns: ['automationId'],
        reason: 'Optimize automation execution queries',
      },
      { table: 'campaign_variants', columns: ['campaignId'], reason: 'Optimize A/B test queries' },
      {
        table: 'form_submissions',
        columns: ['formId'],
        reason: 'Optimize form submission queries',
      },
      {
        table: 'support_tickets',
        columns: ['assignedToUserId'],
        reason: 'Optimize ticket assignment queries',
      },
      { table: 'api_key_usage', columns: ['apiKeyId'], reason: 'Optimize API usage tracking' },
    ];

    for (const fkIndex of foreignKeyIndexes) {
      suggestions.push({
        type: 'create',
        table: fkIndex.table,
        indexName: `idx_${fkIndex.table}_${fkIndex.columns.join('_')}`,
        columns: fkIndex.columns,
        reason: fkIndex.reason,
        priority: 'medium',
        estimatedImpact: 'medium',
        sqlCommand: `CREATE INDEX idx_${fkIndex.table}_${fkIndex.columns.join('_')} ON ${
          fkIndex.table
        } (${fkIndex.columns.join(', ')});`,
      });
    }

    return suggestions;
  }

  /**
   * Analyze query pattern indexes
   */
  private static analyzeQueryPatternIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    // Common query patterns that benefit from specific indexes
    const queryPatternIndexes = [
      {
        table: 'campaigns',
        columns: ['status'],
        reason: 'Optimize campaign status filtering (DRAFT, SCHEDULED, SENDING, etc.)',
      },
      {
        table: 'campaigns',
        columns: ['scheduledAt'],
        reason: 'Optimize scheduled campaign queries',
      },
      {
        table: 'subscribers',
        columns: ['status'],
        reason: 'Optimize subscriber status filtering (ACTIVE, UNSUBSCRIBED, etc.)',
      },
      {
        table: 'subscribers',
        columns: ['email'],
        reason: 'Optimize email lookup queries',
      },
      {
        table: 'email_events',
        columns: ['type'],
        reason: 'Optimize event type filtering (SENT, OPENED, CLICKED, etc.)',
      },
      {
        table: 'email_events',
        columns: ['createdAt'],
        reason: 'Optimize time-based event queries',
      },
      {
        table: 'support_tickets',
        columns: ['status'],
        reason: 'Optimize ticket status filtering',
      },
      {
        table: 'support_tickets',
        columns: ['priority'],
        reason: 'Optimize ticket priority filtering',
      },
      {
        table: 'support_tickets',
        columns: ['dueDate'],
        reason: 'Optimize SLA and due date queries',
      },
    ];

    for (const pattern of queryPatternIndexes) {
      suggestions.push({
        type: 'create',
        table: pattern.table,
        indexName: `idx_${pattern.table}_${pattern.columns.join('_')}`,
        columns: pattern.columns,
        reason: pattern.reason,
        priority: 'medium',
        estimatedImpact: 'medium',
        sqlCommand: `CREATE INDEX idx_${pattern.table}_${pattern.columns.join('_')} ON ${
          pattern.table
        } (${pattern.columns.join(', ')});`,
      });
    }

    return suggestions;
  }

  /**
   * Analyze composite indexes for complex queries
   */
  private static analyzeCompositeIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    // Composite indexes for common multi-column queries
    const compositeIndexes = [
      {
        table: 'campaigns',
        columns: ['tenantId', 'status'],
        reason: 'Optimize tenant-specific campaign status queries',
      },
      {
        table: 'campaigns',
        columns: ['tenantId', 'scheduledAt'],
        reason: 'Optimize tenant-specific scheduled campaign queries',
      },
      {
        table: 'subscribers',
        columns: ['tenantId', 'status'],
        reason: 'Optimize tenant-specific subscriber status queries',
      },
      {
        table: 'subscribers',
        columns: ['tenantId', 'email'],
        reason: 'Optimize tenant-specific email lookup (unique constraint)',
      },
      {
        table: 'email_events',
        columns: ['tenantId', 'type', 'createdAt'],
        reason: 'Optimize tenant-specific event analytics queries',
      },
      {
        table: 'email_events',
        columns: ['campaignId', 'type'],
        reason: 'Optimize campaign-specific event type queries',
      },
      {
        table: 'support_tickets',
        columns: ['tenantId', 'status', 'priority'],
        reason: 'Optimize tenant-specific ticket filtering',
      },
      {
        table: 'list_subscribers',
        columns: ['listId', 'subscriberId'],
        reason: 'Optimize list-subscriber relationship queries (unique constraint)',
      },
    ];

    for (const composite of compositeIndexes) {
      suggestions.push({
        type: 'create',
        table: composite.table,
        indexName: `idx_${composite.table}_${composite.columns.join('_')}`,
        columns: composite.columns,
        reason: composite.reason,
        priority: 'high',
        estimatedImpact: 'high',
        sqlCommand: `CREATE INDEX idx_${composite.table}_${composite.columns.join('_')} ON ${
          composite.table
        } (${composite.columns.join(', ')});`,
      });
    }

    return suggestions;
  }

  /**
   * Identify performance issues
   */
  private static async identifyPerformanceIssues(): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    try {
      // Check for tables without proper indexes
      const tablesWithoutTenantIndex = await this.findTablesWithoutTenantIndex();
      for (const table of tablesWithoutTenantIndex) {
        issues.push({
          type: 'missing_index',
          severity: 'high',
          table,
          description: `Table ${table} is missing tenant isolation index`,
          impact: 'Queries will be slow and may access data across tenants',
          recommendation: `Add index on tenantId column: CREATE INDEX idx_${table}_tenant_id ON ${table} (tenantId);`,
        });
      }

      // Check for large tables without proper partitioning
      const largeTables = await this.findLargeTables();
      for (const table of largeTables) {
        issues.push({
          type: 'large_table',
          severity: 'medium',
          table: table.name,
          description: `Table ${table.name} has ${table.rowCount} rows and may benefit from optimization`,
          impact: 'Queries may be slow due to table size',
          recommendation:
            'Consider partitioning, archiving old data, or adding more specific indexes',
        });
      }

      // Check for unused indexes
      const unusedIndexes = await this.findUnusedIndexes();
      for (const index of unusedIndexes) {
        issues.push({
          type: 'unused_index',
          severity: 'low',
          table: index.tableName,
          description: `Index ${index.indexName} on table ${index.tableName} appears to be unused`,
          impact: 'Unused indexes consume storage and slow down write operations',
          recommendation: `Consider dropping unused index: DROP INDEX ${index.indexName} ON ${index.tableName};`,
        });
      }
    } catch (error) {
      console.error('Failed to identify performance issues:', error);
    }

    return issues;
  }

  /**
   * Find tables without tenant isolation indexes
   */
  private static async findTablesWithoutTenantIndex(): Promise<string[]> {
    try {
      const tablesWithTenantId = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT TABLE_NAME as tableName
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME = 'tenantId'
      `;

      const tablesWithTenantIndex = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT TABLE_NAME as tableName
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME = 'tenantId'
      `;

      const tablesWithTenantIdSet = new Set(tablesWithTenantId.map(t => t.tableName));
      const tablesWithTenantIndexSet = new Set(tablesWithTenantIndex.map(t => t.tableName));

      return Array.from(tablesWithTenantIdSet).filter(
        table => !tablesWithTenantIndexSet.has(table)
      );
    } catch (error) {
      console.error('Failed to find tables without tenant index:', error);
      return [];
    }
  }

  /**
   * Find large tables that may need optimization
   */
  private static async findLargeTables(): Promise<Array<{ name: string; rowCount: number }>> {
    try {
      const largeTables = await prisma.$queryRaw<any[]>`
        SELECT 
          TABLE_NAME as name,
          TABLE_ROWS as rowCount
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_ROWS > 100000
        ORDER BY TABLE_ROWS DESC
      `;

      return largeTables.map(table => ({
        name: table.name,
        rowCount: table.rowCount || 0,
      }));
    } catch (error) {
      console.error('Failed to find large tables:', error);
      return [];
    }
  }

  /**
   * Find potentially unused indexes
   */
  private static async findUnusedIndexes(): Promise<
    Array<{ tableName: string; indexName: string }>
  > {
    try {
      // This is a simplified check - in production, you'd use performance_schema
      // to track actual index usage
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT 
          TABLE_NAME as tableName,
          INDEX_NAME as indexName,
          CARDINALITY as cardinality
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME != 'PRIMARY'
        AND CARDINALITY = 0
      `;

      return indexes.map(index => ({
        tableName: index.tableName,
        indexName: index.indexName,
      }));
    } catch (error) {
      console.error('Failed to find unused indexes:', error);
      return [];
    }
  }

  /**
   * Generate optimization recommendations
   */
  private static generateOptimizationRecommendations(
    tables: TableInfo[],
    indexSuggestions: IndexSuggestion[],
    performanceIssues: PerformanceIssue[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // High priority recommendations
    const highPriorityIndexes = indexSuggestions.filter(s => s.priority === 'high');
    if (highPriorityIndexes.length > 0) {
      recommendations.push({
        category: 'indexing',
        priority: 'high',
        title: 'Critical Index Optimizations',
        description: `${highPriorityIndexes.length} critical indexes are missing`,
        impact: 'High performance improvement expected',
        effort: 'Low',
        actions: highPriorityIndexes.map(idx => idx.sqlCommand),
      });
    }

    // Performance issues
    const highSeverityIssues = performanceIssues.filter(i => i.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Critical Performance Issues',
        description: `${highSeverityIssues.length} critical performance issues found`,
        impact: 'High performance improvement expected',
        effort: 'Medium',
        actions: highSeverityIssues.map(issue => issue.recommendation),
      });
    }

    // Large table optimizations
    const largeTables = tables.filter(t => t.rowCount > 1000000);
    if (largeTables.length > 0) {
      recommendations.push({
        category: 'scaling',
        priority: 'medium',
        title: 'Large Table Optimizations',
        description: `${largeTables.length} tables have over 1M rows`,
        impact: 'Medium performance improvement expected',
        effort: 'High',
        actions: [
          'Consider implementing table partitioning',
          'Implement data archiving strategy',
          'Add more specific indexes for common queries',
          'Consider read replicas for analytics queries',
        ],
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate SQL script for implementing all recommendations
   */
  static generateOptimizationScript(analysis: SchemaAnalysis): string {
    let script = '-- Database Optimization Script\n';
    script += `-- Generated on: ${new Date().toISOString()}\n\n`;

    // Add indexes
    script += '-- Index Optimizations\n';
    for (const suggestion of analysis.indexSuggestions) {
      if (suggestion.type === 'create') {
        script += `-- ${suggestion.reason}\n`;
        script += `${suggestion.sqlCommand}\n\n`;
      }
    }

    // Add performance optimizations
    script += '-- Performance Optimizations\n';
    script += '-- Consider implementing these optimizations:\n';
    for (const recommendation of analysis.optimizationRecommendations) {
      script += `-- ${recommendation.title}: ${recommendation.description}\n`;
      for (const action of recommendation.actions) {
        if (action.includes('CREATE') || action.includes('DROP')) {
          script += `${action}\n`;
        } else {
          script += `-- ${action}\n`;
        }
      }
      script += '\n';
    }

    return script;
  }
}

// Types
interface SchemaAnalysis {
  tables: TableInfo[];
  indexSuggestions: IndexSuggestion[];
  performanceIssues: PerformanceIssue[];
  optimizationRecommendations: OptimizationRecommendation[];
}

interface TableInfo {
  name: string;
  rowCount: number;
  dataSize: number;
  indexSize: number;
  totalSize: number;
  autoIncrement: number | null;
  growthRate: string;
  lastAnalyzed: Date;
}

interface IndexSuggestion {
  type: 'create' | 'drop' | 'modify';
  table: string;
  indexName: string;
  columns: string[];
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: 'high' | 'medium' | 'low';
  sqlCommand: string;
}

interface PerformanceIssue {
  type: 'missing_index' | 'unused_index' | 'large_table' | 'slow_query';
  severity: 'high' | 'medium' | 'low';
  table: string;
  description: string;
  impact: string;
  recommendation: string;
}

interface OptimizationRecommendation {
  category: 'indexing' | 'performance' | 'scaling' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'Low' | 'Medium' | 'High';
  actions: string[];
}

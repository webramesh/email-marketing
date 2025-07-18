import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface TablePagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export interface TableProps<T = any> extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Table columns configuration
   */
  columns: TableColumn<T>[];
  
  /**
   * Table data
   */
  data: T[];
  
  /**
   * Loading state
   */
  loading?: boolean;
  
  /**
   * Error state
   */
  error?: string | null;
  
  /**
   * Pagination configuration
   */
  pagination?: TablePagination;
  
  /**
   * Whether the table has a border
   */
  bordered?: boolean;
  
  /**
   * Whether the table has striped rows
   */
  striped?: boolean;
  
  /**
   * Whether the table has hover effect on rows
   */
  hover?: boolean;
  
  /**
   * Whether the table is compact
   */
  compact?: boolean;
  
  /**
   * Empty state message
   */
  emptyMessage?: string;
}

/**
 * Advanced Table component with sorting, pagination, and loading states
 */
export const Table = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  error = null,
  pagination,
  bordered = false,
  striped = false,
  hover = true,
  compact = false,
  emptyMessage = 'No data available',
  className,
  ...props
}: TableProps<T>) => {
  if (loading) {
    return (
      <div className={cn('w-full', className)} {...props}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('w-full p-8 text-center', className)} {...props}>
        <div className="text-red-600 mb-2">Error loading data</div>
        <div className="text-sm text-gray-500">{error}</div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className="overflow-auto">
        <table className={cn(
          'w-full caption-bottom text-sm',
          bordered && 'border border-gray-200'
        )}>
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'h-12 px-4 text-left align-middle font-medium text-gray-700',
                    column.sortable && 'cursor-pointer hover:bg-gray-100'
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(
            striped && '[&>tr:nth-child(odd)]:bg-gray-50',
            hover && '[&>tr:hover]:bg-gray-100'
          )}>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 px-4 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={index} className="border-b border-gray-200 transition-colors">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 align-middle',
                        compact ? 'py-2' : 'py-4'
                      )}
                    >
                      {column.render ? column.render(item) : item[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing {((pagination.currentPage - 1) * Math.ceil(pagination.totalItems / pagination.totalPages)) + 1} to{' '}
            {Math.min(pagination.currentPage * Math.ceil(pagination.totalItems / pagination.totalPages), pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
            >
              Previous
            </Button>
            
            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNumber = i + 1;
                const isCurrentPage = pageNumber === pagination.currentPage;
                
                return (
                  <Button
                    key={pageNumber}
                    variant={isCurrentPage ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => pagination.onPageChange(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

Table.displayName = 'Table';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

/**
 * Table header component
 */
export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn('bg-secondary-50', className)}
        {...props}
      />
    );
  }
);
TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Whether the table body has striped rows
   */
  striped?: boolean;
  
  /**
   * Whether the table body has hover effect on rows
   */
  hover?: boolean;
}

/**
 * Table body component
 */
export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, striped = false, hover = false, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={cn(
          striped && '[&>tr:nth-child(odd)]:bg-secondary-50',
          hover && '[&>tr:hover]:bg-secondary-100',
          className
        )}
        {...props}
      />
    );
  }
);
TableBody.displayName = 'TableBody';

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

/**
 * Table footer component
 */
export const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        className={cn('bg-secondary-50 font-medium', className)}
        {...props}
      />
    );
  }
);
TableFooter.displayName = 'TableFooter';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Whether the row is selected
   */
  selected?: boolean;
}

/**
 * Table row component
 */
export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-secondary-200 transition-colors',
          selected && 'bg-primary-50',
          className
        )}
        {...props}
      />
    );
  }
);
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

/**
 * Table head component
 */
export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-secondary-700',
          className
        )}
        {...props}
      />
    );
  }
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /**
   * Whether the cell is compact
   */
  compact?: boolean;
}

/**
 * Table cell component
 */
export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, compact = false, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn(
          'px-4 align-middle',
          compact ? 'py-2' : 'py-4',
          className
        )}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

/**
 * Table caption component
 */
export const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <caption
        ref={ref}
        className={cn('mt-4 text-sm text-secondary-500', className)}
        {...props}
      />
    );
  }
);
TableCaption.displayName = 'TableCaption';
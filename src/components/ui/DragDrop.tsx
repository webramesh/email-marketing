import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface DraggableItem {
  /**
   * Unique identifier for the item
   */
  id: string;
  
  /**
   * Item type
   */
  type: string;
  
  /**
   * Item content
   */
  content: React.ReactNode;
  
  /**
   * Additional data for the item
   */
  data?: Record<string, any>;
}

export interface DragDropProps {
  /**
   * Available items that can be dragged
   */
  availableItems: DraggableItem[];
  
  /**
   * Currently placed items
   */
  placedItems: DraggableItem[];
  
  /**
   * Function called when items are updated
   */
  onItemsChange: (items: DraggableItem[]) => void;
  
  /**
   * Whether to allow reordering of placed items
   */
  allowReordering?: boolean;
  
  /**
   * Whether to render items in a grid layout
   */
  gridLayout?: boolean;
  
  /**
   * Additional class name for the container
   */
  className?: string;
}

/**
 * Drag and drop component for building interfaces like email builders and workflow designers
 */
export function DragDrop({
  availableItems,
  placedItems,
  onItemsChange,
  allowReordering = true,
  gridLayout = false,
  className,
}: DragDropProps) {
  const [draggingItem, setDraggingItem] = useState<DraggableItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  
  // Handle drag start
  const handleDragStart = (item: DraggableItem, isPlaced: boolean = false) => {
    setDraggingItem({ ...item, data: { ...item.data, isPlaced } });
  };
  
  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    if (index !== undefined) {
      setDragOverIndex(index);
    }
  };
  
  // Handle drop on the drop area
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggingItem) return;
    
    const isPlaced = draggingItem.data?.isPlaced;
    const newItems = [...placedItems];
    
    if (isPlaced) {
      // Reordering existing item
      if (allowReordering && dragOverIndex !== null) {
        const itemIndex = placedItems.findIndex(item => item.id === draggingItem.id);
        if (itemIndex !== -1) {
          const [movedItem] = newItems.splice(itemIndex, 1);
          newItems.splice(dragOverIndex, 0, movedItem);
          onItemsChange(newItems);
        }
      }
    } else {
      // Adding new item
      const newItem = { ...draggingItem };
      delete newItem.data?.isPlaced;
      
      if (dragOverIndex !== null) {
        newItems.splice(dragOverIndex, 0, newItem);
      } else {
        newItems.push(newItem);
      }
      
      onItemsChange(newItems);
    }
    
    setDraggingItem(null);
    setDragOverIndex(null);
  };
  
  // Handle removing an item
  const handleRemoveItem = (id: string) => {
    const newItems = placedItems.filter(item => item.id !== id);
    onItemsChange(newItems);
  };
  
  // Reset drag state when mouse leaves the window
  useEffect(() => {
    const handleMouseLeave = () => {
      setDraggingItem(null);
      setDragOverIndex(null);
    };
    
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);
  
  return (
    <div className={cn('flex flex-col lg:flex-row gap-6', className)}>
      {/* Available items */}
      <div className="w-full lg:w-64 flex-shrink-0 border border-secondary-200 rounded-md bg-white p-4">
        <h3 className="text-sm font-medium text-secondary-900 mb-3">Available Components</h3>
        <div className="space-y-2">
          {availableItems.map(item => (
            <div
              key={item.id}
              className="p-3 border border-secondary-200 rounded-md bg-secondary-50 cursor-grab hover:bg-secondary-100"
              draggable
              onDragStart={() => handleDragStart(item)}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
      
      {/* Drop area */}
      <div
        ref={dropAreaRef}
        className={cn(
          'flex-1 min-h-[300px] border-2 border-dashed border-secondary-300 rounded-md bg-secondary-50 p-4',
          dragOverIndex === null && draggingItem && 'border-primary-300 bg-primary-50'
        )}
        onDragOver={e => handleDragOver(e)}
        onDrop={handleDrop}
      >
        <h3 className="text-sm font-medium text-secondary-900 mb-3">Canvas</h3>
        
        {placedItems.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-secondary-500">
            Drag and drop items here
          </div>
        ) : (
          <div className={cn(
            gridLayout ? 'grid grid-cols-2 gap-4' : 'space-y-2'
          )}>
            {placedItems.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  'p-4 border border-secondary-200 rounded-md bg-white',
                  dragOverIndex === index && 'border-primary-500 bg-primary-50',
                  'relative'
                )}
                draggable={allowReordering}
                onDragStart={() => handleDragStart(item, true)}
                onDragOver={e => handleDragOver(e, index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-secondary-500">{item.type}</span>
                  <button
                    type="button"
                    className="text-secondary-400 hover:text-secondary-600"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                {item.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface DragDropItemProps {
  /**
   * Item type
   */
  type: string;
  
  /**
   * Item content
   */
  children: React.ReactNode;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Drag and drop item component
 */
export function DragDropItem({
  type,
  children,
  className,
}: DragDropItemProps) {
  return (
    <div className={cn('p-3 border border-secondary-200 rounded-md', className)}>
      <div className="text-xs font-medium text-secondary-500 mb-1">{type}</div>
      {children}
    </div>
  );
}
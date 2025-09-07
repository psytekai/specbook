# Table UI Design Patterns & React Implementation Guide

## Core Design Principles

### 1. Prioritize Readability Above All
Data tables should be free from clutter or distractions. Every design decision should enhance data comprehension.

**React Implementation:**
```tsx
// Use clean, semantic component structure
const DataTable: React.FC<TableProps> = ({ data, columns }) => {
  return (
    <table className="clean-table" role="table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.id} scope="col">{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <TableRow key={row.id} data={row} />
        ))}
      </tbody>
    </table>
  );
};
```

### 2. Strategic Color Usage
Never use too many colors. Use colors only for specific purposes: header focus, highlighting details, or status indication.

**React Pattern:**
```tsx
const useTableColors = () => {
  const colorScheme = useMemo(() => ({
    header: 'bg-slate-50 text-slate-700',
    zebraEven: 'bg-white',
    zebraOdd: 'bg-slate-25',
    highlight: 'bg-blue-50',
    status: {
      success: 'text-green-600',
      warning: 'text-amber-600',
      error: 'text-red-600'
    }
  }), []);
  
  return colorScheme;
};
```

### 3. Zebra Striping with Light Shades
Implement alternating row colors using only light shades to improve readability.

**React Implementation:**
```tsx
const TableRow: React.FC<RowProps> = ({ data, index }) => {
  const rowClass = useMemo(() => 
    `table-row ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`,
    [index]
  );
  
  return (
    <tr className={rowClass}>
      {/* Row content */}
    </tr>
  );
};
```

## Typography & Spacing Standards

### 4. Responsive Font Sizing
Choose appropriate font and table sizes based on information density.

**React Hook:**
```tsx
const useResponsiveTableSizing = (dataLength: number) => {
  return useMemo(() => {
    if (dataLength > 100) {
      return { fontSize: 'text-sm', rowHeight: 'h-10' }; // Condensed: 40px
    } else if (dataLength > 50) {
      return { fontSize: 'text-base', rowHeight: 'h-12' }; // Regular: 48px
    }
    return { fontSize: 'text-base', rowHeight: 'h-14' }; // Relaxed: 56px
  }, [dataLength]);
};
```

### 5. Standard Row Heights
- **Condensed**: 40px (high-density data)
- **Regular**: 48px (standard use)
- **Relaxed**: 56px (comfortable reading)

### 6. Tabular Numbers for Numerical Data
Use monospace fonts for numerical columns to ensure proper alignment.

**CSS-in-JS Pattern:**
```tsx
const NumericalCell: React.FC<{ value: number }> = ({ value }) => (
  <td className="font-mono text-right tabular-nums">
    {value.toLocaleString()}
  </td>
);
```

## Interactive Features & React Patterns

### 7. Sortable Headers with React State
```tsx
const useSortableTable = <T,>(data: T[], defaultSort?: SortConfig) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(defaultSort || null);
  
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);
  
  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  return { sortedData, sortConfig, handleSort };
};
```

### 8. Resizable Columns
```tsx
const useResizableColumns = (initialWidths: Record<string, number>) => {
  const [columnWidths, setColumnWidths] = useState(initialWidths);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  const handleResizeStart = useCallback((columnId: string) => {
    setIsResizing(columnId);
  }, []);
  
  const handleResize = useCallback((columnId: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [columnId]: width }));
  }, []);
  
  return { columnWidths, isResizing, handleResizeStart, handleResize };
};
```

### 9. Editable Table Cells
```tsx
const EditableCell: React.FC<EditableCellProps> = ({ 
  value, 
  onChange, 
  onSave,
  type = 'text' 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
  const handleSave = useCallback(() => {
    onChange(editValue);
    onSave?.(editValue);
    setIsEditing(false);
  }, [editValue, onChange, onSave]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [value, handleSave]);
  
  if (isEditing) {
    return (
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full border-0 outline-none bg-transparent"
      />
    );
  }
  
  return (
    <span 
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-blue-50 px-1 rounded"
    >
      {value}
    </span>
  );
};
```

## Performance & Large Dataset Handling

### 10. Virtual Scrolling for Large Tables
```tsx
const VirtualizedTable: React.FC<VirtualTableProps> = ({ 
  data, 
  rowHeight = 48,
  containerHeight = 400 
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(start + visibleCount + 1, data.length);
    
    return { start, end };
  }, [scrollTop, rowHeight, containerHeight, data.length]);
  
  const visibleData = useMemo(() => 
    data.slice(visibleRange.start, visibleRange.end),
    [data, visibleRange]
  );
  
  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}>
          {visibleData.map((row, index) => (
            <TableRow 
              key={visibleRange.start + index} 
              data={row} 
              style={{ height: rowHeight }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 11. Pagination with React State
```tsx
const usePagination = <T,>(data: T[], itemsPerPage: number = 25) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);
  
  return {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};
```

## Accessibility & UX Patterns

### 12. Keyboard Navigation
```tsx
const useTableKeyboardNavigation = (rowCount: number, colCount: number) => {
  const [focusedCell, setFocusedCell] = useState<{row: number, col: number} | null>(null);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!focusedCell) return;
    
    const { row, col } = focusedCell;
    
    switch (e.key) {
      case 'ArrowUp':
        if (row > 0) setFocusedCell({ row: row - 1, col });
        break;
      case 'ArrowDown':
        if (row < rowCount - 1) setFocusedCell({ row: row + 1, col });
        break;
      case 'ArrowLeft':
        if (col > 0) setFocusedCell({ row, col: col - 1 });
        break;
      case 'ArrowRight':
        if (col < colCount - 1) setFocusedCell({ row, col: col + 1 });
        break;
    }
  }, [focusedCell, rowCount, colCount]);
  
  return { focusedCell, setFocusedCell, handleKeyDown };
};
```

### 13. Empty State Handling
```tsx
const EmptyStateCell: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <td className="text-slate-400 italic text-center">
    {children || '—'}
  </td>
);

// Usage pattern
const renderCell = (value: any) => {
  if (value === null || value === undefined || value === '') {
    return <EmptyStateCell>No data</EmptyStateCell>;
  }
  return <td>{value}</td>;
};
```

## Advanced Features

### 14. Frozen Headers/Columns
```tsx
const useStickyHeaders = () => {
  const tableRef = useRef<HTMLTableElement>(null);
  
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    headers.forEach(header => {
      header.style.position = 'sticky';
      header.style.top = '0';
      header.style.zIndex = '10';
    });
  }, []);
  
  return tableRef;
};
```

### 15. Column Visibility Toggle
```tsx
const useColumnVisibility = (columns: Column[]) => {
  const [visibleColumns, setVisibleColumns] = useState(
    () => columns.reduce((acc, col) => ({ ...acc, [col.id]: true }), {})
  );
  
  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  }, []);
  
  const filteredColumns = useMemo(() => 
    columns.filter(col => visibleColumns[col.id]),
    [columns, visibleColumns]
  );
  
  return { visibleColumns, toggleColumn, filteredColumns };
};
```

## React Best Practices Integration

### Performance Optimization
- Use `React.memo` for table rows when data is stable
- Memoize sort and filter functions with `useCallback`
- Calculate derived state during rendering, not in effects
- Use `useMemo` for expensive calculations like sorting/filtering

### Component Architecture
- Never define table components inside other components
- Extract reusable table logic into custom hooks
- Use TypeScript for proper typing of table data and props
- Implement proper cleanup in useEffect for event listeners

### State Management
- Structure table state to avoid redundant data
- Use Context wisely for table configuration, memoize context values
- Prefer immutable updates for table data modifications
- Calculate derived state (filtered, sorted data) during rendering

This guide provides a comprehensive foundation for building performant, accessible, and user-friendly data tables in React applications while following modern best practices.
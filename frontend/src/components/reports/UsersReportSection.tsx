'use client';

import React, { useMemo, useState } from 'react'; 
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  FilterFn,
  Row,
  Column, 
  Table, 
  ColumnFiltersState, 
} from '@tanstack/react-table';
import { format, parseISO, isValid } from 'date-fns';

// Interfaces (matching those in page.tsx)
interface UserReportEntry {
  id: string;
  displayName?: string | null;
  email?: string | null;
  assignedRoleNames: string[];
  status?: string | null;
  createdAt?: string | null; 
}

interface UsersReport {
  data: UserReportEntry[];
  totalUsers: number;
}

interface UsersReportSectionProps {
  report: UsersReport | null;
  isLoading: boolean;
  error?: string | null; 
}

// Generic filter component for column headers
function ColumnFilter({ column, table }: { column: Column<any, any>; table: Table<any> }) {
  const columnFilterValue = column.getFilterValue();

  return (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      onClick={e => e.stopPropagation()} 
      placeholder={`Filter...`}
      className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded shadow-sm mt-1 p-1 focus:ring-indigo-500 focus:border-indigo-500"
    />
  );
}


const fuzzyFilter: FilterFn<any> = (row: Row<any>, columnId: string, value: any, addMeta: (meta: any) => void) => {
  const item = row.getValue(columnId);
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).toLowerCase().includes(String(value).toLowerCase());
  }
  if (Array.isArray(item)) {
    return item.some(subItem => String(subItem).toLowerCase().includes(String(value).toLowerCase()));
  }
  return false;
};

const UsersReportSection: React.FC<UsersReportSectionProps> = ({ report, isLoading, error }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]); 

  const columns = useMemo<ColumnDef<UserReportEntry>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: ({ column, table }) => (
          <div>
            <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
              Display Name {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
            </div>
            {column.getCanFilter() ? <ColumnFilter column={column} table={table} /> : null}
          </div>
        ),
        cell: info => info.getValue() || 'N/A',
        enableColumnFilter: true,
      },
      {
        accessorKey: 'email',
        header: ({ column, table }) => (
          <div>
            <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
              Email {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
            </div>
            {column.getCanFilter() ? <ColumnFilter column={column} table={table} /> : null}
          </div>
        ),
        cell: info => info.getValue() || 'N/A',
        enableColumnFilter: true,
      },
      {
        accessorKey: 'assignedRoleNames',
        header: ({ column, table }) => (
          <div>
            <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
              Roles {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
            </div>
            {column.getCanFilter() ? <ColumnFilter column={column} table={table} /> : null}
          </div>
        ),
        cell: info => {
          const roles = info.getValue() as string[];
          return roles && roles.length > 0 ? roles.join(', ') : 'No Roles';
        },
        filterFn: 'fuzzy', 
        enableColumnFilter: true,
      },
      {
        accessorKey: 'status',
        header: ({ column, table }) => (
          <div>
            <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
              Status {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
            </div>
            {column.getCanFilter() ? <ColumnFilter column={column} table={table} /> : null}
          </div>
        ),
        cell: info => {
            const status = info.getValue() as string | null;
            const statusClass = status === 'active' 
                ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100';
            return status ? <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}>{status}</span> : 'N/A';
        },
        enableColumnFilter: true,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column, table }) => (
          <div>
            <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
              Created At {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
            </div>
            {/* No filter for date for now, can be added with a date picker */}
          </div>
        ),
        cell: info => {
          const dateValue = info.getValue() as string | null;
          if (dateValue) {
            const dateObj = parseISO(dateValue);
            return isValid(dateObj) ? format(dateObj, 'MMM dd, yyyy, HH:mm') : 'Invalid Date';
          }
          return 'N/A';
        },
        enableColumnFilter: false, 
      },
      // User ID column removed
      // {
      //   accessorKey: 'id',
      //   header: ({ column, table }) => (
      //       <div>
      //         <div onClick={column.getToggleSortingHandler()} className="cursor-pointer">
      //           User ID {column.getIsSorted() === 'asc' ? '🔼' : column.getIsSorted() === 'desc' ? '🔽' : ''}
      //         </div>
      //         {column.getCanFilter() ? <ColumnFilter column={column} table={table} /> : null}
      //       </div>
      //     ),
      //   cell: info => info.getValue(),
      //   enableColumnFilter: true,
      // },
    ],
    []
  );

  const tableData = useMemo(() => report?.data || [], [report]);

  const table = useReactTable({
    data: tableData,
    columns,
    filterFns: { fuzzy: fuzzyFilter }, 
    state: { 
        sorting, 
        globalFilter,
        columnFilters, 
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters, 
    globalFilterFn: fuzzyFilter, 
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportToCsv = () => {
    if (!report?.data) return;
    
    // Filter out the 'id' column from headers and data for CSV export
    const activeColumns = columns.filter(col => col.accessorKey !== 'id');

    const csvHeaders = activeColumns.map(colDef => {
        if (typeof colDef.header === 'string') return colDef.header;
        // For complex headers (like those with filter inputs), extract a simple name
        if (colDef.accessorKey) return String(colDef.accessorKey); 
        // Fallback if accessorKey is not directly on colDef (it should be for our simple cases)
        // This part might need adjustment based on how headers are structured if they become more complex
        const headerContext = { column: { getIsSorted: () => false, getToggleSortingHandler: () => {} }, table } as any;
        const renderedHeader = typeof colDef.header === 'function' ? colDef.header(headerContext) : colDef.id;
        if (typeof renderedHeader === 'string') return renderedHeader;
        // If header is a React element, try to get a meaningful string (e.g., from a child or prop)
        // This is a simplified example; robust extraction might be needed for complex React elements
        if (React.isValidElement(renderedHeader) && renderedHeader.props.children && typeof renderedHeader.props.children[0] === 'string') {
            return renderedHeader.props.children[0].trim();
        }
        return colDef.id || '';
    }).join(',');


    const csvRows = table.getRowModel().rows.map(row => { 
      return activeColumns.map(colDef => {
        let cellValue: any;
        const accessor = colDef.accessorKey as keyof UserReportEntry;
        if (accessor) {
          cellValue = row.original[accessor];
        } else if (typeof colDef.cell === 'function') {
          // Find the cell context for the current column to render it
          const cellContext = row.getVisibleCells().find(c => c.column.id === colDef.id)?.getContext();
          if (cellContext) {
            cellValue = flexRender(colDef.cell, cellContext);
          } else {
            cellValue = ''; // Should not happen if column is in activeColumns
          }
        }
        
        if (accessor === 'assignedRoleNames' && Array.isArray(cellValue)) {
          cellValue = cellValue.join('; ');
        } else if (accessor === 'createdAt' && typeof cellValue === 'string') {
            const dateObj = parseISO(cellValue);
            cellValue = isValid(dateObj) ? format(dateObj, 'yyyy-MM-dd HH:mm:ss') : 'Invalid Date';
        } else if (React.isValidElement(cellValue)) { 
            const getText = (element: React.ReactNode): string => {
                if (typeof element === 'string') return element;
                if (typeof element === 'number') return String(element);
                if (Array.isArray(element)) return element.map(getText).join('');
                if (React.isValidElement(element) && element.props.children) {
                    return getText(element.props.children);
                }
                return '';
            };
            cellValue = getText(cellValue);
        }
        
        return `"${String(cellValue ?? '').replace(/"/g, '""')}"`;
      }).join(',');
    }).join('\\n');

    const csvContent = `data:text/csv;charset=utf-8,${csvHeaders}\\n${csvRows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400">Loading users report...</p>;
  if (error) return <p className="text-red-500 dark:text-red-400">Error loading users data: {error}</p>;
  if (!report || report.data.length === 0) return <p className="text-gray-500 dark:text-gray-400">No user data available.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(String(e.target.value))}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:w-1/3 w-full dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Global search..."
        />
        <button
          onClick={exportToCsv}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
        >
          <span className="material-icons mr-2 text-base">download</span>
          Export Users CSV
        </button>
      </div>
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No results found for your filter.
            </div>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        Total Users: {report.totalUsers}
      </div>
    </div>
  );
};

export default UsersReportSection;
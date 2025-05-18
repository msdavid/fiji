'use client';

import React, { useMemo } from 'react';
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
} from '@tanstack/react-table';
import { format, parseISO, isValid } from 'date-fns';

// Interfaces (matching those in page.tsx)
interface UserReportEntry {
  id: string;
  displayName?: string | null;
  email?: string | null;
  assignedRoleNames: string[];
  status?: string | null;
  createdAt?: string | null; // Dates from backend are often ISO strings
}

interface UsersReport {
  data: UserReportEntry[];
  totalUsers: number;
}

interface UsersReportSectionProps {
  report: UsersReport | null;
  isLoading: boolean;
  error?: string | null; // Optional error prop
}

const fuzzyFilter: FilterFn<any> = (row: Row<any>, columnId: string, value: any, addMeta: (meta: any) => void) => {
  const item = row.getValue(columnId);
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).toLowerCase().includes(String(value).toLowerCase());
  }
  // For arrays like assignedRoleNames, check if any element contains the value
  if (Array.isArray(item)) {
    return item.some(subItem => String(subItem).toLowerCase().includes(String(value).toLowerCase()));
  }
  return false;
};

const UsersReportSection: React.FC<UsersReportSectionProps> = ({ report, isLoading, error }) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');

  const columns = useMemo<ColumnDef<UserReportEntry>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Display Name',
        cell: info => info.getValue() || 'N/A',
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: info => info.getValue() || 'N/A',
      },
      {
        accessorKey: 'assignedRoleNames',
        header: 'Roles',
        cell: info => {
          const roles = info.getValue() as string[];
          return roles && roles.length > 0 ? roles.join(', ') : 'No Roles';
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: info => {
            const status = info.getValue() as string | null;
            const statusClass = status === 'active' 
                ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100';
            return status ? <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}>{status}</span> : 'N/A';
        }
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
        cell: info => {
          const dateValue = info.getValue() as string | null;
          if (dateValue) {
            const dateObj = parseISO(dateValue);
            return isValid(dateObj) ? format(dateObj, 'MMM dd, yyyy, HH:mm') : 'Invalid Date';
          }
          return 'N/A';
        },
      },
      {
        accessorKey: 'id',
        header: 'User ID',
        cell: info => info.getValue(),
      },
    ],
    []
  );

  const tableData = useMemo(() => report?.data || [], [report]);

  const table = useReactTable({
    data: tableData,
    columns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const exportToCsv = () => {
    if (!report?.data) return;
    
    const csvHeaders = columns.map(colDef => {
        if (typeof colDef.header === 'function') {
            return colDef.accessorKey || ''; 
        }
        return colDef.header as string;
    }).join(',');

    const csvRows = table.getRowModel().rows.map(row => {
      return columns.map(colDef => {
        let cellValue: any;
        if (colDef.accessorKey) {
          cellValue = row.original[colDef.accessorKey as keyof UserReportEntry];
        } else if (typeof colDef.cell === 'function') {
          // This fallback might be too simple for complex cells, but okay for this table
          cellValue = flexRender(colDef.cell, { row } as any); 
        }

        if (colDef.accessorKey === 'assignedRoleNames' && Array.isArray(cellValue)) {
          cellValue = cellValue.join('; '); // Use semicolon for multi-value fields in CSV
        } else if (colDef.accessorKey === 'createdAt' && typeof cellValue === 'string') {
            const dateObj = parseISO(cellValue);
            cellValue = isValid(dateObj) ? format(dateObj, 'yyyy-MM-dd HH:mm:ss') : 'Invalid Date';
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
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:w-auto w-full dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Search users (name, email, role)..."
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
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: <span className="material-icons text-sm ml-1">arrow_upward</span>, desc: <span className="material-icons text-sm ml-1">arrow_downward</span> }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
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
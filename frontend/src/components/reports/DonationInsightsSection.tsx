'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
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
import { format, isValid, parseISO } from 'date-fns'; // Import isValid and parseISO

// Interfaces (matching those in page.tsx)
interface DonationTypeSummary {
  type: string;
  count: number;
  totalAmount?: number | null;
}

interface MonetaryDonationTrendEntry {
  period: string; // "YYYY-MM"
  totalAmount: number;
  count: number;
}

interface ReportDonationEntry {
  id: string;
  donorDisplayName?: string | null;
  type: string;
  amount?: number | null;
  description?: string | null;
  dateReceived: string; // ISO string or YYYY-MM-DD
}

interface DonationInsightsReport {
  breakdownByType: DonationTypeSummary[];
  monetaryTrend: MonetaryDonationTrendEntry[];
  recentDonations: ReportDonationEntry[];
  totalMonetaryAmountOverall: number;
  totalDonationsCountOverall: number;
}

interface DonationInsightsSectionProps {
  report: DonationInsightsReport | null;
  isLoading: boolean;
  error?: string | null;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const fuzzyFilter: FilterFn<any> = (row: Row<any>, columnId: string, value: any, addMeta: (meta: any) => void) => {
  const item = row.getValue(columnId);
  return String(item).toLowerCase().includes(String(value).toLowerCase());
};

const getChartColors = (isDark: boolean) => ({
    text: isDark ? '#FFFFFF' : '#374151',
    ticks: isDark ? '#D1D5DB' : '#4B5563',
    pieSliceColors: [
        isDark ? 'rgba(99, 102, 241, 0.7)' : 'rgba(99, 102, 241, 0.9)',   // Indigo
        isDark ? 'rgba(22, 163, 74, 0.7)' : 'rgba(22, 163, 74, 0.9)',    // Green
        isDark ? 'rgba(234, 179, 8, 0.7)' : 'rgba(234, 179, 8, 0.9)',     // Yellow
        isDark ? 'rgba(244, 63, 94, 0.7)' : 'rgba(244, 63, 94, 0.9)',     // Rose
        isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.9)',   // Blue
    ],
    lineChartBorder: isDark ? 'rgba(79, 70, 229, 1)' : 'rgba(79, 70, 229, 1)',
    lineChartBackground: isDark ? 'rgba(79, 70, 229, 0.5)' : 'rgba(79, 70, 229, 0.5)',
});


const DonationInsightsSection: React.FC<DonationInsightsSectionProps> = ({ report, isLoading, error }) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    // Ensure this runs client-side only
    if (typeof window !== 'undefined') {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
    }
  }, []);
  
  const chartColors = getChartColors(isDarkMode);

  const columns = useMemo<ColumnDef<ReportDonationEntry>[]>(
    () => [
      {
        accessorKey: 'dateReceived',
        header: 'Date',
        cell: info => {
          const dateValue = info.getValue(); // Get value, could be undefined

          // Check if dateValue is a string and not empty
          if (typeof dateValue === 'string' && dateValue.trim() !== '') {
            let dateObj = parseISO(dateValue); // Try ISO format first
            if (!isValid(dateObj)) {
              // If ISO parsing fails, try new Date() for formats like YYYY-MM-DD
              dateObj = new Date(dateValue);
            }
            return isValid(dateObj) ? format(dateObj, 'MMM dd, yyyy') : 'Invalid Date';
          }
          return 'N/A'; // Return 'N/A' if dateValue is not a valid string
        }
      },
      { accessorKey: 'donorDisplayName', header: 'Donor', cell: info => info.getValue() || 'Anonymous' },
      { accessorKey: 'type', header: 'Type', cell: info => info.getValue() },
      { 
        accessorKey: 'amount', 
        header: 'Amount/Value', 
        cell: info => {
          const type = info.row.original.type;
          const amount = info.getValue() as number | null;
          if (type === 'monetary' && amount != null) { // Match backend 'monetary'
            return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return info.row.original.description || 'N/A';
        }
      },
    ],
    []
  );

  const tableData = useMemo(() => report?.recentDonations || [], [report]);
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

  const pieChartData = useMemo(() => {
    if (!report?.breakdownByType) return { labels: [], datasets: [] };
    return {
      labels: report.breakdownByType.map(d => `${d.type} (${d.count})`),
      datasets: [{
        label: 'Donations by Type (Count)',
        data: report.breakdownByType.map(d => d.count),
        backgroundColor: chartColors.pieSliceColors,
        borderColor: isDarkMode ? 'rgba(31, 41, 55, 1)' : 'rgba(255,255,255,1)',
        borderWidth: 2,
      }],
    };
  }, [report, chartColors, isDarkMode]);

  const lineChartData = useMemo(() => {
    if (!report?.monetaryTrend) return { labels: [], datasets: [] };
    return {
      labels: report.monetaryTrend.map(t => t.period),
      datasets: [{
        label: 'Monetary Donations ($)',
        data: report.monetaryTrend.map(t => t.totalAmount),
        fill: true,
        borderColor: chartColors.lineChartBorder,
        backgroundColor: chartColors.lineChartBackground,
        tension: 0.1,
      }],
    };
  }, [report, chartColors]);

  const commonChartOptions = (titleText: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: chartColors.text } },
      title: { display: true, text: titleText, color: chartColors.text },
    },
  });
  
  const lineChartOptionsSpecific = {
      ...commonChartOptions('Monthly Monetary Donations Trend'),
      scales: {
        x: { ticks: { color: chartColors.ticks } },
        y: { beginAtZero: true, ticks: { color: chartColors.ticks, callback: (value: any) => `$${value}` } },
      },
  };

  const exportToCsv = () => {
    if (!report?.recentDonations) return;
    const csvHeaders = columns.map(colDef => {
        // For complex headers or those returning JSX, provide a string representation
        if (typeof colDef.header === 'function') {
            // This is a simplified way; ideally, header definitions would have a 'meta.csvHeader' or similar
            return colDef.accessorKey || ''; // Fallback to accessorKey
        }
        return colDef.header as string;
    }).join(',');

    const csvRows = table.getRowModel().rows.map(row => {
        return columns.map(colDef => {
            let cellValue: any;
            if (colDef.accessorKey) {
                 cellValue = row.original[colDef.accessorKey as keyof ReportDonationEntry];
            } else if (typeof colDef.cell === 'function') {
                // If no accessorKey, try to render cell (might be complex) or use a specific export value
                // This part might need more robust handling for complex cells
                cellValue = flexRender(colDef.cell, { row } as any); // Simplified context
            }


            if (colDef.accessorKey === 'dateReceived') {
                // Use the already robust parsing logic from the cell renderer if possible,
                // or ensure similar robustness here.
                if (typeof cellValue === 'string' && cellValue.trim() !== '') {
                    let dateObj = parseISO(cellValue);
                    if (!isValid(dateObj)) {
                        dateObj = new Date(cellValue);
                    }
                    cellValue = isValid(dateObj) ? format(dateObj, 'yyyy-MM-dd') : 'Invalid Date';
                } else {
                    cellValue = 'N/A';
                }
            } else if (colDef.accessorKey === 'amount' && row.original.type === 'monetary') {
                cellValue = (cellValue as number | null)?.toString() ?? '';
            } else if (colDef.accessorKey === 'amount') { // For non-monetary, use description
                cellValue = row.original.description || '';
            }
            return `"${String(cellValue ?? '').replace(/"/g, '""')}"`;
        }).join(',');
    }).join('\\n');
    const csvContent = `data:text/csv;charset=utf-8,${csvHeaders}\\n${csvRows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "recent_donations_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400">Loading donation insights...</p>;
  if (error) return <p className="text-red-500 dark:text-red-400">Error loading data: {error}</p>;
  if (!report || report.totalDonationsCountOverall === 0) return <p className="text-gray-500 dark:text-gray-400">No donation data available.</p>;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="h-80 md:h-96 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <Pie options={commonChartOptions('Donation Types (by Count)')} data={pieChartData} />
        </div>
        <div className="h-80 md:h-96 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <Line options={lineChartOptionsSpecific} data={lineChartData} />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-8">Recent Donations</h3>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(String(e.target.value))}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:w-auto w-full dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Search donor or description..."
        />
        <button
          onClick={exportToCsv}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
        >
          <span className="material-icons mr-2 text-base">download</span>
          Export Recent Donations
        </button>
      </div>
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
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
    </div>
  );
};

export default DonationInsightsSection;
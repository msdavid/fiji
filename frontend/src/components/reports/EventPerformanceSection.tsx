'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
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
import { format } from 'date-fns'; // For formatting dates

// Interfaces
interface EventPerformanceEntry {
  eventId: string;
  eventName: string;
  eventDate: string; // ISO string
  eventType?: string | null;
  registeredVolunteers: number;
  attendedVolunteers: number;
  attendanceRate: number;
}

interface EventPerformanceReport {
  data: EventPerformanceEntry[];
  totalEventsProcessed: number;
}

interface EventPerformanceSectionProps {
  report: EventPerformanceReport | null;
  isLoading: boolean;
  error?: string | null;
  dateRange?: { from: string; to: string } | null;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const fuzzyFilter: FilterFn<any> = (row: Row<any>, columnId: string, value: any, addMeta: (meta: any) => void) => {
  const item = row.getValue(columnId);
  return String(item).toLowerCase().includes(String(value).toLowerCase());
};

const EventPerformanceSection: React.FC<EventPerformanceSectionProps> = ({ report, isLoading, error, dateRange }) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateDarkMode = () => {
        const darkModeActive = document.documentElement.classList.contains('dark');
        setIsDarkMode(darkModeActive);
        
        // Set Chart.js global defaults based on dark mode
        if (darkModeActive) {
          ChartJS.defaults.color = '#FFFFFF'; // White text for dark mode
          ChartJS.defaults.borderColor = 'rgba(55, 65, 81, 0.3)';
          ChartJS.defaults.backgroundColor = 'rgba(55, 65, 81, 0.1)';
        } else {
          ChartJS.defaults.color = '#111827'; // Dark text for light mode
          ChartJS.defaults.borderColor = 'rgba(229, 231, 235, 0.3)';
          ChartJS.defaults.backgroundColor = 'rgba(229, 231, 235, 0.1)';
        }
      };
      
      // Initial check
      updateDarkMode();
      
      // Watch for changes
      const observer = new MutationObserver(updateDarkMode);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
      
      return () => observer.disconnect();
    }
  }, []);

  const columns = useMemo<ColumnDef<EventPerformanceEntry>[]>(
    () => [
      {
        accessorKey: 'eventName',
        header: 'Event Name',
        cell: info => info.getValue(),
      },
      {
        accessorKey: 'eventDate',
        header: 'Date',
        cell: info => format(new Date(info.getValue() as string), 'MMM dd, yyyy'),
      },
      {
        accessorKey: 'eventType',
        header: 'Type',
        cell: info => info.getValue() || 'N/A',
      },
      {
        accessorKey: 'registeredVolunteers',
        header: 'Registered',
        cell: info => info.getValue(),
      },
      {
        accessorKey: 'attendedVolunteers',
        header: 'Attended',
        cell: info => info.getValue(),
      },
      {
        accessorKey: 'attendanceRate',
        header: 'Attendance Rate',
        cell: info => `${((info.getValue() as number) * 100).toFixed(1)}%`,
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

  const chartData = useMemo(() => {
    if (!report?.data) return { labels: [], datasets: [] };
    // Select a subset of events for the chart, e.g., top 10 by date or a specific filter
    const chartEvents = [...report.data]
        .sort((a,b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()) // Show most recent
        .slice(0, 10) // Take top 10 recent
        .reverse(); // Reverse to show chronologically in chart if desired

    return {
      labels: chartEvents.map(e => `${e.eventName.substring(0,20)}... (${format(new Date(e.eventDate), 'MM/dd')})`),
      datasets: [
        {
          label: 'Registered Volunteers',
          data: chartEvents.map(e => e.registeredVolunteers),
          backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.7)' : 'rgba(59, 130, 246, 0.7)',
          borderColor: isDarkMode ? 'rgba(96, 165, 250, 1)' : 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
        {
          label: 'Attended Volunteers',
          data: chartEvents.map(e => e.attendedVolunteers),
          backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.7)' : 'rgba(16, 185, 129, 0.7)',
          borderColor: isDarkMode ? 'rgba(52, 211, 153, 1)' : 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [report, isDarkMode]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top' as const,
        labels: {
          color: isDarkMode ? '#111827' : '#FFFFFF',
          font: {
            family: 'Inter, sans-serif'
          }
        }
      },
      title: {
        display: true,
        text: 'Event Participation (Recent Events)',
        color: isDarkMode ? '#111827' : '#FFFFFF',
        font: {
          family: 'Inter, sans-serif',
          size: 16
        }
      },
    },
    scales: {
      x: {
        ticks: {
          color: isDarkMode ? '#111827' : '#FFFFFF'
        }
      },
      y: { 
        beginAtZero: true,
        ticks: {
          color: isDarkMode ? '#111827' : '#FFFFFF'
        }
      },
    },
  }), [isDarkMode]);

  const exportToCsv = () => {
    if (!report?.data) return;
    const headers = columns.map(col => col.header as string).join(',');
    const rows = table.getRowModel().rows.map(row => {
        return columns.map(col => {
            let cellValue = row.original[col.accessorKey as keyof EventPerformanceEntry];
            if (col.accessorKey === 'eventDate') {
                cellValue = format(new Date(cellValue as string), 'yyyy-MM-dd');
            } else if (col.accessorKey === 'attendanceRate') {
                cellValue = `${((cellValue as number) * 100).toFixed(1)}%`;
            }
            return `"${String(cellValue).replace(/"/g, '""')}"`;
        }).join(',');
    }).join('\\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "event_performance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400">Loading event performance data...</p>;
  if (error) return <p className="text-red-500 dark:text-red-400">Error loading data: {error}</p>;
  if (!report || report.data.length === 0) return <p className="text-gray-500 dark:text-gray-400">No event performance data available.</p>;

  return (
    <div>
      {dateRange && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center text-sm text-blue-700 dark:text-blue-300">
            <span className="material-icons text-sm mr-2">filter_alt</span>
            Date filter active: {dateRange.from} to {dateRange.to}
          </div>
        </div>
      )}
      <div className="mb-8 h-96 bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <Bar options={chartOptions} data={chartData} />
      </div>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(String(e.target.value))}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:w-auto w-full dark:bg-gray-700 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Search event name..."
        />
        <button
          onClick={exportToCsv}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center"
        >
          <span className="material-icons mr-2 text-base">download</span>
          Export CSV
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
    </div>
  );
};

export default EventPerformanceSection;
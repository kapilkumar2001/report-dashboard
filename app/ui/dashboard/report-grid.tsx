'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getReportsByFolder, toggleReportStatus, getReportCSV, type Report } from '@/app/lib/data/data';
import { ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';

interface ReportGridProps {
  reports: Report[];
  defaultFolder: string;
}

const parseCSV = (csv: string) => {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  const rows = lines.slice(1).map(line => 
    line.split(',').map(cell => cell.trim())
  ).filter(row => row.length === headers.length && row.some(cell => cell));
  return { headers, rows };
};

const filterReports = (reports: Report[], searchTerm: string, tagFilter: string | null, statusFilter: boolean | null) => {
  return reports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = !tagFilter || 
      report.tags.includes(tagFilter);

    const matchesStatus = statusFilter === null || 
      report.isActive === statusFilter;

    return matchesSearch && matchesTag && matchesStatus;
  });
};

const groupReportsByDate = (reports: Report[], searchTerm: string, tagFilter: string | null, statusFilter: boolean | null) => {
  const filteredReports = filterReports(reports, searchTerm, tagFilter, statusFilter);
  
  const grouped = filteredReports.reduce((acc, report) => {
    const date = report.date.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(report);
    return acc;
  }, {} as Record<string, Report[]>);

  return Object.entries(grouped)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
};

const PAGE_SIZE_OPTIONS = [5, 10, 50, 100, 'All'] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

type SortDirection = 'asc' | 'desc' | null;
type SortField = 'name' | 'date' | 'status' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
}

export default function ReportGrid({ reports: initialReports, defaultFolder }: ReportGridProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [groupByDate, setGroupByDate] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get('folder') || defaultFolder;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [gridPageSize, setGridPageSize] = useState<PageSize>(10);
  const [gridCurrentPage, setGridCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortState, setSortState] = useState<SortState>({ field: null, direction: null });
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<boolean | null>(null);
  const [newTag, setNewTag] = useState('');
  const [tagReportId, setTagReportId] = useState<string | null>(null);
  const [csvSortField, setCsvSortField] = useState<number | null>(null);
  const [csvSortDirection, setCsvSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [csvFilter, setCsvFilter] = useState('');

  useEffect(() => {
    setReports(initialReports);
    setIsLoading(false);
  }, [initialReports]);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const data = await getReportsByFolder(currentFolder);
        setReports(data);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
        setReports(initialReports);
      } finally {
        setIsLoading(false);
      }
    };

    if (currentFolder) fetchReports();
  }, [currentFolder, initialReports]);

  const handleToggleActive = async (reportId: string, currentStatus: boolean) => {
    try {
      await toggleReportStatus(reportId, !currentStatus);
      setReports(prevReports =>
        prevReports.map(report =>
          report.id === reportId
            ? { ...report, isActive: !report.isActive }
            : report
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleViewReport = async (report: Report) => {
    if (!report.isActive) {
      alert('This report is inactive and cannot be viewed');
      return;
    }

    try {
      const data = await getReportCSV(report.id);
      setCsvData(parseCSV(data));
      setSelectedReport(report.id);
    } catch (error) {
      console.error('Error fetching CSV:', error);
    }
  };

  const toggleGroup = (date: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allDates = groupedReports?.map(([date]) => date) || [];
    setExpandedGroups(new Set(allDates));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const groupedReports = groupByDate ? groupReportsByDate(reports, searchTerm, activeTagFilter, activeStatusFilter) : null;

  const getPaginatedData = (data: { headers: string[]; rows: string[][] }) => {
    if (pageSize === 'All') return data.rows;
    
    const startIndex = (currentPage - 1) * (typeof pageSize === 'number' ? pageSize : 0);
    const endIndex = startIndex + (typeof pageSize === 'number' ? pageSize : 0);
    return data.rows.slice(startIndex, endIndex);
  };

  const getPaginatedReports = (reports: Report[]) => {
    if (gridPageSize === 'All') return reports;
    
    const startIndex = (gridCurrentPage - 1) * (typeof gridPageSize === 'number' ? gridPageSize : 0);
    const endIndex = startIndex + (typeof gridPageSize === 'number' ? gridPageSize : 0);
    return reports.slice(startIndex, endIndex);
  };

  const displayedReports = getPaginatedReports(reports);

  const sortReports = (reports: Report[], { field, direction }: SortState) => {
    if (!field || !direction) return reports;

    return [...reports].sort((a, b) => {
      if (field === 'name') {
        return direction === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (field === 'date') {
        return direction === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (field === 'status') {
        return direction === 'asc'
          ? Number(a.isActive) - Number(b.isActive)
          : Number(b.isActive) - Number(a.isActive);
      }
      return 0;
    });
  };

  const getAllTags = (reports: Report[]) => {
    const tagSet = new Set<string>();
    reports.forEach(report => report.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  };

  const processedReports = useMemo(() => {
    let result = [...reports];
    result = filterReports(result, searchTerm, activeTagFilter, activeStatusFilter);
    result = sortReports(result, sortState);
    return result;
  }, [reports, searchTerm, activeTagFilter, activeStatusFilter, sortState]);

  const handleSort = (field: SortField) => {
    setSortState(prev => ({
      field,
      direction: 
        prev.field === field 
          ? prev.direction === 'asc' 
            ? 'desc' 
            : prev.direction === 'desc' 
              ? null 
              : 'asc'
          : 'asc'
    }));
  };

  const handleAddTag = (reportId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      const tagToAdd = newTag.trim();
      setReports(prevReports =>
        prevReports.map(report =>
          report.id === reportId && !report.tags.includes(tagToAdd)
            ? { ...report, tags: [...report.tags, tagToAdd] }
            : report
        )
      );
      setNewTag('');
      setTagReportId(null);
    }
  };

  const handleRemoveTag = (reportId: string, tagToRemove: string) => {
    setReports(prevReports =>
      prevReports.map(report =>
        report.id === reportId
          ? { ...report, tags: report.tags.filter(tag => tag !== tagToRemove) }
          : report
      )
    );
    if (activeTagFilter === tagToRemove) {
      setActiveTagFilter(null);
    }
  };

  const getProcessedCsvData = (data: { headers: string[]; rows: string[][] }) => {
    let processedRows = [...data.rows];

    // Apply filtering
    if (csvFilter) {
      processedRows = processedRows.filter(row =>
        row.some(cell => 
          cell.toLowerCase().includes(csvFilter.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (csvSortField !== null && csvSortDirection) {
      processedRows.sort((a, b) => {
        const valueA = a[csvSortField];
        const valueB = b[csvSortField];
        
        // Try numeric comparison first
        const numA = Number(valueA);
        const numB = Number(valueB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return csvSortDirection === 'asc' ? numA - numB : numB - numA;
        }
        
        // Fall back to string comparison
        return csvSortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      });
    }

    return { headers: data.headers, rows: processedRows };
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div className="space-x-2">
          {groupByDate && (
            <>
              <button
                onClick={expandAll}
                className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 text-xs font-medium bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                Collapse All
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setGroupByDate(!groupByDate)}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded hover:bg-gray-50"
        >
          {groupByDate ? 'Disable Grouping' : 'Enable Grouping'}
        </button>
      </div>

      <div className="mb-4 space-y-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
          </div>

          <select
            value={activeTagFilter || ''}
            onChange={(e) => setActiveTagFilter(e.target.value || null)}
            className="text-sm pl-3 pr-8 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.3rem_center]"
          >
            <option value="">All Tags</option>
            {getAllTags(reports).map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <select
            value={activeStatusFilter === null ? '' : activeStatusFilter.toString()}
            onChange={(e) => setActiveStatusFilter(e.target.value === '' ? null : e.target.value === 'true')}
            className="text-sm pl-3 pr-8 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.3rem_center]"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {groupByDate ? (
        <div className="space-y-6">
          {groupReportsByDate(reports, searchTerm, activeTagFilter, activeStatusFilter).map(([date, groupReports]) => (
            <div key={date} className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => toggleGroup(date)}
              >
                <div className="flex items-center gap-2">
                  {expandedGroups.has(date) ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="font-medium">{new Date(date).toLocaleDateString()}</span>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                  {groupReports.length} reports
                </span>
              </div>
              
              {expandedGroups.has(date) && (
                <div className="border-t border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                      <tr>
                        <th className="px-4 py-4">Name</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">Tags</th>
                        <th className="px-4 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {groupReports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 font-medium text-gray-900">
                            {report.name}
                          </td>
                          <td className="px-4 py-2.5">
                            <Switch
                              checked={report.isActive}
                              onChange={() => handleToggleActive(report.id, report.isActive)}
                              className={`${
                                report.isActive ? 'bg-blue-600' : 'bg-gray-200'
                              } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                            >
                              <span className="sr-only">
                                {report.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span
                                className={`${
                                  report.isActive ? 'translate-x-5' : 'translate-x-1'
                                } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                              />
                            </Switch>
                            <span className="ml-2 text-xs text-gray-600">
                              {report.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 flex-wrap items-center">
                              {report.tags.map((tag) => (
                                <span 
                                  key={tag} 
                                  className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded flex items-center gap-1"
                                >
                                  {tag}
                                  <button 
                                    onClick={() => handleRemoveTag(report.id, tag)}
                                    className="hover:text-blue-900 ml-1"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {tagReportId === report.id ? (
                                <input
                                  type="text"
                                  placeholder="New tag..."
                                  value={newTag}
                                  onChange={(e) => setNewTag(e.target.value)}
                                  onKeyDown={(e) => handleAddTag(report.id, e)}
                                  onBlur={() => setTagReportId(null)}
                                  className="ml-1 px-1.5 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => setTagReportId(report.id)}
                                  className="ml-1 px-1.5 py-0.5 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => handleViewReport(report)}
                              className={`text-xs font-medium ${
                                report.isActive 
                                  ? 'text-blue-600 hover:text-blue-700' 
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              disabled={!report.isActive}
                            >
                              View CSV
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Rows per page:</span>
                <select
                  value={gridPageSize === 'All' ? 'All' : gridPageSize.toString()}
                  onChange={(e) => {
                    const newSize = e.target.value === 'All' ? 'All' : Number(e.target.value);
                    setGridPageSize(newSize as PageSize);
                    setGridCurrentPage(1);
                  }}
                  className="text-sm border border-gray-200 rounded px-3 pr-8 py-1.5 min-w-[70px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.3rem_center]"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size} className="py-1">
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-500">
                {gridPageSize !== 'All' && (
                  <>
                    Showing {Math.min((gridCurrentPage - 1) * (typeof gridPageSize === 'number' ? gridPageSize : 0) + 1, reports.length)} 
                    {' '}-{' '}
                    {Math.min(gridCurrentPage * (typeof gridPageSize === 'number' ? gridPageSize : 0), reports.length)} 
                    {' '}of{' '}
                  </>
                )}
                {reports.length} reports
              </div>
            </div>

            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                <tr>
                  <th 
                    className="px-4 py-4 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortState.field === 'name' && (
                        sortState.direction === 'asc' ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : sortState.direction === 'desc' ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : null
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-4 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortState.field === 'status' && (
                        sortState.direction === 'asc' ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : sortState.direction === 'desc' ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : null
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-4">Tags</th>
                  <th 
                    className="px-4 py-4 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortState.field === 'date' && (
                        sortState.direction === 'asc' ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : sortState.direction === 'desc' ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : null
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getPaginatedReports(processedReports).map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {report.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <Switch
                        checked={report.isActive}
                        onChange={() => handleToggleActive(report.id, report.isActive)}
                        className={`${
                          report.isActive ? 'bg-blue-600' : 'bg-gray-200'
                        } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      >
                        <span className="sr-only">
                          {report.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span
                          className={`${
                            report.isActive ? 'translate-x-5' : 'translate-x-1'
                          } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className="ml-2 text-xs text-gray-600">
                        {report.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap items-center">
                        {report.tags.map((tag) => (
                          <span 
                            key={tag} 
                            className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded flex items-center gap-1"
                          >
                            {tag}
                            <button 
                              onClick={() => handleRemoveTag(report.id, tag)}
                              className="hover:text-blue-900 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {tagReportId === report.id ? (
                          <input
                            type="text"
                            placeholder="New tag..."
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => handleAddTag(report.id, e)}
                            onBlur={() => setTagReportId(null)}
                            className="ml-1 px-1.5 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => setTagReportId(report.id)}
                            className="ml-1 px-1.5 py-0.5 text-xs text-blue-600 hover:text-blue-700"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(report.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleViewReport(report)}
                        className={`text-xs font-medium ${
                          report.isActive 
                            ? 'text-blue-600 hover:text-blue-700' 
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!report.isActive}
                      >
                        View CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {gridPageSize !== 'All' && reports.length > (typeof gridPageSize === 'number' ? gridPageSize : 0) && (
              <div className="px-4 py-3 border-t border-gray-200 flex justify-center gap-1">
                <button
                  onClick={() => setGridCurrentPage(1)}
                  disabled={gridCurrentPage === 1}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                >
                  First
                </button>
                <button
                  onClick={() => setGridCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={gridCurrentPage === 1}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-2 py-1 text-sm">
                  Page {gridCurrentPage} of {Math.ceil(reports.length / (typeof gridPageSize === 'number' ? gridPageSize : 1))}
                </span>
                <button
                  onClick={() => setGridCurrentPage(prev => prev + 1)}
                  disabled={gridCurrentPage === Math.ceil(reports.length / (typeof gridPageSize === 'number' ? gridPageSize : 1))}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setGridCurrentPage(Math.ceil(reports.length / (typeof gridPageSize === 'number' ? gridPageSize : 1)))}
                  disabled={gridCurrentPage === Math.ceil(reports.length / (typeof gridPageSize === 'number' ? gridPageSize : 1))}
                  className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Last
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedReport && csvData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-[90vw] w-full max-h-[90vh] flex flex-col my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="text-base font-semibold text-gray-900">
                {reports.find(r => r.id === selectedReport)?.name || 'Report Data'}
              </h3>
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setCsvData(null);
                  setCsvSortField(null);
                  setCsvSortDirection(null);
                  setCsvFilter('');
                  setCurrentPage(1);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center bg-white">
                  <div className="relative w-64">
                    <input
                      type="text"
                      placeholder="Filter data..."
                      value={csvFilter}
                      onChange={(e) => setCsvFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rows per page:</span>
                    <select
                      value={pageSize === 'All' ? 'All' : pageSize.toString()}
                      onChange={(e) => {
                        const newSize = e.target.value === 'All' ? 'All' : Number(e.target.value);
                        setPageSize(newSize as PageSize);
                        setCurrentPage(1);
                      }}
                      className="text-sm border border-gray-200 rounded px-3 pr-8 py-1.5 min-w-[70px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.3rem_center]"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size} className="py-1">
                          {size}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-gray-500">
                      {pageSize !== 'All' && (
                        <>
                          Showing {Math.min((currentPage - 1) * (typeof pageSize === 'number' ? pageSize : 0) + 1, csvData.rows.length)} 
                          {' '}-{' '}
                          {Math.min(currentPage * (typeof pageSize === 'number' ? pageSize : 0), csvData.rows.length)} 
                          {' '}of{' '}
                        </>
                      )}
                      {csvData.rows.length} rows
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                      <tr>
                        {csvData.headers.map((header, index) => (
                          <th 
                            key={index} 
                            className="px-4 py-4 font-medium cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (csvSortField === index) {
                                setCsvSortDirection(current => 
                                  current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc'
                                );
                                if (csvSortDirection === 'desc') {
                                  setCsvSortField(null);
                                }
                              } else {
                                setCsvSortField(index);
                                setCsvSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {header}
                              {csvSortField === index && (
                                csvSortDirection === 'asc' ? (
                                  <ChevronUpIcon className="h-4 w-4" />
                                ) : csvSortDirection === 'desc' ? (
                                  <ChevronDownIcon className="h-4 w-4" />
                                ) : null
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {getPaginatedData(getProcessedCsvData(csvData)).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-4">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pageSize !== 'All' && csvData.rows.length > (typeof pageSize === 'number' ? pageSize : 0) && (
                  <div className="mt-4 flex justify-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-2 py-1 text-sm">
                      Page {currentPage} of {Math.ceil(csvData.rows.length / (typeof pageSize === 'number' ? pageSize : 1))}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage === Math.ceil(csvData.rows.length / (typeof pageSize === 'number' ? pageSize : 1))}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.ceil(csvData.rows.length / (typeof pageSize === 'number' ? pageSize : 1)))}
                      disabled={currentPage === Math.ceil(csvData.rows.length / (typeof pageSize === 'number' ? pageSize : 1))}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end bg-white">
              <button
                onClick={() => {
                  const blob = new Blob([
                    [csvData.headers, ...csvData.rows]
                      .map(row => row.join(','))
                      .join('\n')
                  ], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `report-${selectedReport}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
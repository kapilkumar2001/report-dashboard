'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Report } from '@/app/lib/data/data';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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

const groupReportsByDate = (reports: Report[]) => {
  const grouped = reports.reduce((acc, report) => {
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

export default function ReportGrid({ reports: initialReports, defaultFolder }: ReportGridProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [groupByDate, setGroupByDate] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get('folder') || defaultFolder;

  useEffect(() => {
    setReports(initialReports);
    setIsLoading(false);
  }, [initialReports]);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/reports?folder=${currentFolder}`);
        if (!response.ok) {
          setReports(initialReports);
          return;
        }
        const data = await response.json();
        setReports(data.reports);
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
      const response = await fetch(`/api/reports/${reportId}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response) {
        setReports(prevReports =>
          prevReports.map(report =>
            report.id === reportId
              ? { ...report, isActive: !report.isActive }
              : report
          )
        );
      }
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
      const response = await fetch(`/api/reports/${report.id}/csv`);
      if (!response.ok) throw new Error('Failed to fetch CSV data');
      const data = await response.text();
      setCsvData(parseCSV(data));
      setSelectedReport(report.id);
    } catch (error) {
      console.error('Error fetching CSV:', error);
      alert('Failed to load report data');
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

  const groupedReports = groupByDate ? groupReportsByDate(reports) : null;

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

      {groupByDate ? (
        <div className="space-y-3">
          {groupedReports?.map(([date, dateReports]) => {
            const isExpanded = expandedGroups.has(date);
            return (
              <div key={date} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <button
                  onClick={() => toggleGroup(date)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-700 flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <ChevronRightIcon className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    <span className="text-sm">
                      {new Date(date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {dateReports.length} report{dateReports.length !== 1 ? 's' : ''}
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="overflow-x-auto">
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
                          {dateReports.map((report) => (
                            <tr key={report.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 font-medium text-gray-900">
                                {report.name}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => handleToggleActive(report.id, report.isActive)}
                                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                                    report.isActive 
                                      ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {report.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex gap-1 flex-wrap">
                                  {report.tags.map((tag) => (
                                    <span 
                                      key={tag} 
                                      className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                <tr>
                  <th className="px-4 py-4">Name</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Tags</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {report.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleToggleActive(report.id, report.isActive)}
                        className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                          report.isActive 
                            ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {report.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {report.tags.map((tag) => (
                          <span 
                            key={tag} 
                            className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                          >
                            {tag}
                          </span>
                        ))}
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
          </div>
        </div>
      )}

      {selectedReport && csvData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-[90vw] w-full max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-900">
                {reports.find(r => r.id === selectedReport)?.name || 'Report Data'}
              </h3>
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setCsvData(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                Close
              </button>
            </div>
            
            <div className="p-6 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                  <tr>
                    {csvData.headers.map((header, index) => (
                      <th key={index} className="px-4 py-4 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {csvData.rows.map((row, rowIndex) => (
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

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
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
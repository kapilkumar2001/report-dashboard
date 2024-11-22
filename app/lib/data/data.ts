'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface Report {
 id: string;
  name: string;
  isActive: boolean;
  data: any[]; // CSV data
  tags: string[];
  date: string;
}

interface Folder {
    id: string;
    name: string;
    reports: string[]; // Array of report IDs
}

export async function getReportFolders(): Promise<Folder[]> {
    const filePath = path?.join(process.cwd(), 'app/lib/data', 'structure.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents).folders;
}

export async function getReportsByFolder(folderId: string): Promise<Report[]> {
    try {
        // First get the folder structure
        const structure = JSON.parse(
            await fs.readFile(path?.join(process.cwd(), 'app/lib/data', 'structure.json'), 'utf8')
        );
        
        const folder = structure.folders.find((f: Folder) => f.id === folderId);
        if (!folder) return [];

        // Load each report's CSV data
        const reports = await Promise.all(
            folder.reports.map(async (report: any) => {
                const csvPath = path?.join(process.cwd(), 'app/lib/data', 'reports', `${report.id}.csv`);
                const csvContent = await fs.readFile(csvPath, 'utf8');
                const data = parse(csvContent, { columns: true });
                
                return {
                    id: report.id,
                    name: `Report ${report.name}`, // You might want to store names in structure.json
                    isActive: report.isActive,
                    tags: report.tags,
                    date: report.date,
                    data
                };
            })
        );

        return reports;
    } catch (error) {
        console.error('Error fetching reports:', error);
        return [];
    }
}
import { lusitana } from '@/app/ui/fonts';
import { Suspense } from 'react';
import TabNavigation from '@/app/ui/dashboard/tab-navigation';
import ReportGrid from '@/app/ui/dashboard/report-grid';
import { getReportFolders, getReportsByFolder } from '@/app/lib/data/data';
 
export default async function Page() {
    // Fetch folder structure and initial reports
    const folders = await getReportFolders();
    const defaultFolder = folders[0]?.id;
    const initialReports = defaultFolder ? await getReportsByFolder(defaultFolder) : [];

    return (
        <main className="p-6">
            <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
                Report Dashboard
            </h1>
            
            <Suspense fallback={<div>Loading reports...</div>}>
                <TabNavigation folders={folders} />
                <ReportGrid 
                    reports={initialReports}
                    defaultFolder={defaultFolder}
                />
            </Suspense>
        </main>
    );
}
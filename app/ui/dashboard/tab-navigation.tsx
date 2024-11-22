'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';

interface Folder {
  id: string;
  name: string;
}

export default function TabNavigation({ folders }: { folders: Folder[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get('folder') || folders[0]?.id;

  const handleTabChange = (folderId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('folder', folderId);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Folders">
        {folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => handleTabChange(folder.id)}
            className={clsx(
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
              {
                'border-blue-500 text-blue-600': currentFolder === folder.id,
                'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700':
                  currentFolder !== folder.id,
              }
            )}
          >
            {folder.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
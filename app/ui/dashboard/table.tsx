interface TableProps {
    children: React.ReactNode;
  }
  
  export function Table({ children }: TableProps) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          {children}
        </table>
      </div>
    );
  }
  
  export function TableHeader({ children }: TableProps) {
    return <thead className="bg-gray-50">{children}</thead>;
  }
  
  export function TableBody({ children }: TableProps) {
    return <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>;
  }
  
  export function TableRow({ children }: TableProps) {
    return <tr>{children}</tr>;
  }
  
  export function TableHead({ children }: TableProps) {
    return (
      <th
        scope="col"
        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900"
      >
        {children}
      </th>
    );
  }
  
  export function TableCell({ children }: TableProps) {
    return (
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {children}
      </td>
    );
  }
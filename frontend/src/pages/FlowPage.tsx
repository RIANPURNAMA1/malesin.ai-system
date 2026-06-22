import { Workflow } from 'lucide-react';

export default function FlowPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Flow</h2>
        <p className="text-gray-600 text-sm">Design and manage automation workflows</p>
      </div>
    </div>
  );
}

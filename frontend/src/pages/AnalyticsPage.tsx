import { useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';

const tabs = ['Session', 'AI Agent', 'Human Agent', 'Old Analytics'];

const dateLabels = ['Jun 11', 'Jun 12', 'Jun 13', 'Jun 14', 'Jun 15', 'Jun 16', 'Jun 17', 'Jun 18'];

function ChartSkeleton({ title, total, unit }: { title: string; total: number; unit: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-sm text-gray-500">{total} {unit}</span>
      </div>
      <div className="flex items-end justify-between gap-1 h-28 mb-3">
        {dateLabels.map(d => (
          <div key={d} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-gray-100 rounded-t" style={{ height: '0%' }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        {dateLabels.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-center py-6 text-gray-400">
          <div className="text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium text-gray-500">No Data Available</p>
            <p className="text-xs mt-0.5">There are no charts or data for selected date.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ title, total, unit }: { title: string; total: number; unit: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-sm text-gray-500">{total} {unit}</span>
      </div>
      <div className="flex items-center justify-center py-6 text-gray-400">
        <div className="text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No Data Available</p>
          <p className="text-xs mt-0.5">There are no charts or data for selected date.</p>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-5 text-center">
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('Session');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 lg:px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Analytics</h1>
        </div>

        <div className="flex border-b border-gray-200 gap-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-3 text-sm font-medium transition-all border-b-2"
              style={{
                color: activeTab === tab ? '#18a6fc' : '#6b7280',
                borderBottomColor: activeTab === tab ? '#18a6fc' : 'transparent',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-4">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 cursor-pointer">
            <span>agent</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 cursor-pointer">
            <span>All Inbox</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc' }}>
            Jun 11, 2026 ~ Jun 18, 2026
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <ChartSkeleton title="First Customer Session" total={0} unit="Total Sessions" />
          <ChartSkeleton title="Returning Customer Session" total={0} unit="Total Sessions" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <EmptyCard title="Session Source" total={0} unit="Total Sessions" />
          <EmptyCard title="Session Resolution Rate" total={0} unit="Total Sessions" />
          <EmptyCard title="Session Label" total={0} unit="Total label assigned" />
        </div>

        <div className="mb-6">
          <ChartSkeleton title="Historical MAU" total={0} unit="MAU" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <EmptyCard title="Session Status" total={0} unit="Total Session" />
          <div className="glass-card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Session Performance</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <PerformanceCard label="Average Session Duration" value="00h 00m 00s" />
              <PerformanceCard label="Average AI Session Duration" value="00h 00m 00s" />
              <PerformanceCard label="Average Agent Session Duration" value="00h 00m 00s" />
              <PerformanceCard label="SLA In" value="0%" />
              <PerformanceCard label="SLA Out" value="0%" />
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Session List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Name', 'Platform', 'Inbox Name', 'Phone', 'Session Number', 'Priority', 'Agent Assigned', 'Create At', 'Handed to Human Agent', 'Resolve At', 'AI session duration', 'Agent session duration', 'SLA Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-gray-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium text-gray-500">No Data Available</p>
                    <p className="text-xs mt-0.5">There are no charts or data for selected date.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 shadow-lg" style={{ background: '#18a6fc' }}>
            <MessageCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary">OmniDesk</h1>
          <p className="text-gray-500 text-sm mt-2">Omnichannel Customer Service Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Outlet />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} OmniDesk. All rights reserved.
        </p>
      </div>
    </div>
  );
}

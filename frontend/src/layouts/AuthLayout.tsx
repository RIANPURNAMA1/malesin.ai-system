import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img src="/logoM.png" alt="malesin.AI" className="h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-primary">malesin.AI</h1>
          <p className="text-gray-500 text-sm mt-2">Omnichannel Customer Service Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Outlet />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} malesin.AI. All rights reserved.
        </p>
      </div>
    </div>
  );
}

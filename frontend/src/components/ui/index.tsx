import React from 'react';
export { Button } from './Button';

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}
export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
      <input
        className={`w-full rounded-xl border ${error ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:bg-gray-50 ${icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
);

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string;
}
export const Textarea: React.FC<TextareaProps> = ({ label, error, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <textarea
      className={`w-full rounded-xl border ${error ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
);

// Badge
interface BadgeProps { label: string; color?: string; variant?: 'solid' | 'outline'; }
export const Badge: React.FC<BadgeProps> = ({ label, color = '#18a6fc', variant = 'solid' }) => {
  const style = variant === 'solid'
    ? { backgroundColor: color + '22', color, borderColor: color + '44' }
    : { color, borderColor: color };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border" style={style}>
      {label}
    </span>
  );
};

// Avatar
interface AvatarProps { name: string; src?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; }
const sizeMap = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className = '' }) => {
  const colorClass = colors[name.charCodeAt(0) % colors.length];
  if (src) return <img src={src} alt={name} className={`${sizeMap[size]} rounded-full object-cover ${className}`} />;
  return (
    <div className={`${sizeMap[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; options: { value: string; label: string }[];
}
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select
      className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 ${className}`}
      {...props}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// Spinner
export const Spinner: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={`animate-spin text-blue-500 ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

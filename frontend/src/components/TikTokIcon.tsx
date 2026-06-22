export default function TikTokIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#fff"/>
      <path d="M16.5 6.5A4 4 0 0114 4h-2v9.5a2.5 2.5 0 11-2.5-2.5c.28 0 .54.05.8.13V8.9a4.5 4.5 0 00-.8-.07A4.5 4.5 0 0010 17.5a4.5 4.5 0 004.5-4.5v-5A4 4 0 0016.5 6.5z" fill="#000"/>
    </svg>
  );
}

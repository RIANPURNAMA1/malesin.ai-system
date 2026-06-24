export default function TikTokIcon({ size }: { size?: string }) {
  return (
    <img
      src="https://img.magnific.com/premium-vector/tiktok-logo-circle-black-social-media-logo_197792-4612.jpg?semt=ais_hybrid&w=740&q=80"
      alt=""
      className="object-contain"
      style={{ width: size || '24px', height: size || '24px', borderRadius: '6px' }}
    />
  );
}

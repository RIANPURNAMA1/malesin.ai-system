import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, Bot, Radio, Workflow, BarChart3, Settings,
  Users, ShoppingCart, Megaphone, Menu, X, ChevronRight,
  Star, CheckCircle, MessageSquare, Instagram, Globe,
  ArrowRight, Facebook, Mail, Clock, Zap, Shield,
  BarChart, Layers, Smartphone, Linkedin, Youtube, Truck, CreditCard
} from 'lucide-react';

const stats = [
  { value: '3.000+', label: 'Bisnis & Brand' },
  { value: '50K+', label: 'Percakapan/Hari' },
  { value: '98%', label: 'Kepuasan Customer' },
  { value: '24/7', label: 'Support AI' },
];

const features = [
  {
    icon: Bot,
    title: 'AI Chat Agent',
    desc: 'AI customer service 24/7 yang memahami konteks percakapan, menangani WhatsApp, Instagram, dan semua channel sekaligus.',
    color: '#18a6fc',
  },
  {
    icon: Layers,
    title: 'Omnichannel CRM',
    desc: 'Kelola semua percakapan customer dari WhatsApp, Instagram, email, dan live chat dalam satu dashboard terpadu.',
    color: '#8B5CF6',
  },
  {
    icon: ShoppingCart,
    title: 'Order Management',
    desc: 'Otomatisasi pemesanan, cek ongkir, pembayaran, dan konfirmasi langsung dari chat tanpa proses manual.',
    color: '#22C55E',
  },
  {
    icon: Megaphone,
    title: 'Marketing Automation',
    desc: 'Broadcast pesan, campaign marketing, dan follow-up otomatis untuk maksimalkan konversi penjualan.',
    color: '#F59E0B',
  },
];

const builderFeatures = [
  { icon: Globe, title: 'Integrasi API', desc: 'Hubungkan AI dengan berbagai API untuk cek ongkir, booking jadwal, dan kebutuhan bisnis lainnya.' },
  { icon: Zap, title: 'Builder AI Sederhana', desc: 'Buat AI Agent yang powerful tanpa coding, cukup 5 menit, semudah briefing admin CS.' },
  { icon: Shield, title: 'AI Knowledge Base', desc: 'Cukup salin SOP dan info bisnismu, AI langsung bisa jawab dengan tepat dan akurat.' },
  { icon: MessageSquare, title: 'AI Agent & Alur Chat', desc: 'Atur alur chat dengan mudah, arahkan customer ke AI atau human agent yang tepat.' },
  { icon: Bot, title: 'AI Agent Spesialis', desc: 'Buat AI khusus untuk sales, support, billing, dan lainnya, masing-masing dengan data sendiri.' },
  { icon: Workflow, title: 'Designer Alur Visual', desc: 'Atur alur chat dengan drag & drop, tanpa coding. Semudah menyusun diagram.' },
  { icon: Clock, title: 'Jam Kerja AI', desc: 'Atur jam kerja AI agar chat dijawab tim saat online dan otomatis dialihkan ke AI di luar jam kerja.' },
  { icon: BarChart, title: 'Dashboard Real-time', desc: 'Monitor performa campaign, konversi, dan aktivitas customer secara real-time dalam satu dashboard.' },
];

const testimonials = [
  {
    quote: 'Response rate kami meningkat 90% sejak menggunakan malesin.ai. Customer tidak perlu menunggu lama untuk mendapatkan jawaban.',
    name: 'Rianti Yahya',
    role: 'CEO & Founder - Vio Optical Clinic',
    initials: 'RY',
  },
  {
    quote: 'Platform yang sangat membantu operasional customer service kami. Otomatisasi order dari chat benar-benar menghemat waktu tim.',
    name: 'Tantan Supriantna',
    role: 'Head Customer Relation - Rumah Zakat',
    initials: 'TS',
  },
  {
    quote: 'malesin.ai memberikan solusi AI customer service yang terjangkau tanpa mengorbankan kualitas. Sangat direkomendasikan untuk UMKM.',
    name: 'Hargyo T. N. Ignatis, Ph.D',
    role: 'Direktur - Multimedia Nusantara Polytechnic',
    initials: 'HT',
  },
  {
    quote: 'Integrasinya mudah, AI-nya cerdas, dan tim support sangat responsif. Investasi terbaik untuk digitalisasi bisnis kami.',
    name: 'Gery Wilianto',
    role: 'CEO & Founder - DokterHub',
    initials: 'GW',
  },
];

const footerLinks = [
  { category: 'Product', links: ['AI Chat Agent', 'Omnichannel CRM', 'Marketing Automation', 'Order Management'] },
  { category: 'Legal', links: [
    { label: 'Terms & Conditions', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Kebijakan Pengembalian', to: '#' },
  ]},
  { category: 'Company', links: ['Blog', 'Kontak', 'Karir'] },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/logoM.png" alt="malesin.ai" className="w-8 h-8 object-contain" />
              <span className="font-bold text-lg text-gray-900">malesin.ai</span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              {['Fitur', 'Blog', 'Kontak'].map((item) => (
                <a key={item} href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  {item}
                </a>
              ))}
              <div className="flex items-center gap-1 text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900 transition-colors">
                <Globe className="w-4 h-4" />
                Indonesia
              </div>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => navigate('/login')} className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 transition-colors">
                Masuk
              </button>
              <button className="text-sm font-medium text-white px-5 py-2 rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: '#18a6fc' }}>
                Coba Demo Sekarang
              </button>
            </div>

            <button className="md:hidden p-2.5 -mr-2 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-lg transition-colors" onClick={() => setMobileMenu(true)} aria-label="Buka menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

      </header>

      {/* Mobile menu with smooth transition - outside header for proper z-index */}
      <div className={`fixed inset-0 z-[60] md:hidden transition-all duration-300 ease-in-out ${mobileMenu ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${mobileMenu ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileMenu(false)} />
        <div className={`absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl transition-transform duration-300 ease-in-out ${mobileMenu ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
            <span className="font-bold text-lg text-gray-900">Menu</span>
            <button onClick={() => setMobileMenu(false)} className="p-2.5 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-lg transition-colors" aria-label="Tutup menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 space-y-1">
            {['Fitur', 'Blog', 'Kontak'].map((item) => (
              <a key={item} href="#" className="block text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 py-3 px-3 rounded-xl transition-colors">{item}</a>
            ))}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 py-3 px-3">
              <Globe className="w-4 h-4" />
              Indonesia
            </div>
            <hr className="border-gray-100 my-3" />
            <button onClick={() => navigate('/login')} className="w-full text-sm font-medium text-gray-700 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Masuk
            </button>
            <button className="w-full text-sm font-medium text-white py-3 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98]" style={{ background: '#18a6fc' }}>
              Coba Demo Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-28 pb-16 sm:pt-32 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc' }}>
            <Zap className="w-4 h-4" />
            Platform AI Agent untuk Bisnis Indonesia
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight max-w-4xl mx-auto">
            Satu AI untuk Mengelola{' '}
            <span style={{ color: '#18a6fc' }}>Chat, CRM,</span>
            <br className="hidden sm:block" />
            dan Otomatisasi Bisnis
          </h1>
          <p className="mt-6 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed px-2">
            malesin.ai adalah platform AI agent terdepan di Indonesia yang menggabungkan AI agent cerdas,
            omnichannel CRM, dan sistem order otomatis dalam satu platform.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="text-white font-medium px-8 py-3.5 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: '#18a6fc' }}>
              Mulai Gratis
            </button>
            <button className="flex items-center gap-2 text-gray-700 font-medium px-8 py-3.5 rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition-all duration-200">
              Coba Demo Sekarang
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            Dipercaya oleh 3.000+ bisnis dan brand terkemuka di Indonesia
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm"
            style={{ background: 'linear-gradient(135deg, rgba(24,166,252,0.03) 0%, rgba(139,92,246,0.03) 100%)' }}>
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TikTok Integration */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc' }}>
                3K+ <span className="text-gray-400 font-normal">TikTok Integration</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 leading-tight">
                Kelola TikTok & Instagram dari Satu Dashboard
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                Lebih dari sekadar membalas chat otomatis di semua platform. malesin.AI terintegrasi dengan TikTok
                dan Instagram untuk menjadwalkan dan memposting konten secara otomatis — atur strategi media sosial
                Anda tanpa bolak-balik aplikasi. Didukung oleh TikTok Developer Platform untuk koneksi yang aman dan andal.
              </p>
              <div className="mt-6 space-y-3">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 text-white font-medium px-6 py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: '#18a6fc' }}>
                  Continue with TikTok
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-success" />
                  Connection Status
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-danger" />
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <div className="w-3 h-3 rounded-full bg-success" />
                  </div>
                  <div className="flex-1 text-center text-xs text-gray-400 font-medium">Dashboard Preview</div>
                </div>
                <div className="p-6 space-y-4" style={{ minHeight: 280 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(24,166,252,0.1)' }}>
                      <Instagram className="w-5 h-5" style={{ color: '#E4405F' }} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-32 bg-gray-200 rounded" />
                      <div className="h-2 w-24 bg-gray-100 rounded mt-1.5" />
                    </div>
                    <div className="text-xs font-semibold text-success">Active</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(24,166,252,0.1)' }}>
                      <div className="w-5 h-5 flex items-center justify-center font-bold text-sm" style={{ color: '#000' }}>T</div>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-36 bg-gray-200 rounded" />
                      <div className="h-2 w-28 bg-gray-100 rounded mt-1.5" />
                    </div>
                    <div className="text-xs font-semibold text-success">Active</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,211,102,0.1)' }}>
                      <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-28 bg-gray-200 rounded" />
                      <div className="h-2 w-20 bg-gray-100 rounded mt-1.5" />
                    </div>
                    <div className="text-xs font-semibold text-success">Active</div>
                  </div>
                </div>
                <div className="px-6 pb-4 flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  All platforms connected
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* One Platform Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            Satu Platform untuk Mengelola Semua Percakapan Customer
          </h2>
          <p className="mt-4 text-gray-500 max-w-3xl mx-auto leading-relaxed">
            malesin.ai dirancang untuk bisnis yang ingin mengotomatisasi customer service & meningkatkan penjualan
            tanpa perlu menambah tim. AI agent cerdas, omnichannel CRM, sistem order otomatis, & broadcast marketing
            dalam satu platform.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="text-left p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chat Demo / Order Automation */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                Jualan Otomatis, Langsung dari Chat
              </h2>
              <div className="mt-8 space-y-4">
                {[
                  { icon: ShoppingCart, label: 'Otomatisasi Order' },
                  { icon: Truck, label: 'Ongkos kirim otomatis' },
                  { icon: CreditCard, label: 'Pembayaran terintegrasi' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(24,166,252,0.1)' }}>
                      <item.icon className="w-4 h-4" style={{ color: '#18a6fc' }} />
                    </div>
                    <span className="text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-gray-500 leading-relaxed">
                Biarkan AI membalas chat, mengelola leads, dan menindaklanjuti customer secara otomatis, 24/7.
                Timing cepat, closing lebih banyak.
              </p>
            </div>

            {/* Chat Preview */}
            <div className="rounded-2xl border border-gray-100 shadow-lg overflow-hidden bg-white">
              <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">CS</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Customer Service</div>
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    Online
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'rgba(24,166,252,0.1)', color: '#18a6fc' }}>
                  AI Agent aktif
                </div>
              </div>
              <div className="p-5 space-y-4" style={{ minHeight: 340 }}>
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm"
                    style={{ background: '#F0F0F0', color: '#333' }}>
                    Halo, saya mau order 1 black oversized t-shirt ukuran M. Ada?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed"
                    style={{ background: 'rgba(24,166,252,0.08)', color: '#333' }}>
                    Ya, size M black tersedia.<br />
                    Harga: Rp185.000<br />
                    Ongkir Bandung: Rp18.000<br />
                    Total: Rp203.000<br /><br />
                    Silakan selesaikan pembayaran di:{' '}
                    <span style={{ color: '#18a6fc' }}>malesin.ai/pay/10293</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm bg-gray-900 text-white">
                    Oke, saya bayar sekarang ya.
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm bg-gray-900 text-white">
                    Done ✓
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400 border-t border-gray-100">
                  <Bot className="w-3.5 h-3.5" style={{ color: '#18a6fc' }} />
                  AI Agent membalas secara otomatis
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Builder */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
              Buat AI Agent dalam 5 Menit
            </h2>
            <p className="mt-4 text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Kelola semua chat dengan AI yang mudah dibuat. Latih pakai data bisnismu dan hubungkan ke sistem lain tanpa ribet.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {builderFeatures.map((f) => (
              <div key={f.title} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(24,166,252,0.08)' }}>
                  <f.icon className="w-5 h-5" style={{ color: '#18a6fc' }} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
              Bukti Nyata dari Bisnis yang Menggunakan malesin.ai
            </h2>
            <p className="mt-4 text-gray-500 max-w-3xl mx-auto leading-relaxed">
              malesin.ai hadir untuk UMKM yang butuh AI customer service terjangkau hingga brand berkembang
              yang butuh platform omnichannel lengkap.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4" style={{ color: '#FACC15', fill: '#FACC15' }} />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: '#18a6fc' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#F8FAFC' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            Ubah Setiap Percakapan Jadi Penjualan
          </h2>
          <p className="mt-4 text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Lihat bagaimana AI membantu tim balas lebih cepat, follow-up otomatis, dan closing lebih banyak tanpa nambah tim.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="flex items-center gap-2 text-white font-medium px-8 py-3.5 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: '#18a6fc' }}>
              Coba Demo Sekarang
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="text-gray-700 font-medium px-8 py-3.5 rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition-all duration-200">
              Mulai Gratis
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logoM.png" alt="malesin.ai" className="w-8 h-8 object-contain" />
                <span className="font-bold text-lg text-white">malesin.ai</span>
              </div>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Platform AI agent Indonesia untuk mengotomatisasi chat, CRM, dan penjualan bisnis Anda.
              </p>
            </div>
            {footerLinks.map(({ category, links }) => (
              <div key={category}>
                <h4 className="font-semibold text-white text-sm mb-4">{category}</h4>
                <ul className="space-y-3">
                  {links.map((link: any) => (
                    <li key={typeof link === 'string' ? link : link.label}>
                      <a href={typeof link === 'string' ? '#' : link.to} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {typeof link === 'string' ? link : link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">&copy; 2024 malesin.ai. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {[Linkedin, Youtube, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

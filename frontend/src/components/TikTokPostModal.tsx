import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postService } from '../services/index';
import { ArrowLeft, X, Image, MapPin, ChevronRight, Globe, Calendar, Clock, Play, Volume2, Maximize, Music, AlertTriangle, Search, ChevronDown, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const locations = [
  'SEJUTA KENANGAN', 'Kampung kecil', 'Klinik Wong Tulus', 'Kandang Harimau',
  'S.E.M.P.A.K', "Se'Indonesia - Denai Medan (Delivery & Takeaway)",
  "Se'Indonesia - Taktakan (Delivery & Takeaway)", 'Thailand gang telu',
  'Markas Rahasia', 'TEMPAT NONGKRONG',
];

export default function TikTokPostModal({ onClose }: { onClose: () => void }) {
  const [caption, setCaption] = useState('ADS VIDEO VLOG VERSI 2');
  const [tags, setTags] = useState('');
  const [mentions, setMentions] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [date, setDate] = useState('2026-06-22');
  const [time, setTime] = useState('15:30');
  const [audience, setAudience] = useState('Semua orang');
  const [hdEnabled, setHdEnabled] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const mutation = useMutation({
    mutationFn: () => postService.create({
      platform: 'TIKTOK',
      caption,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      scheduledAt: date && time ? new Date(`${date}T${time}`).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post created!');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create post'),
  });

  const handleSubmit = () => {
    mutation.mutate();
  };

  const filteredLocations = locations.filter(l =>
    l.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="w-full max-w-6xl relative animate-slide-up bg-[#121212] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ height: '90vh', maxHeight: '900px' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <button type="button" onClick={onClose} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="text-sm font-semibold text-white">Posting</span>
          <button type="button" onClick={handleSubmit}
            disabled={mutation.isPending}
            className="text-sm font-semibold text-[#fe2c55] hover:text-[#fe2c55]/80 disabled:opacity-50 px-3 py-1"
          >
            {mutation.isPending ? 'Creating...' : 'Posting'}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[38%] bg-black flex items-center justify-center relative min-h-0">
            {mediaPreview ? (
              <div className="w-full h-full flex items-center justify-center relative">
                {mediaPreview.startsWith('data:video') ? (
                  <video src={mediaPreview} controls className="h-full w-auto object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="h-full w-auto object-contain" />
                )}
                <button type="button" onClick={() => { setMediaPreview(null); setMediaUrl(''); }}
                  className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-6">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-full rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                    dragOver ? 'border-[#fe2c55]/60 bg-[#fe2c55]/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <Image className="w-7 h-7 text-white/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">Upload video</p>
                    <p className="text-xs text-white/40 mt-0.5">Click or drag & drop</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/20">───</span>
                    <span className="text-[10px] text-white/30">OR</span>
                    <span className="text-[10px] text-white/20">───</span>
                  </div>
                  <input type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                    placeholder="Paste video URL..."
                    onClick={(e) => e.stopPropagation()}
                    className="w-48 text-center text-xs rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#fe2c55]/50 transition-all"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileInput} hidden />
                </div>
              </div>
            )}
          </div>

          <div className="w-[62%] flex flex-col overflow-y-auto bg-[#1a1a1a]">
            <div className="px-5 py-4 border-b border-white/10">
              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Detail</h4>
              <div className="space-y-3">
                <div className="relative">
                  <textarea value={caption} onChange={e => setCaption(e.target.value)}
                    placeholder="Deskripsi"
                    rows={3}
                    className="w-full text-sm text-white placeholder:text-white/30 bg-transparent resize-none focus:outline-none border-none"
                  />
                  <span className="absolute bottom-1 right-0 text-[10px] text-white/30">{caption.length}/4000</span>
                </div>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="Tagar"
                  className="w-full text-sm text-white placeholder:text-white/30 bg-transparent focus:outline-none border-none"
                />
                <input type="text" value={mentions} onChange={e => setMentions(e.target.value)}
                  placeholder="Sebut"
                  className="w-full text-sm text-white placeholder:text-white/30 bg-transparent focus:outline-none border-none"
                />
              </div>
            </div>

            <button type="button" className="flex items-center justify-between w-full px-5 py-3.5 text-sm hover:bg-white/5 transition-all border-b border-white/10">
              <div className="flex items-center gap-3">
                <Image className="w-4 h-4 text-white/50" />
                <span className="text-white">Sampul</span>
              </div>
              <span className="text-xs text-[#fe2c55] font-medium">Edit sampul</span>
            </button>

            <div className="border-b border-white/10">
              <button type="button" onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-sm hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-white/50" />
                  <span className="text-white">{selectedLocation || 'Lokasi'}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${showLocationDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showLocationDropdown && (
                <div className="px-5 pb-3">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input type="text" value={locationSearch} onChange={e => setLocationSearch(e.target.value)}
                      placeholder="Cari lokasi"
                      className="w-full text-xs rounded-lg bg-white/10 border border-white/10 pl-8 pr-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredLocations.map(loc => (
                      <button key={loc} type="button" onClick={() => { setSelectedLocation(loc); setShowLocationDropdown(false); }}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all ${selectedLocation === loc ? 'bg-[#fe2c55]/20 text-[#fe2c55]' : 'text-white/70 hover:bg-white/10'}`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-white/10">
              <button type="button" onClick={() => setShowSettings(!showSettings)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-sm hover:bg-white/5 transition-all"
              >
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Pengaturan</span>
                <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
              </button>
              {showSettings && (
                <div className="px-5 pb-4 space-y-4">
                  <div>
                    <label className="text-xs text-white/50 mb-2 block">Waktu posting</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        <Clock className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <input type="time" value={time} onChange={e => setTime(e.target.value)}
                          className="w-full text-xs text-white bg-transparent focus:outline-none border-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        <Calendar className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                          className="w-full text-xs text-white bg-transparent focus:outline-none border-none [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-white/50" />
                      <div>
                        <span className="text-sm text-white">Siapa yang dapat melihat postingan ini</span>
                        <p className="text-[10px] text-white/30">{audience}</p>
                      </div>
                    </div>
                    <select value={audience} onChange={e => setAudience(e.target.value)}
                      className="text-xs bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                    >
                      <option>Semua orang</option>
                      <option>Teman</option>
                      <option>Hanya saya</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-white/50" />
                      <div>
                        <span className="text-sm text-white">Unggahan berkualitas tinggi</span>
                        <p className="text-[10px] text-white/30">HD secara default saat kamu memosting dari Web Studio</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setHdEnabled(!hdEnabled)}
                      className={`w-9 h-5 rounded-full transition-all relative ${hdEnabled ? 'bg-[#fe2c55]' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${hdEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <button type="button" onClick={() => setShowMore(!showMore)}
                    className="flex items-center gap-1 text-xs text-[#fe2c55] hover:text-[#fe2c55]/80"
                  >
                    {showMore ? 'Tampilkan lebih sedikit' : 'Tampilkan lebih banyak'}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {mediaPreview && showMore && (
              <div className="px-5 py-4 border-b border-white/10 space-y-4">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Pemeriksaan</h4>
                <div className="flex items-start gap-3">
                  <Music className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/70">Pemeriksaan hak cipta musik</p>
                    <p className="text-[10px] text-white/30">Kami akan memeriksa apakah video Anda memiliki musik yang tidak sah yang dapat menyebabkannya dibisukan.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/70">Pemeriksaan konten ringan</p>
                    <p className="text-[10px] text-white/30">Kami akan memeriksa konten Anda untuk kelayakan feed Saran.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#121212] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition-all">
              <Play className="w-4 h-4 text-white" />
            </button>
            <span className="text-xs text-white/50 font-mono">00:00:00 / 00:00:54</span>
            <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition-all">
              <Volume2 className="w-4 h-4 text-white" />
            </button>
            <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition-all">
              <Maximize className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
              className="px-4 py-1.5 text-xs font-semibold text-[#fe2c55] border border-[#fe2c55] rounded-lg hover:bg-[#fe2c55]/10 transition-all"
            >
              Jadwal
            </button>
            <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#fe2c55] rounded-lg hover:bg-[#fe2c55]/90 transition-all"
            >
              Simpan draf
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white/50 border border-white/20 rounded-lg hover:bg-white/10 transition-all"
            >
              Buang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

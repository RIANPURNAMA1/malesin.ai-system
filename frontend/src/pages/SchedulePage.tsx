import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postService } from '../services/index';
import { Post } from '../types';
import { Calendar, Clock, Image, Instagram, X, Plus, Send, Edit2, Trash2, MoreHorizontal, Loader2, CheckCircle2, AlertCircle, ArrowLeft, MapPin, UserPlus, ChevronRight, Globe, Play } from 'lucide-react';
import TikTokIcon from '../components/TikTokIcon';
import TikTokPostModal from '../components/TikTokPostModal';
import toast from 'react-hot-toast';

const tabs = ['Instagram', 'TikTok'];

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '';
const mediaUrl = (url: string) => url.startsWith('/') ? `${API_BASE}${url}` : url;

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  SCHEDULED: 'bg-primary/10 text-primary',
  PUBLISHING: 'bg-yellow-100 text-yellow-600',
  PUBLISHED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-500',
};

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState('Instagram');
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['posts', activeTab],
    queryFn: () => postService.list({ platform: activeTab.toUpperCase(), limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: postService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }); toast.success('Post deleted'); },
  });

  const publishMutation = useMutation({
    mutationFn: postService.publishNow,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post published!');
    },
  });

  const posts = data?.posts || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 lg:px-8 pt-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Scheduled Posts</h1>
            <p className="text-sm text-gray-500 mt-1">Schedule and manage your Instagram & TikTok posts</p>
          </div>
          <button onClick={() => setShowModal(true)} className="gradient-btn px-5 py-2.5 text-sm">
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </div>

        <div className="flex border-b border-gray-200 gap-6 mt-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-2 pb-3 text-sm font-medium transition-all border-b-2"
              style={{
                color: activeTab === tab ? '#18a6fc' : '#6b7280',
                borderBottomColor: activeTab === tab ? '#18a6fc' : 'transparent',
              }}
            >
              {tab === 'Instagram' ? <Instagram className="w-4 h-4" /> : <TikTokIcon size="16" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Calendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-gray-500 font-medium">No scheduled posts</p>
            <p className="text-sm mt-1">Create your first {activeTab} post schedule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Media</th>
                  <th className="text-left py-3.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Caption</th>
                  <th className="text-left py-3.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Schedule</th>
                  <th className="text-left py-3.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.mediaUrls?.[0] ? (
                          post.mediaUrls[0].match(/\.(mp4|mov|avi)$/i) ? (
                            <div className="relative w-full h-full">
                              <video src={mediaUrl(post.mediaUrls[0])} className="w-full h-full object-cover" muted />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <img src={mediaUrl(post.mediaUrls[0])} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          <Image className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="text-gray-700 font-medium line-clamp-1 max-w-xs">{post.caption || 'No caption'}</p>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5 text-gray-500">
                        {post.scheduledAt ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(post.scheduledAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[post.status] || 'bg-gray-100 text-gray-500'}`}>
                        {post.status === 'PUBLISHING' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                        {post.status === 'PUBLISHED' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {post.status === 'FAILED' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                        {post.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {post.status === 'DRAFT' || post.status === 'SCHEDULED' ? (
                          <button
                            onClick={() => publishMutation.mutate(post.id)}
                            disabled={publishMutation.isPending}
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-all"
                            title="Publish now"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        ) : null}
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                            title="Open post"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(post.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        activeTab === 'TikTok' ? (
          <TikTokPostModal onClose={() => setShowModal(false)} />
        ) : (
          <CreateScheduleModal onClose={() => setShowModal(false)} />
        )
      ) : null}
    </div>
  );
}

function CreateScheduleModal({ onClose }: { onClose: () => void }) {
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [shareFacebook, setShareFacebook] = useState(false);
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
      platform: 'INSTAGRAM',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="w-full max-w-5xl relative animate-slide-up bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ height: '85vh', maxHeight: '800px' }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <span className="text-sm font-semibold text-gray-800">New post</span>
          <button type="submit" form="ig-post-form"
            disabled={mutation.isPending}
            className="text-sm font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-50 px-2 py-1"
          >
            {mutation.isPending ? 'Creating...' : date ? 'Schedule' : 'Save Draft'}
          </button>
        </div>

        <form id="ig-post-form" onSubmit={handleSubmit} className="flex flex-1 overflow-hidden">
          <div className="w-[55%] bg-black flex items-center justify-center relative min-h-0">
            {mediaPreview ? (
              <div className="w-full h-full flex items-center justify-center relative">
                {mediaPreview.startsWith('data:video') ? (
                  <video src={mediaPreview} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain" />
                )}
                <button type="button" onClick={() => { setMediaPreview(null); setMediaUrl(''); }}
                  className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-8">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-full rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                    dragOver ? 'border-white/60 bg-white/10' : 'border-white/30 hover:border-white/50 hover:bg-white/5'
                  }`}
                >
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <Image className="w-9 h-9 text-white/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-white">Upload media</p>
                    <p className="text-sm text-white/50 mt-0.5">Click or drag & drop</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/30">───</span>
                    <span className="text-xs text-white/40">OR</span>
                    <span className="text-xs text-white/30">───</span>
                  </div>
                  <input type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                    placeholder="Paste image URL..."
                    onClick={(e) => e.stopPropagation()}
                    className="w-56 text-center text-sm rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-all"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileInput} hidden />
                </div>
              </div>
            )}
          </div>

          <div className="w-[45%] flex flex-col overflow-y-auto">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                R
              </div>
              <span className="text-sm font-semibold text-gray-800">retack.id</span>
            </div>

            <div className="px-4 py-3 border-b border-gray-100">
              <textarea value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Tulis keterangan..."
                rows={3}
                className="w-full text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none border-none bg-transparent"
              />
            </div>

            <button type="button" className="flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-gray-50 transition-all border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Tambahkan lokasi</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>

            <button type="button" className="flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-gray-50 transition-all border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Tambahkan kolaborator</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>

            <div className="px-4 py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-sm text-gray-700">WhatsApp</span>
                </div>
                <button type="button" onClick={() => setShareWhatsapp(!shareWhatsapp)}
                  className={`w-9 h-5 rounded-full transition-all relative ${shareWhatsapp ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${shareWhatsapp ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-sm text-gray-700">Facebook</span>
                </div>
                <button type="button" onClick={() => setShareFacebook(!shareFacebook)}
                  className={`w-9 h-5 rounded-full transition-all relative ${shareFacebook ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${shareFacebook ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4.5 h-4.5 text-gray-600" />
                  <span className="text-sm text-gray-700">Publik</span>
                </div>
                <span className="text-[10px] text-gray-300">✓</span>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 leading-relaxed">
                Teks alternatif mendeskripsikan foto Anda untuk orang yang memiliki gangguan penglihatan. Teks alternatif akan dibuat secara otomatis untuk foto Anda atau Anda bisa memilih untuk menulisnya sendiri.
              </p>
              <input type="text" value={altText} onChange={e => setAltText(e.target.value)}
                placeholder="Tulis teks alternatif..."
                className="w-full text-sm text-gray-800 placeholder:text-gray-400 mt-3 focus:outline-none border-none bg-transparent"
              />
            </div>

            <div className="px-4 py-4 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Jadwalkan</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
              {date && (
                <div className="flex items-center gap-2 text-xs text-gray-400 ml-6">
                  <span>{new Date(`${date}T${time || '00:00'}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {time && <span>• {time}</span>}
                </div>
              )}
              <div className={`grid grid-cols-2 gap-2 mt-2 ml-6 transition-all ${date || time ? 'max-h-20' : 'max-h-0 overflow-hidden'}`}>
                <div>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-300 transition-all"
                  />
                </div>
                <div>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-300 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

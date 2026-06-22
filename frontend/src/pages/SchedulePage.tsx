import { useState } from 'react';
import { Calendar, Clock, Image, Instagram, X, Plus, Send, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import TikTokIcon from '../components/TikTokIcon';

const tabs = ['Instagram', 'TikTok'];

const scheduledPosts = [
  {
    id: '1',
    platform: 'instagram',
    media: null,
    caption: 'Check out our new product drop! 🎉',
    scheduleDate: '2026-06-20',
    scheduleTime: '10:00',
    status: 'scheduled' as const,
  },
  {
    id: '2',
    platform: 'tiktok',
    media: null,
    caption: 'Behind the scenes of our team! #behindthescenes',
    scheduleDate: '2026-06-22',
    scheduleTime: '14:30',
    status: 'draft' as const,
  },
  {
    id: '3',
    platform: 'instagram',
    media: null,
    caption: 'New collaboration announcement coming soon 🔥',
    scheduleDate: '2026-06-25',
    scheduleTime: '09:00',
    status: 'scheduled' as const,
  },
  {
    id: '4',
    platform: 'tiktok',
    media: null,
    caption: 'Tutorial: How to use our app #tutorial #tips',
    scheduleDate: '2026-06-28',
    scheduleTime: '16:00',
    status: 'draft' as const,
  },
];

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState('Instagram');
  const [showModal, setShowModal] = useState(false);

  const filtered = scheduledPosts.filter(p =>
    p.platform === (activeTab === 'Instagram' ? 'instagram' : 'tiktok')
  );

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
        {filtered.length === 0 ? (
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
                {filtered.map(post => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {post.media ? (
                          <img src={post.media} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="text-gray-700 font-medium line-clamp-1 max-w-xs">{post.caption}</p>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5 text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {post.scheduleDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.scheduleTime}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        post.status === 'scheduled' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-red-50 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                          <MoreHorizontal className="w-4 h-4" />
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

      {showModal && <CreateScheduleModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function CreateScheduleModal({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<'instagram' | 'tiktok'>('instagram');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState('2026-06-20');
  const [time, setTime] = useState('10:00');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="glass-modal w-full max-w-lg relative animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Create Scheduled Post</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
            <div className="flex gap-3">
              <button
                onClick={() => setPlatform('instagram')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  platform === 'instagram'
                    ? ''
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                style={platform === 'instagram' ? { borderColor: 'rgba(24, 166, 252, 0.5)', background: 'rgba(24, 166, 252, 0.05)', color: '#18a6fc' } : undefined}
              >
                <Instagram className="w-4 h-4" />
                Instagram
              </button>
              <button
                onClick={() => setPlatform('tiktok')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  platform === 'tiktok'
                    ? ''
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                style={platform === 'tiktok' ? { borderColor: 'rgba(24, 166, 252, 0.5)', background: 'rgba(24, 166, 252, 0.05)', color: '#18a6fc' } : undefined}
              >
                <TikTokIcon size="16" />
                TikTok
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Media</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <Image className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Drop your media here or <span className="text-primary font-medium">browse</span></p>
              <p className="text-xs text-gray-400 mt-1">Supports images and videos up to 100MB</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={3}
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button className="gradient-btn px-5 py-2 text-sm">
            <Send className="w-4 h-4" />
            Schedule Post
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postService } from '../services/index';
import { ArrowLeft, X, Image, MapPin, ChevronRight, Globe, Calendar, Clock, Play, Volume2, Maximize, Music, AlertTriangle, Search, ChevronDown, Eye, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function TikTokPostModal({ onClose }: { onClose: () => void }) {
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStep, setUploadStep] = useState<'select' | 'uploading' | 'done'>('select');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Only video files are supported (MP4, MOV)');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setMediaPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploadStep('select');
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

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Select a video first');

      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('caption', caption);

      const res = await api.post('/social-auth/tiktok/upload', formData);
      return res.data;
    },
    onMutate: () => setUploadStep('uploading'),
    onSuccess: (data) => {
      setUploadStep('done');
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Video uploaded to TikTok as draft!');
    },
    onError: (err: any) => {
      setUploadStep('select');
      toast.error(err?.response?.data?.message || 'Failed to upload video');
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Select a video first');

      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('caption', caption);

      const uploadRes = await api.post('/social-auth/tiktok/upload-draft', formData);
      return uploadRes.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Draft saved!');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save draft');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="w-full max-w-6xl relative animate-slide-up bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ height: '90vh', maxHeight: '900px' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <span className="text-sm font-semibold text-gray-900">Upload to TikTok</span>
          <button type="button" onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || uploadMutation.isPending}
            className="text-sm font-semibold text-[#fe2c55] hover:text-[#fe2c55]/80 disabled:opacity-50 px-3 py-1"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[38%] bg-gray-50 flex items-center justify-center relative min-h-0">
            {uploadStep === 'done' ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-gray-900 font-semibold text-lg">Uploaded to TikTok!</p>
                <p className="text-gray-500 text-sm text-center">Video has been sent as draft to your TikTok account.</p>
                <button onClick={onClose}
                  className="px-6 py-2 bg-[#fe2c55] text-white rounded-lg text-sm font-semibold hover:bg-[#fe2c55]/90 transition-all"
                >
                  Done
                </button>
              </div>
            ) : uploadStep === 'uploading' ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8">
                <Loader2 className="w-12 h-12 text-[#fe2c55] animate-spin" />
                <p className="text-gray-900 font-semibold">Uploading to TikTok...</p>
                <p className="text-gray-500 text-sm">Please wait while we process your video.</p>
              </div>
            ) : mediaPreview ? (
              <div className="w-full h-full flex items-center justify-center relative">
                {selectedFile?.type.startsWith('video/') ? (
                  <video src={mediaPreview} controls className="h-full w-auto object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="h-full w-auto object-contain" />
                )}
                  <button type="button" onClick={() => { setSelectedFile(null); setMediaPreview(null); }}
                  className="absolute top-3 right-3 p-1.5 bg-gray-900/50 hover:bg-gray-900/70 text-white rounded-full transition-all"
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
                    dragOver ? 'border-[#fe2c55]/60 bg-[#fe2c55]/10' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Upload video to TikTok</p>
                    <p className="text-xs text-gray-500 mt-0.5">Click or drag & drop</p>
                  </div>
                  <p className="text-[10px] text-gray-400">Supported: MP4, MOV (max 500MB)</p>
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileInput} hidden />
                </div>
              </div>
            )}
          </div>

          <div className="w-[62%] flex flex-col overflow-y-auto bg-white">
            <div className="px-5 py-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Caption</h4>
              <textarea value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Tulis caption untuk video TikTok..."
                rows={4}
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-transparent resize-none focus:outline-none border-none"
              />
              <span className="text-[10px] text-gray-400">{caption.length}/4000</span>
            </div>

            <div className="px-5 py-4 border-b border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How it works</h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#fe2c55]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#fe2c55]">1</span>
                  </div>
                  <p>Select a video file from your computer (MP4 or MOV)</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#fe2c55]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#fe2c55]">2</span>
                  </div>
                  <p>Add a caption for your video</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#fe2c55]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#fe2c55]">3</span>
                  </div>
                  <p>Click "Upload" to send directly to TikTok as a draft</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#fe2c55]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#fe2c55]">4</span>
                  </div>
                  <p>Open TikTok app to review, edit, and post your draft</p>
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="px-5 py-4 border-b border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Video Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">File name</span>
                    <span className="text-gray-900">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size</span>
                    <span className="text-gray-900">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type</span>
                    <span className="text-gray-900">{selectedFile.type}</span>
                  </div>
                </div>
              </div>
            )}

            {uploadStep === 'done' && (
              <div className="px-5 py-6 text-center">
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-green-700 font-semibold text-sm">Video successfully uploaded to TikTok!</p>
                  <p className="text-gray-500 text-xs mt-1">Check your TikTok app drafts to review and post.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload to TikTok as draft</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => createDraftMutation.mutate()} disabled={createDraftMutation.isPending}
              className="px-4 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all"
            >
              {createDraftMutation.isPending ? 'Saving...' : 'Save as local draft'}
            </button>
            <button type="button" onClick={() => uploadMutation.mutate()} disabled={!selectedFile || uploadStep === 'done'}
              className="px-5 py-1.5 text-xs font-semibold text-white bg-[#fe2c55] rounded-lg hover:bg-[#fe2c55]/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {uploadMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
              ) : uploadStep === 'done' ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> Upload to TikTok</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

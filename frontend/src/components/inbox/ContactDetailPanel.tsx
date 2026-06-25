import { useState } from 'react';
import { X, Phone, Mail, Tag, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useConversation, useAssignAgent } from '../../hooks/useConversation';
import { useQuery } from '@tanstack/react-query';
import { conversationService } from '../../services/conversation.service';
import { labelService, userService } from '../../services/index';
import { Avatar, Badge } from '../ui/index';

interface Props { conversationId: string; onClose: () => void; }

export default function ContactDetailPanel({ conversationId, onClose }: Props) {
  const { data: conversation } = useConversation(conversationId);
  const assignMutation = useAssignAgent(conversationId);
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => userService.list() });
  const { data: labels } = useQuery({ queryKey: ['labels'], queryFn: () => labelService.list() });
  const [showAssign, setShowAssign] = useState(false);
  const handleAddLabel = (labelId: string) => conversationService.addLabel(conversationId, labelId);

  if (!conversation) return null;
  const conv = conversation as any;
  const contact = conv.contact;
  const currentAgent = conv.assignments?.[0]?.user;

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">Contact Details</h3>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 border-b border-gray-100">
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar name={contact.name} size="lg" />
          <div>
            <p className="font-semibold text-gray-900">{contact.name}</p>
            <p className="text-xs text-gray-400 capitalize">{contact.sourceChannel?.toLowerCase() || 'unknown'}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {contact.metadata?.whatsappId && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="truncate font-mono text-xs">{contact.metadata.whatsappId as string}</span></div>}
          {contact.phone && <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="truncate">{contact.phone}</span></div>}
          {contact.email && <div className="flex items-center gap-2 text-sm text-gray-600"><Mail className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="truncate">{contact.email}</span></div>}
          <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4 text-gray-400 flex-shrink-0" /><span>First contact: {format(new Date(contact.firstContactDate), 'dd MMM yyyy')}</span></div>
          <div className="flex items-center gap-2 text-sm text-gray-600"><Tag className="w-4 h-4 text-gray-400 flex-shrink-0" /><span>{contact.totalMessages} messages total</span></div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Agent</h4>
          <button onClick={() => setShowAssign(o => !o)} className="text-xs text-primary hover:underline">{showAssign ? 'Cancel' : 'Change'}</button>
        </div>
        {currentAgent ? <div className="flex items-center gap-2"><Avatar name={currentAgent.name} size="sm" /><span className="text-sm text-gray-700">{currentAgent.name}</span></div> : <p className="text-sm text-gray-400">No agent assigned</p>}
        {showAssign && Array.isArray(users) && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {users.map((u: any) => (
              <button key={u.id} onClick={() => { assignMutation.mutate(u.id); setShowAssign(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm transition-colors text-left">
                <Avatar name={u.name} size="xs" /><span className="text-gray-700">{u.name}</span><span className="text-xs text-gray-400 ml-auto capitalize">{u.role.toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-gray-100">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Labels</h4>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {conv.labels?.map(({ label }: any) => <Badge key={label.id} label={label.name} color={label.color} />)}
          {conv.labels?.length === 0 && <p className="text-sm text-gray-400">No labels</p>}
        </div>
        {Array.isArray(labels) && (
          <div className="flex flex-wrap gap-1">
            {labels.filter((l: any) => !conv.labels?.find((cl: any) => cl.labelId === l.id)).map((l: any) => (
              <button key={l.id} onClick={() => handleAddLabel(l.id)}
                className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded-full text-gray-500 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">+ {l.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Conversation</h4>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="text-gray-400">Channel:</span> {conv.channel.name}</p>
          <p><span className="text-gray-400">Status:</span> <span className="capitalize text-gray-700">{conv.status.toLowerCase()}</span></p>
          <p><span className="text-gray-400">Started:</span> {format(new Date(conv.createdAt), 'dd MMM yyyy')}</p>
        </div>
      </div>
    </div>
  );
}

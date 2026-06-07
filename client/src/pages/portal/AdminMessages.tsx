import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare, Send, Search, Plus, ArrowLeft, Paperclip,
  Check, CheckCheck, Clock, Users, Inbox
} from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { NewMessageDialog } from '@/components/NewMessageDialog';

interface Message {
  id: number;
  senderId: string;
  recipientId: string;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Conversation {
  contactId: string;
  contactName: string;
  contactInitials: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  messages: Message[];
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(true);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages/user', user?.id],
    enabled: !!user,
  });

  // Real-time updates for messages
  useSocketIORealtime({
    queryKey: ['/api/messages/user', user?.id],
    onEvent: (event) => {
      if (event.eventType === 'message:new') {
        const msg = event.data;
        // Show notification if it's a message for current user and either 
        // 1. Not from current selected contact
        // 2. OR mobile view with conversation list shown
        if (msg.recipientId === user?.id && (msg.senderId !== selectedContactId || showConversations)) {
          toast({
            title: `New message from ${msg.senderName || 'User'}`,
            description: msg.subject || 'Click to view',
          });
          queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
        }
      }
    }
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedContactId, messages]);

  // Mark as read when opening a conversation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: number[]) => {
      await Promise.all(messageIds.map(id =>
        apiRequest('POST', `/api/messages/${id}/read`)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
    }
  });

  useEffect(() => {
    if (selectedContactId && messages.length > 0) {
      const unreadIds = messages
        .filter(m => m.senderId === selectedContactId && !m.isRead)
        .map(m => m.id);
      
      if (unreadIds.length > 0) {
        markAsReadMutation.mutate(unreadIds);
      }
    }
  }, [selectedContactId, messages]);

  const conversations = useMemo(() => {
    const map = new Map<string, Conversation>();
    
    messages.forEach(msg => {
      const isSender = msg.senderId === user?.id;
      const contactId = isSender ? msg.recipientId : msg.senderId;
      const contactName = isSender ? (msg as any).recipientName : (msg as any).senderName;
      
      if (!map.has(contactId)) {
        const initials = contactName
          ? contactName.split(' ').map((n: any) => n[0]).join('').toUpperCase()
          : 'U';
          
        map.set(contactId, {
          contactId,
          contactName: contactName || 'User',
          contactInitials: initials,
          lastMessage: msg.content,
          lastTime: msg.createdAt,
          unreadCount: 0,
          messages: []
        });
      }
      
      const conv = map.get(contactId)!;
      conv.messages.push(msg);
      
      // Update last message info if this one is newer
      if (new Date(msg.createdAt) > new Date(conv.lastTime)) {
        conv.lastMessage = msg.content;
        conv.lastTime = msg.createdAt;
      }
      
      // Count unread (only messages received from this contact)
      if (!msg.isRead && !isSender) {
        conv.unreadCount++;
      }
    });
    
    return Array.from(map.values()).sort((a, b) => 
      new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    );
  }, [messages, user?.id]);

  const filteredConversations = conversations.filter(conv =>
    conv.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedConversation = useMemo(() => 
    conversations.find(c => c.contactId === selectedContactId),
    [conversations, selectedContactId]
  );

  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/messages', data);
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
      setMessageText('');
    },
    onError: (error: any) => {
      toast({ title: 'Failed to Send', description: error.message || 'Could not send message. Please try again.', variant: 'destructive' });
    }
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedContactId) return;

    sendMessageMutation.mutate({
      recipientId: selectedContactId,
      subject: selectedConversation?.messages[0]?.subject || 'Direct Message',
      content: messageText
    });
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="p-2 space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      {/* Conversations List */}
      <div className={`${showConversations ? 'flex' : 'hidden'} w-full flex-col bg-muted/5`}>
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Messages
            </h2>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setIsNewMessageOpen(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="bg-gray-100 dark:bg-gray-800 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-gray-400">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground">No conversations found</p>
              <Button variant="outline" size="sm" onClick={() => setIsNewMessageOpen(true)}>
                Start a conversation
              </Button>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.contactId}
                className={`w-full flex items-center gap-3 p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 text-left relative ${selectedContactId === conv.contactId ? 'bg-primary/5 dark:bg-primary/5' : ''}`}
                onClick={() => {
                  setSelectedContactId(conv.contactId);
                  setShowConversations(false);
                }}
              >
                <Avatar className="h-11 w-11 border-2 border-white dark:border-gray-800 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-primary/85 to-indigo-600 text-white font-medium">
                    {conv.contactInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold truncate">{conv.contactName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">{timeAgo(conv.lastTime)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate line-clamp-1">{conv.lastMessage}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary shrink-0">
                    {conv.unreadCount}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className={`${!showConversations ? 'flex' : 'hidden'} flex-1 flex-col bg-background`}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setShowConversations(true)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-gray-700">
                <AvatarFallback className="bg-primary/10 text-primary dark:bg-primary/5 dark:text-primary/60 font-medium text-xs">
                  {selectedConversation.contactInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-bold">{selectedConversation.contactName}</h3>
                <div className="flex items-center gap-1.5 prose-sm">
                  <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 border-0">
                    {selectedConversation.messages[0]?.subject || 'Direct Message'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
              {selectedConversation.messages.map((msg, i) => {
                const isMine = msg.senderId === user?.id;
                const nextMsg = selectedConversation.messages[i+1];
                const showTime = !nextMsg || new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() > 300000;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}>
                    <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm border ${
                      isMine 
                        ? 'bg-primary text-white rounded-br-none border-primary' 
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className={`flex items-center justify-end gap-1.5 mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        <span className="text-[10px] opacity-70 font-medium uppercase">{formatTime(msg.createdAt)}</span>
                        {isMine && (
                          msg.isRead ? <CheckCheck className="w-3 h-3 text-primary/50" /> : <Check className="w-3 h-3 opacity-60" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex items-center gap-2 bg-card">
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" />
              <Input
                placeholder="Type your message..."
                className="flex-1 bg-muted border-0 h-10 focus-visible:ring-1 focus-visible:ring-primary rounded-full px-4"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95 shrink-0"
                disabled={!messageText.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-muted/5">
            <div className="bg-card p-8 rounded-full shadow-lg border border-border">
              <MessageSquare className="w-16 h-16 text-primary/50" />
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="text-xl font-bold">Your Messages</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send direct messages to students, teachers, and other administrators for efficient school communication.
              </p>
            </div>
            <Button className="rounded-full px-8 shadow-md" onClick={() => setIsNewMessageOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Compose New Message
            </Button>
          </div>
        )}
      </div>

      <NewMessageDialog
        open={isNewMessageOpen}
        onOpenChange={setIsNewMessageOpen}
        currentUserId={user?.id}
        description="Send a direct message to any school member"
        recipientPlaceholder="e.g. THS/STU/001 or johndoe@gmail.com"
      />
    </div>
  );
}

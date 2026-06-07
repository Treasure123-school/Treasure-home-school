import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare, Send, Search, Plus, ArrowLeft, Paperclip,
  Check, CheckCheck, Inbox
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

export default function StudentMessages() {
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

  useSocketIORealtime({
    queryKey: ['/api/messages/user', user?.id],
    onEvent: (event) => {
      if (event.eventType === 'message:new') {
        const msg = event.data;
        if (msg.recipientId === user?.id && (msg.senderId !== selectedContactId || showConversations)) {
          toast({
            title: `New message from ${msg.senderName || 'Teacher'}`,
            description: msg.subject || 'Click to view',
          });
          queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
        }
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedContactId, messages]);

  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: number[]) => {
      await Promise.all(messageIds.map(id => apiRequest('POST', `/api/messages/${id}/read`)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] }),
  });

  useEffect(() => {
    if (selectedContactId && messages.length > 0) {
      const unreadIds = (messages as Message[])
        .filter(m => m.senderId === selectedContactId && !m.isRead)
        .map(m => m.id);
      if (unreadIds.length > 0) markAsReadMutation.mutate(unreadIds);
    }
  }, [selectedContactId, messages]);

  const conversations = useMemo(() => {
    const map = new Map<string, Conversation>();
    (messages as Message[]).forEach(msg => {
      const isSender = msg.senderId === user?.id;
      const contactId = isSender ? msg.recipientId : msg.senderId;
      const contactName = isSender ? (msg as any).recipientName : (msg as any).senderName;
      if (!map.has(contactId)) {
        const initials = contactName
          ? contactName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
          : 'U';
        map.set(contactId, {
          contactId,
          contactName: contactName || 'Teacher',
          contactInitials: initials,
          lastMessage: msg.content,
          lastTime: msg.createdAt,
          unreadCount: 0,
          messages: [],
        });
      }
      const conv = map.get(contactId)!;
      conv.messages.push(msg);
      if (new Date(msg.createdAt) > new Date(conv.lastTime)) {
        conv.lastMessage = msg.content;
        conv.lastTime = msg.createdAt;
      }
      if (!msg.isRead && !isSender) conv.unreadCount++;
    });
    return Array.from(map.values())
      .map(c => ({ ...c, messages: c.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) }))
      .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
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
      toast({ title: 'Failed to Send', description: error.message || 'Could not send message.', variant: 'destructive' });
    }
  });

  const handleSendInThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedContactId) return;
    sendMessageMutation.mutate({
      recipientId: selectedContactId,
      subject: selectedConversation?.messages[0]?.subject || 'Message',
      content: messageText,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInThread(e as any);
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in.</div>;

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
              {totalUnread > 0 && (
                <Badge className="h-5 rounded-full px-1.5 text-[10px] bg-primary">{totalUnread}</Badge>
              )}
            </h2>
            <Button
              size="icon" variant="ghost" className="h-8 w-8 rounded-full"
              onClick={() => setIsNewMessageOpen(true)}
              data-testid="button-compose-message"
            >
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
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No conversations found' : 'No messages yet'}
              </p>
              {!searchTerm && (
                <Button variant="outline" size="sm" onClick={() => setIsNewMessageOpen(true)}>
                  Message a teacher
                </Button>
              )}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.contactId}
                className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border text-left relative ${selectedContactId === conv.contactId ? 'bg-primary/5 dark:bg-primary/5' : ''}`}
                onClick={() => { setSelectedContactId(conv.contactId); setShowConversations(false); }}
                data-testid={`conversation-${conv.contactId}`}
              >
                <Avatar className="h-11 w-11 border-2 border-background shadow-sm flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-primary/85 to-indigo-600 text-white font-medium">
                    {conv.contactInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`truncate text-sm ${conv.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>{conv.contactName}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">{timeAgo(conv.lastTime)}</span>
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{conv.lastMessage}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary shrink-0 text-[10px]">
                    {conv.unreadCount}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className={`${!showConversations ? 'flex' : 'hidden'} flex-1 flex-col bg-background`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3 bg-card flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setShowConversations(true)} data-testid="button-back-to-list">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-9 w-9 border border-border flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-primary/85 to-indigo-600 text-white font-medium text-sm">
                  {selectedConversation.contactInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{selectedConversation.contactName}</p>
                <p className="text-xs text-muted-foreground">Teacher</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/5">
              {selectedConversation.messages.map((msg, i) => {
                const isSent = msg.senderId === user.id;
                const showTime = i === 0 || (
                  new Date(msg.createdAt).getTime() - new Date(selectedConversation.messages[i - 1].createdAt).getTime() > 5 * 60 * 1000
                );
                return (
                  <div key={msg.id}>
                    {showTime && (
                      <div className="flex justify-center my-2">
                        <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] sm:max-w-[60%]">
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isSent
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          {isSent && (
                            msg.isRead
                              ? <CheckCheck className="h-3 w-3 text-primary" />
                              : <Check className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex-shrink-0 bg-card">
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                  data-testid="button-attach-file"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" />
                <Textarea
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="flex-1 resize-none bg-muted border-0 rounded-xl text-sm min-h-[40px] max-h-[120px] py-2.5"
                  data-testid="input-message-text"
                />
                <Button
                  onClick={handleSendInThread}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full h-10 w-10 p-0 flex-shrink-0 shadow-md active:scale-95 transition-all"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-muted/5">
            <div className="bg-card p-8 rounded-full shadow-lg border border-border">
              <MessageSquare className="w-16 h-16 text-primary/50" />
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="text-xl font-bold">Your Messages</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send messages to your teachers to ask questions or get help with your studies.
              </p>
            </div>
            <Button className="rounded-full px-8 shadow-md" onClick={() => setIsNewMessageOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </div>
        )}
      </div>

      <NewMessageDialog
        open={isNewMessageOpen}
        onOpenChange={setIsNewMessageOpen}
        currentUserId={user?.id}
        description="Send a message to your teacher"
        recipientPlaceholder="e.g. THS/TCH/001"
      />
    </div>
  );
}

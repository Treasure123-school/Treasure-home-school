import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare, Send, Search, Plus, ArrowLeft, Paperclip,
  Check, CheckCheck, Clock, Users, Inbox, Loader2, CheckCircle2
} from 'lucide-react';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

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

export default function TeacherMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [newMsgRecipient, setNewMsgRecipient] = useState('');
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');
  const [showConversations, setShowConversations] = useState(true);
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages/user', user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/messages/user/${user!.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!user,
  });

  // Real-time updates for messages
  useSocketIORealtime({
    queryKey: ['/api/messages/user', user?.id],
    onEvent: (event) => {
      if (event.eventType === 'message:new') {
        const msg = event.data;
        // Show toast if message is for this user and not by them
        if (msg.recipientId === user?.id && msg.senderId !== user?.id) {
          toast({
            title: `New Message from ${msg.senderName || 'Student'}`,
            description: msg.subject || 'Click to view',
          });
        }
      }
    }
  });

  const { data: students = [] } = useQuery<User[]>({
    queryKey: ['/api/users', 'Student'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=Student', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch students');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: otherTeachers = [] } = useQuery<User[]>({
    queryKey: ['/api/users', 'Teacher'],
    queryFn: async () => {
      const res = await fetch('/api/users?role=Teacher', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch teachers');
      return res.json();
    },
    enabled: !!user,
  });

  const handleVerifyRecipient = async () => {
    if (!recipientIdentifier.trim()) return;
    setIsVerifying(true);
    try {
      const response = await fetch(`/api/messages/lookup/${encodeURIComponent(recipientIdentifier.trim())}`, { credentials: 'include' });
      if (!response.ok) {
        setRecipientInfo(null);
        setNewMsgRecipient('');
        toast({ title: 'User Not Found', description: 'Could not find a user with that username or ID.', variant: 'destructive' });
      } else {
        const data = await response.json();
        setRecipientInfo(data);
        setNewMsgRecipient(data.id);
        toast({ title: 'User Verified', description: `Recipient: ${data.firstName} ${data.lastName} (${data.roleName})` });
      }
    } catch (error) {
      toast({ title: 'Lookup Error', description: 'Failed to verify recipient. Please try again.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async (data: { recipientId: string; subject: string; content: string }) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, senderId: user!.id }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
      setMessageText('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' }),
  });

  const newMessageMutation = useMutation({
    mutationFn: async (data: { recipientId: string; subject: string; content: string }) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, senderId: user!.id }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] });
      setIsNewMessageOpen(false);
      setNewMsgRecipient('');
      setNewMsgSubject('');
      setNewMsgContent('');
      setRecipientIdentifier('');
      setRecipientInfo(null);
      toast({ title: 'Message Sent', description: 'Your message has been sent.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      await fetch(`/api/messages/${messageId}/read`, { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/messages/user', user?.id] }),
  });

  const allRecipients = useMemo(() => [...students, ...otherTeachers], [students, otherTeachers]);

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    allRecipients.forEach(r => { map[r.id] = r; });
    if (user) map[user.id] = user as User;
    return map;
  }, [allRecipients, user]);

  const getName = (id: string) => {
    const u = userMap[id];
    if (!u) return 'Unknown';
    return `${u.firstName} ${u.lastName}`;
  };

  const getInitials = (id: string) => {
    const u = userMap[id];
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`;
  };

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return [];
    const map: Record<string, Message[]> = {};
    messages.forEach(msg => {
      const other = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      if (!map[other]) map[other] = [];
      map[other].push(msg);
    });
    return Object.entries(map).map(([contactId, msgs]) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const last = sorted[sorted.length - 1];
      const unread = msgs.filter(m => m.recipientId === user.id && !m.isRead).length;
      return {
        contactId,
        contactName: getName(contactId),
        contactInitials: getInitials(contactId),
        lastMessage: last?.content ?? '',
        lastTime: last?.createdAt ?? '',
        unreadCount: unread,
        messages: sorted,
      };
    }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }, [messages, user, userMap]);

  const filteredConversations = useMemo(() =>
    conversations.filter(c => c.contactName.toLowerCase().includes(searchTerm.toLowerCase())),
    [conversations, searchTerm]
  );

  const selectedConversation = useMemo(() =>
    conversations.find(c => c.contactId === selectedContactId) ?? null,
    [conversations, selectedContactId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages.length]);

  useEffect(() => {
    if (selectedConversation && user) {
      selectedConversation.messages
        .filter(m => m.recipientId === user.id && !m.isRead)
        .forEach(m => markReadMutation.mutate(m.id));
    }
  }, [selectedContactId]);

  const handleSelectConversation = (contactId: string) => {
    setSelectedContactId(contactId);
    setShowConversations(false);
  };

  const handleSend = () => {
    if (!messageText.trim() || !selectedContactId) return;
    sendMutation.mutate({
      recipientId: selectedContactId,
      subject: 'Message',
      content: messageText.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Please log in.</div>;

  return (
    <div className="h-[calc(100vh-130px)] flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <Button
          onClick={() => setIsNewMessageOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
          data-testid="button-new-message"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Message</span>
        </Button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex">

        {/* Conversation Sidebar */}
        <div className={`${showConversations ? 'flex' : 'hidden'} md:flex w-full md:w-[300px] lg:w-[320px] flex-col border-r border-gray-100 dark:border-gray-800 flex-shrink-0`}>
          {/* Search */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                data-testid="input-search-conversations"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-3">
                  <Inbox className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No conversations yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start a new message to begin</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.contactId}
                  onClick={() => handleSelectConversation(conv.contactId)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    selectedContactId === conv.contactId
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-r-blue-600'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`conversation-${conv.contactId}`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold">
                        {conv.contactInitials}
                      </AvatarFallback>
                    </Avatar>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {conv.contactName}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(conv.lastTime)}</span>
                    </div>
                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={`${!showConversations ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-full p-6 mb-4">
                <MessageSquare className="h-12 w-12 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Select a Conversation</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                Choose a conversation from the list or start a new message.
              </p>
              <Button
                onClick={() => setIsNewMessageOpen(true)}
                variant="outline"
                className="mt-4 rounded-xl gap-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
              >
                <Plus className="h-4 w-4" />
                New Message
              </Button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                <button
                  onClick={() => { setShowConversations(true); setSelectedContactId(null); }}
                  className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold">
                    {selectedConversation.contactInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedConversation.contactName}</p>
                  <p className="text-xs text-gray-400">Student</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {selectedConversation.messages.map((msg, i) => {
                  const isSent = msg.senderId === user.id;
                  const showTime = i === 0 || (
                    new Date(msg.createdAt).getTime() - new Date(selectedConversation.messages[i-1].createdAt).getTime() > 5 * 60 * 1000
                  );
                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <div className="flex justify-center my-2">
                          <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">
                            {new Date(msg.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] sm:max-w-[60%] group`}>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isSent
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                          }`}>
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                            {isSent && (
                              msg.isRead
                                ? <CheckCheck className="h-3 w-3 text-blue-500" />
                                : <Check className="h-3 w-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex-shrink-0 bg-white dark:bg-gray-900">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                    title="Attach file"
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
                    className="flex-1 resize-none bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl text-sm min-h-[40px] max-h-[120px] py-2.5"
                    data-testid="input-message-text"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 w-10 p-0 flex-shrink-0"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Plus className="h-5 w-5 text-blue-600" />
              New Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Recipient (Username or ID)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter username or ID..."
                  value={recipientIdentifier}
                  onChange={(e) => setRecipientIdentifier(e.target.value)}
                  className="rounded-xl flex-1"
                  disabled={!!recipientInfo}
                />
                {recipientInfo ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setRecipientInfo(null);
                      setRecipientIdentifier('');
                      setNewMsgRecipient('');
                    }}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    Clear
                  </Button>
                ) : (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleVerifyRecipient}
                    disabled={isVerifying || !recipientIdentifier.trim()}
                    className="rounded-xl"
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                )}
              </div>
              {recipientInfo && (
                <div className="mt-2 text-[11px] p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Verified: <strong>{recipientInfo.firstName} {recipientInfo.lastName}</strong> ({recipientInfo.roleName})</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Subject</Label>
              <Input
                placeholder="Message subject..."
                value={newMsgSubject}
                onChange={e => setNewMsgSubject(e.target.value)}
                className="rounded-xl"
                data-testid="input-new-message-subject"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Message</Label>
              <Textarea
                placeholder="Write your message..."
                value={newMsgContent}
                onChange={e => setNewMsgContent(e.target.value)}
                rows={4}
                className="rounded-xl resize-none"
                data-testid="input-new-message-content"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setIsNewMessageOpen(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={() => newMessageMutation.mutate({ recipientId: newMsgRecipient, subject: newMsgSubject, content: newMsgContent })}
                disabled={!newMsgRecipient || !newMsgContent.trim() || newMessageMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
                data-testid="button-send-new-message"
              >
                <Send className="h-4 w-4" />
                {newMessageMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

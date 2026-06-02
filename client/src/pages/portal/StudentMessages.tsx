import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare, Send, Search, Plus, ArrowLeft, Paperclip,
  Check, CheckCheck, Inbox, Loader2, CheckCircle2
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
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');
  const [showConversations, setShowConversations] = useState(true);
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [newMsgRecipient, setNewMsgRecipient] = useState('');

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
      setIsNewMessageOpen(false);
      setNewMsgRecipient('');
      setNewMsgSubject('');
      setNewMsgContent('');
      setRecipientIdentifier('');
      setRecipientInfo(null);
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

  const handleVerifyRecipient = async () => {
    if (!recipientIdentifier.trim()) return;
    setIsVerifying(true);
    try {
      const response = await apiRequest('GET', `/api/messages/lookup/${encodeURIComponent(recipientIdentifier.trim())}`);
      if (!response.ok) {
        setRecipientInfo(null);
        setNewMsgRecipient('');
        toast({ title: 'User Not Found', description: 'Could not find a user with that identifier.', variant: 'destructive' });
      } else {
        const data = await response.json();
        setRecipientInfo(data);
        setNewMsgRecipient(data.id);
        toast({ title: 'User Verified', description: `${data.firstName} ${data.lastName} (${data.roleName})` });
      }
    } catch {
      toast({ title: 'Lookup Error', description: 'Failed to verify recipient.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
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
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Messages
              {totalUnread > 0 && (
                <Badge className="h-5 rounded-full px-1.5 text-[10px] bg-blue-600">{totalUnread}</Badge>
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
                className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border text-left relative ${selectedContactId === conv.contactId ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                onClick={() => { setSelectedContactId(conv.contactId); setShowConversations(false); }}
                data-testid={`conversation-${conv.contactId}`}
              >
                <Avatar className="h-11 w-11 border-2 border-background shadow-sm flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium">
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
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-blue-600 shrink-0 text-[10px]">
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
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium text-sm">
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
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          {isSent && (
                            msg.isRead
                              ? <CheckCheck className="h-3 w-3 text-blue-500" />
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
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-10 w-10 p-0 flex-shrink-0 shadow-md active:scale-95 transition-all"
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
              <MessageSquare className="w-16 h-16 text-blue-200" />
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

      {/* New Message Dialog */}
      <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  New Message
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  Send a message to your teacher
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipient (Username or ID)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="e.g. THS/TCH/001"
                    value={recipientIdentifier}
                    onChange={(e) => setRecipientIdentifier(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyRecipient()}
                    disabled={!!recipientInfo}
                    className="rounded-xl"
                    data-testid="input-recipient-identifier"
                  />
                  {isVerifying && <div className="absolute right-3 top-2.5"><Loader2 className="h-4 w-4 animate-spin text-blue-600" /></div>}
                  {recipientInfo && !isVerifying && <div className="absolute right-3 top-2.5"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>}
                </div>
                {recipientInfo ? (
                  <Button variant="ghost" size="sm" onClick={() => { setRecipientInfo(null); setRecipientIdentifier(''); setNewMsgRecipient(''); }} className="text-destructive hover:text-destructive rounded-xl">Clear</Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={handleVerifyRecipient} disabled={isVerifying || !recipientIdentifier.trim()} className="rounded-xl" data-testid="button-verify-recipient">
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </Button>
                )}
              </div>
              {recipientInfo && (
                <div className="flex items-center gap-2 p-2 px-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-lg">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-green-500 text-white text-[10px]">{recipientInfo.firstName?.[0]}{recipientInfo.lastName?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">
                    {recipientInfo.firstName} {recipientInfo.lastName} ({recipientInfo.roleName})
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject</Label>
              <Input placeholder="What is this about?" value={newMsgSubject} onChange={(e) => setNewMsgSubject(e.target.value)} className="rounded-xl" data-testid="input-new-message-subject" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</Label>
              <Textarea placeholder="Write your message here..." className="min-h-[120px] resize-none rounded-xl" value={newMsgContent} onChange={(e) => setNewMsgContent(e.target.value)} data-testid="input-new-message-content" />
            </div>
            <div className="space-y-2 pt-1">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
                onClick={() => sendMessageMutation.mutate({ recipientId: newMsgRecipient, subject: newMsgSubject || 'Message', content: newMsgContent })}
                disabled={!newMsgRecipient || !newMsgContent.trim() || sendMessageMutation.isPending}
                data-testid="button-send-new-message"
              >
                {sendMessageMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                  : <><Send className="h-4 w-4" />Send Message</>}
              </Button>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsNewMessageOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

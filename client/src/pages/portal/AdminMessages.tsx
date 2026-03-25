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
        fetch(`/api/messages/${id}/read`, { method: 'POST', credentials: 'include' })
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
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
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
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
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

  const handleVerifyRecipient = async () => {
    if (!recipientIdentifier.trim()) return;
    setIsVerifying(true);
    try {
      const response = await fetch(`/api/messages/lookup/${encodeURIComponent(recipientIdentifier.trim())}`);
      if (!response.ok) {
        setRecipientInfo(null);
        setNewMsgRecipient('');
        toast({ title: 'User Not Found', description: 'Could not find a user with that identifier.', variant: 'destructive' });
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

  const dialogOnSubmit = async (data: any) => {
    if (!newMsgRecipient || !newMsgContent) {
      toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }

    const msgData = {
      recipientId: newMsgRecipient,
      subject: newMsgSubject || 'Administrative Message',
      content: newMsgContent
    };

    sendMessageMutation.mutate(msgData);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-12 w-1/3 ml-auto" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Conversations List */}
      <div className={`${showConversations ? 'block' : 'hidden'} md:block w-full md:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50/30 dark:bg-gray-900/10`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
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
              className="pl-9 bg-white dark:bg-gray-900 h-9"
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
                className={`w-full flex items-center gap-3 p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 text-left relative ${selectedContactId === conv.contactId ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                onClick={() => {
                  setSelectedContactId(conv.contactId);
                  setShowConversations(false);
                }}
              >
                <Avatar className="h-11 w-11 border-2 border-white dark:border-gray-800 shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium">
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
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center bg-blue-600 shrink-0">
                    {conv.unreadCount}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className={`${!showConversations ? 'block' : 'hidden'} md:flex flex-1 flex-col bg-white dark:bg-gray-950`}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowConversations(true)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-gray-700">
                <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium text-xs">
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
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50/50 dark:bg-gray-950">
              {selectedConversation.messages.map((msg, i) => {
                const isMine = msg.senderId === user?.id;
                const nextMsg = selectedConversation.messages[i+1];
                const showTime = !nextMsg || new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() > 300000;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}>
                    <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm border ${
                      isMine 
                        ? 'bg-blue-600 text-white rounded-br-none border-blue-600' 
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className={`flex items-center justify-end gap-1.5 mt-1 ${isMine ? 'text-blue-50' : 'text-muted-foreground'}`}>
                        <span className="text-[10px] opacity-70 font-medium uppercase">{formatTime(msg.createdAt)}</span>
                        {isMine && (
                          msg.isRead ? <CheckCheck className="w-3 h-3 text-blue-200" /> : <Check className="w-3 h-3 opacity-60" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2 bg-white dark:bg-gray-950">
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" />
              <Input
                placeholder="Type your message..."
                className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 h-10 focus-visible:ring-1 focus-visible:ring-blue-500 rounded-full px-4"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95 shrink-0"
                disabled={!messageText.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-gray-50/50 dark:bg-gray-950">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-full shadow-lg border border-gray-100 dark:border-gray-800 animate-pulse-slow">
              <MessageSquare className="w-16 h-16 text-blue-200" />
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

      {/* New Message Dialog */}
      <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Plus className="w-6 h-6 text-blue-600" />
              New Message
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recipient (ID, Username, or Email)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="e.g. THS/STU/001 or johndoe@gmail.com"
                      value={recipientIdentifier}
                      onChange={(e) => setRecipientIdentifier(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyRecipient()}
                    />
                    {isVerifying && (
                      <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      </div>
                    )}
                    {recipientInfo && !isVerifying && (
                      <div className="absolute right-3 top-2.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleVerifyRecipient}
                    disabled={isVerifying || !recipientIdentifier.trim()}
                  >
                    Verify
                  </Button>
                </div>
                {recipientInfo && (
                  <div className="flex items-center gap-2 p-2 px-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-green-500 text-white text-[10px]">
                        {recipientInfo.firstName[0]}{recipientInfo.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Verified: {recipientInfo.firstName} {recipientInfo.lastName} ({recipientInfo.roleName})
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subject</Label>
                <Input
                  placeholder="What is this about?"
                  value={newMsgSubject}
                  onChange={(e) => setNewMsgSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Message</Label>
                <Textarea
                  placeholder="Write your message here..."
                  className="min-h-[120px] resize-none"
                  value={newMsgContent}
                  onChange={(e) => setNewMsgContent(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" className="rounded-full px-6" onClick={() => setIsNewMessageOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="rounded-full px-8 bg-blue-600 hover:bg-blue-700" 
                onClick={dialogOnSubmit}
                disabled={!newMsgRecipient || !newMsgContent || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

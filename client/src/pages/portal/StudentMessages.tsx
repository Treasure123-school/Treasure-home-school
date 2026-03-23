import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, Search, User, Calendar, Mail, ArrowLeft, Plus,
  Inbox, Clock, CheckCircle2, X
} from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';

export default function StudentMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [composeData, setComposeData] = useState({
    recipientId: '',
    subject: '',
    content: ''
  });
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!user) {
    return <div className="p-6 text-center text-muted-foreground">Please log in to access your messages.</div>;
  }

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/messages/user/${user.id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    }
  });

  // Real-time updates for messages
  useSocketIORealtime({
    queryKey: ['messages', user.id],
    onEvent: (event) => {
      if (event.eventType === 'message:new') {
        const msg = event.data;
        // Show toast if message is for this user and not currently selected
        if (msg.recipientId === user.id && selectedMessage?.id !== msg.id) {
          toast({
            title: `New Message from ${msg.senderName || 'Teacher'}`,
            description: msg.subject || 'Click to view',
          });
        }
      }
    }
  });

  const handleVerifyRecipient = async () => {
    if (!recipientIdentifier.trim()) return;
    setIsVerifying(true);
    try {
      const response = await fetch(`/api/messages/lookup/${encodeURIComponent(recipientIdentifier.trim())}`, { credentials: 'include' });
      if (!response.ok) {
        setRecipientInfo(null);
        setComposeData(prev => ({ ...prev, recipientId: '' }));
        toast({ title: 'User Not Found', description: 'Could not find a user with that username or ID.', variant: 'destructive' });
      } else {
        const data = await response.json();
        setRecipientInfo(data);
        setComposeData(prev => ({ ...prev, recipientId: data.id }));
        toast({ title: 'User Verified', description: `Recipient: ${data.firstName} ${data.lastName} (${data.roleName})` });
      }
    } catch (error) {
      toast({ title: 'Lookup Error', description: 'Failed to verify recipient. Please try again.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...messageData, senderId: user.id })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Message Sent', description: 'Your message has been sent successfully.' });
      setIsComposeOpen(false);
      setComposeData({ recipientId: '', subject: '', content: '' });
      setRecipientIdentifier('');
      setRecipientInfo(null);
      queryClient.invalidateQueries({ queryKey: ['messages', user.id] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await fetch(`/api/messages/${messageId}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', user.id] });
    }
  });

  const filteredMessages = messages.filter((message: any) =>
    message.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unreadCount = messages.filter((m: any) => !m.isRead).length;

  const handleSendMessage = () => {
    if (!composeData.recipientId || !composeData.subject || !composeData.content) {
      toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }
    sendMessageMutation.mutate(composeData);
  };

  const handleMessageClick = (message: any) => {
    setSelectedMessage(message);
    setShowDetail(true);
    if (!message.isRead) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const avatarColors = [
    'from-blue-500 to-blue-600', 'from-purple-500 to-purple-600',
    'from-green-500 to-green-600', 'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600', 'from-teal-500 to-teal-600',
  ];

  const getAvatarColor = (name: string) => {
    const index = (name?.charCodeAt(0) || 0) % avatarColors.length;
    return avatarColors[index];
  };

  const MessageList = () => (
    <div className="flex flex-col h-full">
      {/* List header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
            data-testid="input-search-messages"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {searchTerm ? 'No results found' : 'Your inbox is empty'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? `No messages matching "${searchTerm}"` : 'Messages from your teachers will appear here.'}
            </p>
            {!searchTerm && (
              <Button size="sm" onClick={() => setIsComposeOpen(true)} data-testid="button-compose-empty">
                <Plus className="h-4 w-4 mr-2" /> Send a message
              </Button>
            )}
          </div>
        ) : (
          filteredMessages.map((message: any) => {
            const senderName = message.senderName || 'Teacher';
            const isSelected = selectedMessage?.id === message.id;
            return (
              <button
                key={message.id}
                onClick={() => handleMessageClick(message)}
                className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-900/10 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : ''} ${!message.isRead ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}
                data-testid={`button-message-${message.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${getAvatarColor(senderName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                    {getInitials(senderName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${!message.isRead ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {senderName}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!message.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(message.createdAt)}
                        </span>
                      </div>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${!message.isRead ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                      {message.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {message.content}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const MessageDetail = () => (
    <div className="flex flex-col h-full">
      {selectedMessage ? (
        <>
          {/* Detail header */}
          <div className="flex-shrink-0 p-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {selectedMessage.subject}
              </h2>
              <button
                onClick={() => { setSelectedMessage(null); setShowDetail(false); }}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors"
                data-testid="button-close-message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${getAvatarColor(selectedMessage.senderName || 'Teacher')} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {getInitials(selectedMessage.senderName || 'Teacher')}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedMessage.senderName || 'Teacher'}</p>
                  <p className="text-[11px] text-muted-foreground">To: You</p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">{new Date(selectedMessage.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
          {/* Message content */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedMessage.content}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-full flex items-center justify-center mb-5 shadow-inner">
            <Mail className="h-9 w-9 text-blue-400 dark:text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Select a message</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Choose a message from your inbox to read its contents here.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Messages</h1>
            <p className="text-sm text-muted-foreground">Communicate with teachers and school staff</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold" data-testid="badge-unread-count">
              {unreadCount} unread
            </Badge>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3 shadow-sm">
          <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-total-messages">{messages.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3 shadow-sm">
          <div className="h-8 w-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unread</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-unread-messages">{unreadCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3 shadow-sm">
          <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Read</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-read-messages">{messages.length - unreadCount}</p>
          </div>
        </div>
      </div>

      {/* Main inbox area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Mobile: toggle between list and detail */}
        <div className="lg:hidden h-full">
          {showDetail && selectedMessage ? (
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 flex items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
                <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)} data-testid="button-back-to-list">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back to inbox
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MessageDetail />
              </div>
            </div>
          ) : (
            <MessageList />
          )}
        </div>

        {/* Desktop: side-by-side */}
        <div className="hidden lg:flex h-full min-h-[520px]">
          <div className="w-80 xl:w-96 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-hidden">
            <MessageList />
          </div>
          <div className="flex-1 overflow-hidden">
            <MessageDetail />
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsComposeOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        data-testid="button-compose-fab"
        title="New Message"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Compose Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Compose Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="recipient" className="text-sm font-medium">To (Username or ID)</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  id="recipient"
                  placeholder="Enter username or ID..."
                  value={recipientIdentifier}
                  onChange={(e) => setRecipientIdentifier(e.target.value)}
                  className="flex-1"
                  disabled={!!recipientInfo}
                  data-testid="input-recipient-identifier"
                />
                {recipientInfo ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setRecipientInfo(null);
                      setRecipientIdentifier('');
                      setComposeData(prev => ({ ...prev, recipientId: '' }));
                    }}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    Clear
                  </Button>
                ) : (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleVerifyRecipient}
                    disabled={isVerifying || !recipientIdentifier.trim()}
                  >
                    {isVerifying ? '...' : 'Verify'}
                  </Button>
                )}
              </div>
              {recipientInfo && (
                <div className="mt-2 text-xs p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>Found: <strong>{recipientInfo.firstName} {recipientInfo.lastName}</strong> ({recipientInfo.roleName})</span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
              <Input
                id="subject"
                placeholder="Enter subject..."
                value={composeData.subject}
                onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                className="mt-1.5"
                data-testid="input-message-subject"
              />
            </div>
            <div>
              <Label htmlFor="content" className="text-sm font-medium">Message</Label>
              <Textarea
                id="content"
                placeholder="Type your message..."
                rows={5}
                value={composeData.content}
                onChange={(e) => setComposeData(prev => ({ ...prev, content: e.target.value }))}
                className="mt-1.5 resize-none"
                data-testid="textarea-message-content"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsComposeOpen(false)} data-testid="button-cancel-compose">
                Cancel
              </Button>
              <Button onClick={handleSendMessage} disabled={sendMessageMutation.isPending} data-testid="button-send-message">
                <Send className="h-4 w-4 mr-2" />
                {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

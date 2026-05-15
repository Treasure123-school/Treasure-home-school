import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Inbox, Mail, MailOpen, Reply, Trash2, User, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject?: string;
  message: string;
  isRead: boolean;
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

export default function ContactInbox() {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all');

  const { data: messages = [], isLoading } = useQuery<ContactMessage[]>({
    queryKey: ['/api/admin/contact-messages'],
  });

  const filtered = messages.filter(m => {
    if (filter === 'unread') return !m.isRead;
    if (filter === 'replied') return !!m.response;
    return true;
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  function openMessage(msg: ContactMessage) {
    setSelectedMessage(msg);
    setReplyText('');
    setShowReply(false);
    if (!msg.isRead) markReadMutation.mutate(msg.id);
  }

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/admin/contact-messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/admin/contact-messages'] }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      apiRequest('POST', `/api/admin/contact-messages/${id}/respond`, { response }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contact-messages'] });
      setSelectedMessage(prev => prev ? { ...prev, response: replyText, respondedAt: new Date().toISOString() } : null);
      setShowReply(false);
      setReplyText('');
      toast({ title: 'Reply sent successfully' });
    },
    onError: () => toast({ title: 'Failed to send reply', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/contact-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contact-messages'] });
      if (selectedMessage?.id === deleteTarget) setSelectedMessage(null);
      setDeleteTarget(null);
      toast({ title: 'Message deleted' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" /> Contact Inbox
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">View and respond to website contact form submissions</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'unread', 'replied'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 text-xs">
                ({f === 'unread' ? messages.filter(m => !m.isRead).length : messages.filter(m => !!m.response).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter === 'all' ? 'No messages yet' : `No ${filter} messages`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <Card
              key={msg.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${!msg.isRead ? 'border-primary/50 bg-primary/5' : ''}`}
              onClick={() => openMessage(msg)}
              data-testid={`card-message-${msg.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {msg.isRead ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${!msg.isRead ? 'font-semibold' : ''}`} data-testid={`text-msg-name-${msg.id}`}>
                        {msg.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{msg.email}</span>
                      {msg.response && <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Replied</Badge>}
                      {!msg.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                    </div>
                    {msg.subject && <p className="text-sm font-medium mt-0.5">{msg.subject}</p>}
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {format(new Date(msg.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive flex-shrink-0"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(msg.id); }}
                    data-testid={`button-delete-msg-${msg.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Message Detail Dialog */}
      {selectedMessage && (
        <Dialog open onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-4 w-4" /> {selectedMessage.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Email:</span> {selectedMessage.email}</p>
                {selectedMessage.subject && <p><span className="font-medium">Subject:</span> {selectedMessage.subject}</p>}
                <p><span className="font-medium">Received:</span> {format(new Date(selectedMessage.createdAt), 'MMMM d, yyyy h:mm a')}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Message</p>
                <div className="bg-muted/30 rounded p-3 text-sm whitespace-pre-wrap">{selectedMessage.message}</div>
              </div>
              {selectedMessage.response && (
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Your Reply
                    {selectedMessage.respondedAt && (
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        ({format(new Date(selectedMessage.respondedAt), 'MMM d, yyyy')})
                      </span>
                    )}
                  </p>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm whitespace-pre-wrap">
                    {selectedMessage.response}
                  </div>
                </div>
              )}
              {showReply ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Reply</p>
                  <Textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={4}
                    data-testid="input-reply-text"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowReply(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => replyMutation.mutate({ id: selectedMessage.id, response: replyText })}
                      disabled={!replyText || replyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      {replyMutation.isPending ? 'Sending…' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setShowReply(true)} data-testid="button-reply-message">
                  <Reply className="h-4 w-4 mr-1" />
                  {selectedMessage.response ? 'Send Another Reply' : 'Reply'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this message.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

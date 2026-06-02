import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | undefined;
  description?: string;
  recipientPlaceholder?: string;
}

export function NewMessageDialog({
  open,
  onOpenChange,
  currentUserId,
  description = 'Send a message to anyone in the school',
  recipientPlaceholder = 'e.g. THS/TCH/001',
}: NewMessageDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<any>(null);
  const [recipientId, setRecipientId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const handleClose = () => {
    setRecipientIdentifier('');
    setRecipientInfo(null);
    setRecipientId('');
    setSubject('');
    setContent('');
    onOpenChange(false);
  };

  const handleVerify = async () => {
    if (!recipientIdentifier.trim()) return;
    setIsVerifying(true);
    try {
      const res = await apiRequest('GET', `/api/messages/lookup/${encodeURIComponent(recipientIdentifier.trim())}`);
      if (!res.ok) {
        setRecipientInfo(null);
        setRecipientId('');
        toast({ title: 'User Not Found', description: 'Could not find a user with that username or ID.', variant: 'destructive' });
      } else {
        const data = await res.json();
        setRecipientInfo(data);
        setRecipientId(data.id);
        toast({ title: 'User Verified', description: `${data.firstName} ${data.lastName} (${data.roleName})` });
      }
    } catch {
      toast({ title: 'Lookup Error', description: 'Failed to verify recipient.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/messages', {
        recipientId,
        subject: subject || 'Message',
        content,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/user', currentUserId] });
      toast({ title: 'Message Sent', description: 'Your message has been delivered.' });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to Send', description: err.message || 'Could not send message.', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2 pb-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                New Message
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Recipient (Username or ID)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={recipientPlaceholder}
                  value={recipientIdentifier}
                  onChange={(e) => setRecipientIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  disabled={!!recipientInfo}
                  data-testid="input-recipient-identifier"
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
              {recipientInfo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRecipientInfo(null); setRecipientIdentifier(''); setRecipientId(''); }}
                  className="text-destructive hover:text-destructive"
                >
                  Clear
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleVerify}
                  disabled={isVerifying || !recipientIdentifier.trim()}
                  data-testid="button-verify-recipient"
                >
                  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              )}
            </div>
            {recipientInfo && (
              <div className="flex items-center gap-2 p-2 px-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-md">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-green-500 text-white text-[10px]">
                    {recipientInfo.firstName?.[0]}{recipientInfo.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  {recipientInfo.firstName} {recipientInfo.lastName} ({recipientInfo.roleName})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Subject</Label>
            <Input
              placeholder="What is this about?"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-new-message-subject"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              placeholder="Write your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="input-new-message-content"
            />
          </div>

          <div className="space-y-2 pt-1">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={() => sendMutation.mutate()}
              disabled={!recipientId || !content.trim() || sendMutation.isPending}
              data-testid="button-send-new-message"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="h-4 w-4" />Send Message</>
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

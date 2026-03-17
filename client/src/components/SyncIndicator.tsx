import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type SyncStatus = 'connected' | 'disconnected' | 'syncing' | 'synced';

export function SyncIndicator({ className }: { className?: string }) {
  const [status, setStatus] = useState<SyncStatus>('connected');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('syncing');
      setIsVisible(true);
      setTimeout(() => {
        setStatus('synced');
        setTimeout(() => setIsVisible(false), 2000);
      }, 1000);
    };

    const handleOffline = () => {
      setStatus('disconnected');
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setStatus('disconnected');
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const statusConfig = {
    connected: {
      icon: Wifi,
      text: 'Connected',
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    disconnected: {
      icon: WifiOff,
      text: 'Offline - Changes will sync when reconnected',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    syncing: {
      icon: RefreshCw,
      text: 'Syncing...',
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    synced: {
      icon: Check,
      text: 'Synced',
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg",
            config.bg,
            "bg-card",
            className
          )}
          data-testid="sync-indicator"
        >
          <Icon 
            className={cn(
              "h-4 w-4",
              config.color,
              status === 'syncing' && "animate-spin"
            )} 
          />
          <span className={cn("text-sm font-medium", config.color)}>
            {config.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isSyncing, setIsSyncing };
}

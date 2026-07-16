import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useToast } from '../components/Toast';

export interface Notification {
  id: string;
  tenant_id: string;
  professional_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface UseRealtimeNotificationsProps {
  tenantId: string;
  profissionalId?: string;
}

export function useRealtimeNotifications({ tenantId, profissionalId }: UseRealtimeNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { addToast } = useToast();

  const playDingDong = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // Ding (nota mais alta)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0.1, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      // Dong (nota mais baixa)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.25);
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.85);
    } catch (e) {
      console.warn('Web Audio API não suportada ou bloqueada pelo navegador:', e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('read', false);

      if (profissionalId) {
        query = query.eq('professional_id', profissionalId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar notificações:', error);
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
    }
  }, [tenantId, profissionalId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('read', false);

      if (profissionalId) {
        query = query.eq('professional_id', profissionalId);
      }

      const { error } = await query;

      if (error) {
        console.error('Erro ao marcar todas notificações como lidas:', error);
        return;
      }

      setNotifications([]);
    } catch (err) {
      console.error('Erro ao marcar todas notificações como lidas:', err);
    }
  }, [tenantId, profissionalId]);

  useEffect(() => {
    if (!tenantId) return;

    // Busca inicial
    fetchNotifications();

    // Inicia assinatura do canal realtime 'public:notifications'
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as Notification;

          // Valida se a notificação pertence a este tenant
          if (newNotif.tenant_id !== tenantId) return;

          // Se profissionalId estiver definido, valida se a notificação é para este profissional (ou se é geral/nula)
          if (profissionalId && newNotif.professional_id && newNotif.professional_id !== profissionalId) {
            return;
          }

          // Atualiza estado local adicionando a nova notificação
          setNotifications((prev) => [newNotif, ...prev]);

          // Toca som ding-dong
          playDingDong();

          // Exibe toast
          addToast(newNotif.message, 'info');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, profissionalId, fetchNotifications, playDingDong, addToast]);

  return {
    notifications,
    unreadCount: notifications.length,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
  };
}

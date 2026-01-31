import { useEffect, useRef } from 'react';
import { supabase, clearSupabaseAuthStorage, isRefreshTokenError } from '../services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { triggerNotificationAlert } from '../utils/notification-alert';
import { useAuth } from '../store/auth-store';
import { Notification } from '../types';

/**
 * Hook para ativar subscriptions Realtime do Supabase
 * Atualiza automaticamente os dados quando houver mudanças no banco
 */
export const useRealtime = () => {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    // Configurar subscriptions para as principais tabelas
    const setupSubscriptions = () => {
      // Subscription para documentos
      const documentsChannel = supabase
        .channel('documents-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents',
          },
          (payload) => {
            console.log('Documents change:', payload);
            // Invalidar queries relacionadas a documentos
            queryClient.invalidateQueries({ queryKey: ['documents'] });
          }
        )
        .subscribe();

      // Subscription para inventário
      const inventoryChannel = supabase
        .channel('inventory-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_items',
          },
          (payload) => {
            console.log('Inventory items change:', payload);
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-groups'] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_groups',
          },
          (payload) => {
            console.log('Inventory groups change:', payload);
            queryClient.invalidateQueries({ queryKey: ['inventory-groups'] });
          }
        )
        .subscribe();

      // Subscription para notificações (apenas novas notificações)
      const notificationsChannel = supabase
        .channel('notifications-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Only listen to INSERT events (new notifications)
            schema: 'public',
            table: 'notifications',
          },
          (payload) => {
            console.log('[REALTIME] New notification event received:', {
              eventType: payload.eventType,
              hasNew: !!payload.new,
              hasUser: !!user,
              userId: user?.id,
              notificationTargetUserId: payload.new?.target_user_id,
            });
            
            // Se for uma nova notificação e for para o usuário atual
            if (payload.eventType === 'INSERT' && payload.new) {
              const notification = payload.new;
              
              // Verificar se temos usuário logado
              if (!user) {
                console.warn('[REALTIME] No user logged in, skipping notification');
                return;
              }
              
              // Verificar se a notificação é para o usuário atual ou é global
              const isForCurrentUser = !notification.target_user_id || notification.target_user_id === user.id;
              
              console.log('[REALTIME] Notification check:', {
                isForCurrentUser,
                targetUserId: notification.target_user_id,
                currentUserId: user.id,
              });
              
              if (isForCurrentUser) {
                console.log('[REALTIME] Processing notification for current user');
                // Preparar mensagem para o alert
                let alertMessage: string | undefined;
                if (notification.type === 'inventory.lowStock' && notification.payload_json) {
                  const payload = typeof notification.payload_json === 'string' 
                    ? JSON.parse(notification.payload_json) 
                    : notification.payload_json;
                  alertMessage = `Estoque baixo: ${payload.itemName || 'Item'} (${payload.stock || 0} unidades)`;
                }
                
                // Tocar som de notificação (não aguardamos o som terminar)
                triggerNotificationAlert(notification.type, alertMessage).catch(err => {
                  console.warn('Failed to trigger notification alert:', err);
                });

                // Mapear a notificação do formato do banco para o formato da aplicação
                // Usar a mesma lógica do repositório para garantir consistência
                const mappedNotification: Notification = {
                  id: notification.id,
                  type: notification.type,
                  payloadJson: typeof notification.payload_json === 'string' 
                    ? JSON.parse(notification.payload_json) 
                    : notification.payload_json || {},
                  createdAt: notification.created_at,
                  createdBySystem: notification.created_by_system ?? false,
                  targetUserId: notification.target_user_id || undefined,
                  readAt: undefined, // Nova notificação não está lida ainda
                };

                console.log('[REALTIME] Adding new notification to cache for user:', user.id, 'notification ID:', mappedNotification.id);
                
                // Adicionar a nova notificação ao cache imediatamente (optimistic update)
                const currentData = queryClient.getQueryData<Notification[]>(['notifications', user.id]);
                console.log('[REALTIME] Current cache data:', currentData?.length || 0, 'notifications');
                
                queryClient.setQueryData<Notification[]>(['notifications', user.id], (old) => {
                  if (!old) {
                    console.log('[REALTIME] No existing cache, creating new array with notification');
                    return [mappedNotification];
                  }
                  
                  // Verificar se a notificação já existe (evitar duplicatas)
                  const exists = old.some(n => n.id === mappedNotification.id);
                  if (exists) {
                    console.log('[REALTIME] Notification already in cache, skipping');
                    return old;
                  }
                  
                  console.log(`[REALTIME] Adding notification ${mappedNotification.id} to cache. Current count: ${old.length}, new count: ${old.length + 1}`);
                  
                  // Adicionar no início da lista (mais recente primeiro)
                  const updated = [mappedNotification, ...old];
                  console.log('[REALTIME] Updated cache with notification:', updated.length, 'notifications');
                  
                  // Verificar se a atualização foi aplicada
                  setTimeout(() => {
                    const verifyData = queryClient.getQueryData<Notification[]>(['notifications', user.id]);
                    console.log('[REALTIME] Cache verification after update:', verifyData?.length || 0, 'notifications');
                    const found = verifyData?.some(n => n.id === mappedNotification.id);
                    console.log('[REALTIME] Notification found in cache after update:', found);
                  }, 100);
                  
                  return updated;
                });

                // Forçar notificação de mudança para garantir que componentes reajam
                queryClient.notifyManager.batch(() => {
                  queryClient.invalidateQueries({ 
                    queryKey: ['notifications', user.id],
                    exact: true,
                    refetchType: 'none', // Não refetch, apenas notificar mudança
                  });
                });

                // Atualizar contador de não lidas
                queryClient.setQueryData<number>(['notifications', 'unreadCount', user.id], (old) => {
                  const newCount = (old || 0) + 1;
                  console.log('[REALTIME] Updating unread count:', old, '->', newCount);
                  return newCount;
                });

                // NÃO invalidar imediatamente - isso pode sobrescrever o optimistic update
                // Apenas fazer refetch silencioso em background após um delay maior
                // para garantir que a notificação foi persistida no banco
                setTimeout(() => {
                  console.log('Background sync: refetching notifications after delay');
                  queryClient.refetchQueries({ 
                    queryKey: ['notifications', user.id],
                    exact: true 
                  }).then(() => {
                    console.log('Background sync completed');
                  }).catch((err) => {
                    console.error('Background sync error:', err);
                  });
                }, 2000); // Delay maior para garantir que a notificação foi persistida
              }
            }
          }
        )
        .subscribe();

      // Subscription para notification_reads (para atualizar quando notificações são marcadas como lidas)
      // IMPORTANTE: Não invalidar queries quando hidden_at está sendo setado (clear all)
      const notificationReadsChannel = supabase
        .channel('notification-reads-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification_reads',
          },
          (payload) => {
            console.log('Notification read change:', payload);
            
            // Invalidar queries apenas se for para o usuário atual
            if (payload.new?.user_id && user && payload.new.user_id === user.id) {
              // Se hidden_at está sendo setado (clear all), NÃO invalidar
              // O optimistic update já removeu as notificações da lista
              // Isso previne que as notificações voltem após serem limpas
              const isClearAll = payload.new.hidden_at !== null && 
                                payload.new.hidden_at !== undefined &&
                                (payload.old === null || payload.old?.hidden_at === null || payload.old?.hidden_at === undefined);
              
              if (isClearAll) {
                console.log('Clear all detected (hidden_at set) - skipping invalidation to prevent notifications from reappearing');
                return;
              }
              
              // Para outras operações (marcar como lida individual), invalidar normalmente
              // Mas com um pequeno delay para evitar múltiplas invalidações em batch
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
                queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount', user.id] });
              }, 100);
            }
          }
        )
        .subscribe();

      // Subscription para produção
      const productionChannel = supabase
        .channel('productions-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'productions',
          },
          (payload) => {
            console.log('Productions change:', payload);
            queryClient.invalidateQueries({ queryKey: ['productions'] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'production_items',
          },
          (payload) => {
            console.log('Production items change:', payload);
            queryClient.invalidateQueries({ queryKey: ['productions'] });
            queryClient.invalidateQueries({ queryKey: ['production-items'] });
          }
        )
        .subscribe();

      // Subscription para eventos
      const eventsChannel = supabase
        .channel('events-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
          },
          (payload) => {
            console.log('Events change:', payload);
            queryClient.invalidateQueries({ queryKey: ['events'] });
          }
        )
        .subscribe();

      // Subscription para usuários (apenas para admins)
      const usersChannel = supabase
        .channel('users-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users',
          },
          (payload) => {
            console.log('Users change:', payload);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }
        )
        .subscribe();

      // Subscription para Blood Priority
      const bloodPriorityChannel = supabase
        .channel('blood-priority-changes', {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blood_priority_messages',
          },
          (payload) => {
            console.log('Blood priority messages change:', payload);
            queryClient.invalidateQueries({ queryKey: ['blood-priority'] });
          }
        )
        .subscribe();

      channelsRef.current = [
        documentsChannel,
        inventoryChannel,
        notificationsChannel,
        notificationReadsChannel,
        productionChannel,
        eventsChannel,
        usersChannel,
        bloodPriorityChannel,
      ];
    };

    // Verificar se está autenticado antes de criar subscriptions
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setupSubscriptions();
        }
      })
      .catch((err) => {
        if (isRefreshTokenError(err)) {
          clearSupabaseAuthStorage();
        }
      });

    // Cleanup: remover todas as subscriptions quando o componente desmontar
    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [queryClient, user]);
};

/**
 * Hook específico para subscription de uma tabela
 */
export const useRealtimeSubscription = (
  table: string,
  schema: string = 'public',
  events: ('INSERT' | 'UPDATE' | 'DELETE' | '*')[] = ['*']
) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const setupSubscription = () => {
      const channel = supabase
        .channel(`${table}-realtime`, {
          config: { private: true },
        });

      events.forEach((event) => {
        channel.on(
          'postgres_changes',
          {
            event: event === '*' ? '*' : event,
            schema,
            table,
          },
          (payload) => {
            console.log(`${table} ${event}:`, payload);
            queryClient.invalidateQueries({ queryKey: [table] });
          }
        );
      });

      channel.subscribe();
      channelRef.current = channel;
    };

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setupSubscription();
        }
      })
      .catch((err) => {
        if (isRefreshTokenError(err)) {
          clearSupabaseAuthStorage();
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, events, queryClient]);
};

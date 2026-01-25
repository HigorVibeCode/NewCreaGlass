import { Notification } from '../types';

/**
 * Formata o texto de exibição de uma notificação para a central de notificações
 * Retorna uma string formatada baseada no tipo e payload da notificação
 */
export function formatNotificationText(notification: Notification, t?: (key: string) => string): string {
  const { type, payloadJson } = notification;
  const translate = t || ((key: string) => key);
  
  // Debug: log all notification types to help diagnose issues
  if (__DEV__ && (type === 'workOrder.created' || type === 'event.created')) {
    console.log('[formatNotificationText] Processing notification:', {
      type,
      payloadJson,
      payloadJsonType: typeof payloadJson,
      payloadJsonKeys: payloadJson ? Object.keys(payloadJson) : [],
      hasPayload: !!payloadJson,
    });
  }

  // Debug log for tempered notifications
  if (type === 'production.tempered') {
    console.log('[formatNotificationText] Formatting tempered notification:', {
      type,
      payloadJson,
      payloadJsonType: typeof payloadJson,
      payloadJsonKeys: payloadJson ? Object.keys(payloadJson) : [],
      clientName: payloadJson?.clientName,
      orderType: payloadJson?.orderType,
      orderNumber: payloadJson?.orderNumber,
    });
  }

  switch (type) {
    case 'inventory.lowStock':
      return `${payloadJson?.itemName || 'Item'} - ${translate('notifications.lowStockMessage') || 'Estoque baixo'}`;

    case 'production.authorized': {
      const clientName = payloadJson?.clientName || 'Cliente';
      const orderType = payloadJson?.orderType || '';
      const orderNumber = payloadJson?.orderNumber || '';
      return `${clientName} | ${orderType} | ${orderNumber} - ${translate('production.status.authorized') || 'Autorizado'}`;
    }

    case 'production.tempered': {
      const clientName = payloadJson?.clientName || 'Cliente';
      const orderType = payloadJson?.orderType || '';
      const orderNumber = payloadJson?.orderNumber || '';
      return `${clientName} | ${orderType} | ${orderNumber} - ${translate('production.status.tempered') || 'Entrou na fase de temperamento'}`;
    }

    case 'workOrder.created': {
      const scheduledDate = payloadJson?.scheduledDate;
      const scheduledTime = payloadJson?.scheduledTime;
      
      // Debug log
      if (__DEV__) {
        console.log('[formatNotificationText] Formatting workOrder.created:', {
          scheduledDate,
          scheduledTime,
          scheduledDateType: typeof scheduledDate,
          scheduledTimeType: typeof scheduledTime,
          payloadJson,
        });
      }
      
      // Format date if available
      let dateText = '';
      if (scheduledDate && String(scheduledDate).trim() !== '') {
        try {
          // Handle different date formats
          let date: Date;
          const dateStr = String(scheduledDate).trim();
          if (dateStr.includes('T')) {
            date = new Date(dateStr);
          } else {
            // Add time component for proper parsing
            date = new Date(dateStr + 'T00:00:00');
          }
          
          if (!isNaN(date.getTime())) {
            dateText = date.toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            
            // Add time if available (format: HH:MM or HH:MM:SS)
            if (scheduledTime && String(scheduledTime).trim() !== '') {
              // Remove seconds if present (HH:MM:SS -> HH:MM)
              const timeStr = String(scheduledTime).trim().split(':').slice(0, 2).join(':');
              dateText += ` às ${timeStr}`;
            }
          } else {
            // Fallback: use the date string as-is
            dateText = dateStr;
            if (scheduledTime && String(scheduledTime).trim() !== '') {
              const timeStr = String(scheduledTime).trim().split(':').slice(0, 2).join(':');
              dateText += ` às ${timeStr}`;
            }
          }
        } catch (e) {
          console.warn('[formatNotificationText] Error formatting workOrder date:', e);
          dateText = String(scheduledDate);
          if (scheduledTime && String(scheduledTime).trim() !== '') {
            const timeStr = String(scheduledTime).trim().split(':').slice(0, 2).join(':');
            dateText += ` às ${timeStr}`;
          }
        }
      }
      
      const baseText = translate('notifications.workOrderCreated') || 'Nova Ordem de Serviço criada';
      return dateText ? `${baseText} - ${dateText}` : baseText;
    }

    case 'workOrder.updated': {
      const clientName = payloadJson?.clientName || 'Cliente';
      return `${translate('notifications.workOrderUpdated') || 'Ordem de Serviço Atualizada'}: ${clientName}`;
    }

    case 'event.created': {
      const startDate = payloadJson?.startDate;
      const startTime = payloadJson?.startTime;
      
      // Debug log
      if (__DEV__) {
        console.log('[formatNotificationText] Formatting event.created:', {
          startDate,
          startTime,
          startDateType: typeof startDate,
          startTimeType: typeof startTime,
          payloadJson,
        });
      }
      
      // Format date if available
      let dateText = '';
      if (startDate && String(startDate).trim() !== '') {
        try {
          // Handle different date formats
          let date: Date;
          const dateStr = String(startDate).trim();
          if (dateStr.includes('T')) {
            date = new Date(dateStr);
          } else {
            // Add time component for proper parsing
            date = new Date(dateStr + 'T00:00:00');
          }
          
          if (!isNaN(date.getTime())) {
            dateText = date.toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            
            // Add time if available (format: HH:MM or HH:MM:SS)
            if (startTime && String(startTime).trim() !== '') {
              // Remove seconds if present (HH:MM:SS -> HH:MM)
              const timeStr = String(startTime).trim().split(':').slice(0, 2).join(':');
              dateText += ` às ${timeStr}`;
            }
          } else {
            // Fallback: use the date string as-is
            dateText = dateStr;
            if (startTime && String(startTime).trim() !== '') {
              const timeStr = String(startTime).trim().split(':').slice(0, 2).join(':');
              dateText += ` às ${timeStr}`;
            }
          }
        } catch (e) {
          console.warn('[formatNotificationText] Error formatting event date:', e);
          dateText = String(startDate);
          if (startTime && String(startTime).trim() !== '') {
            const timeStr = String(startTime).trim().split(':').slice(0, 2).join(':');
            dateText += ` às ${timeStr}`;
          }
        }
      }
      
      const baseText = translate('notifications.eventCreated') || 'Novo Evento criado';
      return dateText ? `${baseText} - ${dateText}` : baseText;
    }

    case 'training.assigned': {
      const trainingTitle = payloadJson?.trainingTitle || 'Treinamento';
      return `${translate('notifications.trainingAssigned') || 'Novo Treinamento'}: ${trainingTitle}`;
    }

    case 'bloodPriority.new': {
      const title = payloadJson?.title || 'Nova mensagem urgente';
      return `${translate('notifications.bloodPriority') || 'Blood Priority'}: ${title}`;
    }

    default:
      // Fallback: retornar o tipo se não houver formatação específica
      return type;
  }
}

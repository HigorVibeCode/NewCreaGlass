/**
 * Edge Function: send-push-on-notification
 *
 * Invocada por Database Webhook quando uma nova linha é inserida em notifications.
 * Usa service role para ler device_tokens de todos os usuários alvo (evita o
 * bloqueio de RLS que impede push quando quem cria a notificação não é Master).
 *
 * As notificações push são traduzidas de acordo com o idioma preferido de cada
 * usuário (coluna preferred_language na tabela users).
 *
 * Configure no Supabase: Database → Webhooks → Create webhook
 * - Table: public.notifications
 * - Events: Insert
 * - Type: Supabase Edge Functions
 * - Function: send-push-on-notification
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ---------------------------------------------------------------------------
// Traduções de todos os tipos de notificação push
// ---------------------------------------------------------------------------
type Lang = "en" | "de" | "fr" | "it" | "pt" | "es";

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  pt: {
    "inventory.lowStock.title": "Estoque Baixo",
    "inventory.lowStock.body": "{itemName} está com estoque baixo ({stock} unidades)",
    "production.authorized.title": "Ordem Autorizada",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Autorizado",
    "production.tempered.title": "Pedido Temperado",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - Entrou na fase de temperamento",
    "production.dailySummary.title": "Resumo Diário - Produção",
    "production.dailySummary.body": "Bom dia, hoje temos {totalOrders} pedidos no painel de produção.",
    "workOrder.created.title": "Nova Ordem de Serviço",
    "workOrder.created.body": "Nova ordem de serviço criada",
    "workOrder.updated.title": "Ordem de Serviço Atualizada",
    "workOrder.updated.body": "Ordem de serviço atualizada: {clientName}",
    "training.assigned.title": "Novo Treinamento",
    "training.assigned.body": "Novo treinamento disponível: {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "Nova mensagem urgente",
    "event.created.title": "Novo Evento",
    "event.created.body": "Novo evento criado",
    "default.title": "Nova Notificação",
    "default.body": "Você recebeu uma nova notificação",
  },
  en: {
    "inventory.lowStock.title": "Low Stock",
    "inventory.lowStock.body": "{itemName} is low on stock ({stock} units)",
    "production.authorized.title": "Order Authorized",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Authorized",
    "production.tempered.title": "Order Tempered",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - Entered tempering phase",
    "production.dailySummary.title": "Daily Summary - Production",
    "production.dailySummary.body": "Good morning, today we have {totalOrders} orders on the production panel.",
    "workOrder.created.title": "New Work Order",
    "workOrder.created.body": "New work order created",
    "workOrder.updated.title": "Work Order Updated",
    "workOrder.updated.body": "Work order updated: {clientName}",
    "training.assigned.title": "New Training",
    "training.assigned.body": "New training available: {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "New urgent message",
    "event.created.title": "New Event",
    "event.created.body": "New event created",
    "default.title": "New Notification",
    "default.body": "You received a new notification",
  },
  de: {
    "inventory.lowStock.title": "Niedriger Bestand",
    "inventory.lowStock.body": "{itemName} hat niedrigen Bestand ({stock} Einheiten)",
    "production.authorized.title": "Auftrag Autorisiert",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Autorisiert",
    "production.tempered.title": "Auftrag Gehärtet",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - In die Härtungsphase eingetreten",
    "production.dailySummary.title": "Tägliche Zusammenfassung - Produktion",
    "production.dailySummary.body": "Guten Morgen, heute haben wir {totalOrders} Aufträge im Produktionspanel.",
    "workOrder.created.title": "Neuer Serviceauftrag",
    "workOrder.created.body": "Neuer Serviceauftrag erstellt",
    "workOrder.updated.title": "Serviceauftrag Aktualisiert",
    "workOrder.updated.body": "Serviceauftrag aktualisiert: {clientName}",
    "training.assigned.title": "Neues Training",
    "training.assigned.body": "Neues Training verfügbar: {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "Neue dringende Nachricht",
    "event.created.title": "Neues Ereignis",
    "event.created.body": "Neues Ereignis erstellt",
    "default.title": "Neue Benachrichtigung",
    "default.body": "Sie haben eine neue Benachrichtigung erhalten",
  },
  fr: {
    "inventory.lowStock.title": "Stock Faible",
    "inventory.lowStock.body": "{itemName} est en stock faible ({stock} unités)",
    "production.authorized.title": "Commande Autorisée",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Autorisé",
    "production.tempered.title": "Commande Trempée",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - Entré en phase de trempe",
    "production.dailySummary.title": "Résumé Quotidien - Production",
    "production.dailySummary.body": "Bonjour, aujourd'hui nous avons {totalOrders} commandes sur le panneau de production.",
    "workOrder.created.title": "Nouvelle Commande de Service",
    "workOrder.created.body": "Nouvelle commande de service créée",
    "workOrder.updated.title": "Commande de Service Mise à Jour",
    "workOrder.updated.body": "Commande de service mise à jour : {clientName}",
    "training.assigned.title": "Nouvelle Formation",
    "training.assigned.body": "Nouvelle formation disponible : {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "Nouveau message urgent",
    "event.created.title": "Nouvel Événement",
    "event.created.body": "Nouvel événement créé",
    "default.title": "Nouvelle Notification",
    "default.body": "Vous avez reçu une nouvelle notification",
  },
  it: {
    "inventory.lowStock.title": "Scorta Bassa",
    "inventory.lowStock.body": "{itemName} ha scorta bassa ({stock} unità)",
    "production.authorized.title": "Ordine Autorizzato",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Autorizzato",
    "production.tempered.title": "Ordine Temprato",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - Entrato nella fase di tempra",
    "production.dailySummary.title": "Riepilogo Giornaliero - Produzione",
    "production.dailySummary.body": "Buongiorno, oggi abbiamo {totalOrders} ordini nel pannello di produzione.",
    "workOrder.created.title": "Nuovo Ordine di Servizio",
    "workOrder.created.body": "Nuovo ordine di servizio creato",
    "workOrder.updated.title": "Ordine di Servizio Aggiornato",
    "workOrder.updated.body": "Ordine di servizio aggiornato: {clientName}",
    "training.assigned.title": "Nuovo Addestramento",
    "training.assigned.body": "Nuovo addestramento disponibile: {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "Nuovo messaggio urgente",
    "event.created.title": "Nuovo Evento",
    "event.created.body": "Nuovo evento creato",
    "default.title": "Nuova Notifica",
    "default.body": "Hai ricevuto una nuova notifica",
  },
  es: {
    "inventory.lowStock.title": "Stock Bajo",
    "inventory.lowStock.body": "{itemName} tiene stock bajo ({stock} unidades)",
    "production.authorized.title": "Pedido Autorizado",
    "production.authorized.body": "{clientName} | {orderType} | {orderNumber} - Autorizado",
    "production.tempered.title": "Pedido Templado",
    "production.tempered.body": "{clientName} | {orderType} | {orderNumber} - Entró en fase de templado",
    "production.dailySummary.title": "Resumen Diario - Producción",
    "production.dailySummary.body": "Buenos días, hoy tenemos {totalOrders} pedidos en el panel de producción.",
    "workOrder.created.title": "Nueva Orden de Servicio",
    "workOrder.created.body": "Nueva orden de servicio creada",
    "workOrder.updated.title": "Orden de Servicio Actualizada",
    "workOrder.updated.body": "Orden de servicio actualizada: {clientName}",
    "training.assigned.title": "Nuevo Entrenamiento",
    "training.assigned.body": "Nuevo entrenamiento disponible: {trainingTitle}",
    "bloodPriority.new.title": "Blood Priority",
    "bloodPriority.new.body": "Nuevo mensaje urgente",
    "event.created.title": "Nuevo Evento",
    "event.created.body": "Nuevo evento creado",
    "default.title": "Nueva Notificación",
    "default.body": "Has recibido una nueva notificación",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: {
    id: string;
    type: string;
    payload_json: Record<string, unknown> | string | null;
    target_user_id: string | null;
    created_at: string;
  };
  old_record: null;
}

function parsePayloadJson(
  payload_json: Record<string, unknown> | string | null
): Record<string, unknown> {
  if (payload_json == null) return {};
  if (typeof payload_json === "string") {
    try {
      return JSON.parse(payload_json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return payload_json;
}

/** Resolve um template de texto com placeholders {key} usando o payload */
function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

/** Gera título e corpo da notificação no idioma fornecido */
function generateTitleAndBody(
  type: string,
  payload: Record<string, unknown>,
  lang: Lang = "en"
): { title: string; body: string } {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Preparar variáveis com defaults seguros
  const vars: Record<string, unknown> = {
    itemName: payload.itemName || "Item",
    stock: payload.stock ?? 0,
    clientName: payload.clientName || (lang === "pt" ? "Cliente" : "Client"),
    orderType: payload.orderType || "",
    orderNumber: payload.orderNumber || "",
    totalOrders: payload.totalOrders ?? 0,
    trainingTitle: payload.trainingTitle || (lang === "pt" ? "Treinamento" : "Training"),
    ...payload,
  };

  const titleKey = `${type}.title`;
  const bodyKey = `${type}.body`;

  // Para bloodPriority.new, o body pode ser o título customizado da mensagem
  if (type === "bloodPriority.new" && payload.title) {
    return {
      title: t[titleKey] || TRANSLATIONS.en[titleKey] || "Blood Priority",
      body: String(payload.title),
    };
  }

  const title = t[titleKey] || TRANSLATIONS.en[titleKey] || t["default.title"];
  const body = t[bodyKey] || TRANSLATIONS.en[bodyKey] || t["default.body"];

  return {
    title: interpolate(title, vars),
    body: interpolate(body, vars),
  };
}

function shouldSendForType(
  notificationType: string,
  prefs: {
    push_enabled: boolean;
    inventory_enabled?: boolean;
    work_orders_enabled?: boolean;
    training_enabled?: boolean;
    blood_priority_enabled?: boolean;
    production_enabled?: boolean;
    events_enabled?: boolean;
  }
): boolean {
  if (!prefs.push_enabled) return false;
  if (notificationType.startsWith("inventory.") && prefs.inventory_enabled === false) return false;
  if (notificationType.startsWith("workOrder.") && prefs.work_orders_enabled === false) return false;
  if (notificationType.startsWith("training.") && prefs.training_enabled === false) return false;
  if (notificationType.startsWith("bloodPriority.") && prefs.blood_priority_enabled === false) return false;
  if (notificationType.startsWith("production.") && prefs.production_enabled === false) return false;
  if (notificationType.startsWith("event.") && prefs.events_enabled === false) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "INSERT" || payload.table !== "notifications" || !payload.record) {
      return new Response(JSON.stringify({ ok: true, skipped: "not an INSERT on notifications" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = payload.record;
    const notificationId = record.id;
    const notificationType = record.type;
    const payloadJson = parsePayloadJson(record.payload_json);
    const targetUserId = record.target_user_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Buscar usuários alvo com idioma preferido
    let targetUsers: Array<{ id: string; preferred_language: string | null }> = [];
    if (targetUserId) {
      const { data: user } = await supabase
        .from("users")
        .select("id, preferred_language")
        .eq("id", targetUserId)
        .single();
      if (user) targetUsers = [user];
    } else {
      const { data: users } = await supabase
        .from("users")
        .select("id, preferred_language")
        .eq("is_active", true);
      if (users) targetUsers = users;
    }

    if (targetUsers.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no target users" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const entityId =
      (payloadJson.itemId as string) ||
      (payloadJson.productionId as string) ||
      (payloadJson.workOrderId as string) ||
      (payloadJson.trainingId as string) ||
      (payloadJson.messageId as string) ||
      (payloadJson.eventId as string);

    let totalSent = 0;
    const errors: string[] = [];

    for (const targetUser of targetUsers) {
      const userId = targetUser.id;
      const userLang = (targetUser.preferred_language || "en") as Lang;

      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      const prefsDefault = {
        push_enabled: true,
        inventory_enabled: true,
        work_orders_enabled: true,
        training_enabled: true,
        blood_priority_enabled: true,
        production_enabled: true,
        events_enabled: true,
        ...prefs,
      };

      if (!shouldSendForType(notificationType, prefsDefault)) continue;

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("id, token, platform")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!tokens || tokens.length === 0) continue;

      // Gerar título e corpo no idioma do usuário
      const { title, body } = generateTitleAndBody(notificationType, payloadJson, userLang);

      const messages = tokens.map((t: { token: string; platform: string }) => {
        const msg: Record<string, unknown> = {
          to: t.token,
          sound: "default",
          title,
          body,
          priority: "high",
          badge: 1,
          data: {
            notificationId,
            type: notificationType,
            entityId,
            deepLink: "/notifications",
            ...payloadJson,
          },
        };
        if (t.platform === "android") (msg as Record<string, string>).channelId = "default";
        return msg;
      });

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(messages),
      });

      const result = await res.json();
      if (result.data && Array.isArray(result.data)) {
        const ok = result.data.filter((r: { status?: string }) => r?.status === "ok").length;
        totalSent += ok;
        result.data.forEach((r: { message?: string }, i: number) => {
          if (r?.status !== "ok" && r?.message) errors.push(`token ${i}: ${r.message}`);
        });
      } else {
        errors.push(`Expo API error: ${JSON.stringify(result)}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push-on-notification error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

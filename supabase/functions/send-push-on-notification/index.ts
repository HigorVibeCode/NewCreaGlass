/**
 * Edge Function: send-push-on-notification
 *
 * Invocada por Database Webhook quando uma nova linha é inserida em notifications.
 * Usa service role para ler device_tokens de todos os usuários alvo (evita o
 * bloqueio de RLS que impede push quando quem cria a notificação não é Master).
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

function generateTitleAndBody(
  type: string,
  payload: Record<string, unknown>
): { title: string; body: string } {
  switch (type) {
    case "inventory.lowStock":
      return {
        title: "Estoque Baixo",
        body: `${payload.itemName || "Item"} está com estoque baixo (${payload.stock ?? 0} unidades)`,
      };
    case "production.authorized": {
      const clientName = payload.clientName || "Cliente";
      const orderType = payload.orderType || "";
      const orderNumber = payload.orderNumber || "";
      return {
        title: "Ordem Autorizada",
        body: `${clientName} | ${orderType} | ${orderNumber} - Autorizado`,
      };
    }
    case "production.tempered": {
      const clientName = payload.clientName || "Cliente";
      const orderType = payload.orderType || "";
      const orderNumber = payload.orderNumber || "";
      return {
        title: "Pedido Temperado",
        body: `${clientName} | ${orderType} | ${orderNumber} - Entrou na fase de temperamento`,
      };
    }
    case "workOrder.created":
      return {
        title: "Nova Ordem de Serviço",
        body: `Nova ordem de serviço criada`,
      };
    case "workOrder.updated":
      return {
        title: "Ordem de Serviço Atualizada",
        body: `Ordem de serviço atualizada: ${payload.clientName || "cliente"}`,
      };
    case "training.assigned":
      return {
        title: "Novo Treinamento",
        body: `Novo treinamento disponível: ${payload.trainingTitle || "Treinamento"}`,
      };
    case "bloodPriority.new":
      return {
        title: "Blood Priority",
        body: (payload.title as string) || "Nova mensagem urgente",
      };
    case "event.created":
      return {
        title: "Novo Evento",
        body: "Novo evento criado",
      };
    default:
      return {
        title: "Nova Notificação",
        body: "Você recebeu uma nova notificação",
      };
  }
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

    let targetUserIds: string[] = [];
    if (targetUserId) {
      targetUserIds = [targetUserId];
    } else {
      const { data: users } = await supabase.from("users").select("id").eq("is_active", true);
      if (users) targetUserIds = users.map((u: { id: string }) => u.id);
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no target users" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { title, body } = generateTitleAndBody(notificationType, payloadJson);
    const entityId =
      (payloadJson.itemId as string) ||
      (payloadJson.productionId as string) ||
      (payloadJson.workOrderId as string) ||
      (payloadJson.trainingId as string) ||
      (payloadJson.messageId as string) ||
      (payloadJson.eventId as string);

    let totalSent = 0;
    const errors: string[] = [];

    for (const userId of targetUserIds) {
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

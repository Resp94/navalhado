import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import {
  createEvolutionGoProvider,
  type WhatsAppProviderFactory,
} from "./whatsapp_provider.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-db-trigger-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// Limpa e formata o número de telefone do cliente para o padrão brasileiro DDI 55
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
};
const getSupportedPhoneFromJids = (jids: string[]): string | null => {
  for (const jid of jids) {
    const match = jid.trim().match(/^([0-9]{10,13})(?::[0-9]{1,3})?@(s\.whatsapp\.net|c\.us)$/);
    if (!match) continue;

    const phone = formatPhoneNumber(match[1]);
    if (/^55[1-9][0-9]{9,10}$/.test(phone)) {
      return phone;
    }
  }

  return null;
};

// Formata data e hora no fuso horário do Brasil (dinâmico por tenant)
const formatDateTime = (dateStr: string, timeZone: string = "America/Sao_Paulo") => {
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString("pt-BR", { timeZone });
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date: formattedDate, time: formattedTime };
};

export const singleRelation = <T>(relation: T | T[] | null | undefined): T | null => {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
};

export interface HandlerDependencies {
  providerFactory?: WhatsAppProviderFactory;
}

export const createHandler = (dependencies: HandlerDependencies = {}) => async (req: Request): Promise<Response> => {
  // CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Carregar variáveis de ambiente
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
  const evolutionGlobalApiKey = Deno.env.get("EVOLUTION_GLOBAL_APIKEY") || "";
  const dbTriggerSecret = Deno.env.get("DB_TRIGGER_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const rawAppUrl = Deno.env.get("APP_URL") || "";
  const getCleanAppUrl = (url: string): string => {
    let clean = url.trim();
    if (clean.startsWith("APP_URL=")) {
      clean = clean.substring("APP_URL=".length).trim();
    }
    return clean.replace(/\/+$/, "");
  };
  const appUrl = getCleanAppUrl(rawAppUrl);
  const providerFactory = dependencies.providerFactory ?? ((config) =>
    createEvolutionGoProvider(config, globalThis.fetch));
  const provider = providerFactory({
    baseUrl: evolutionApiUrl,
    adminToken: evolutionGlobalApiKey,
  });
  const providerFailureResponse = (): Response => new Response(
    JSON.stringify({ error: "WhatsApp provider request failed" }),
    {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

  const validateTriggerSecret = (route: string): Response | null => {
    if (!dbTriggerSecret.trim()) {
      console.error(`[WhatsApp-Integration] ${route}: DB_TRIGGER_SECRET ausente ou vazio`);
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reqSecret = req.headers.get("x-db-trigger-secret");
    if (!reqSecret?.trim() || reqSecret !== dbTriggerSecret) {
      console.error(`[WhatsApp-Integration] ${route}: Segredo de trigger inválido`);
      return new Response(JSON.stringify({ error: "Unauthorized trigger secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return null;
  };

  const validateManageInstanceAuth = async (req: Request, instanceId?: string): Promise<Response | null> => {
    const reqSecret = req.headers.get("x-db-trigger-secret");
    if (dbTriggerSecret.trim() && reqSecret?.trim() === dbTriggerSecret) {
      return null;
    }

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        const { data: profile } = await supabase
          .from("users")
          .select("tenant_id, role")
          .eq("id", user.id)
          .single();

        if (profile && profile.role === "gerente") {
          if (!instanceId) return null;

          const { data: instanceRow } = await supabase
            .from("evolution_api_instances")
            .select("tenant_id")
            .eq("id", instanceId)
            .single();

          if (instanceRow && profile.tenant_id === instanceRow.tenant_id) {
            return null;
          }
        }
      }
    }

    console.error(`[WhatsApp-Integration] /manage-instance: Apenas gerentes do tenant possuem permissão`);
    return new Response(JSON.stringify({ error: "Apenas gerentes possuem permissão para gerenciar a integração de WhatsApp." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  const revertInstanceToDisconnected = async (instanceId: string) => {
    const { error: updateErr } = await supabase
      .from("evolution_api_instances")
      .update({
        status: "disconnected",
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instanceId);

    if (updateErr) {
      console.error(`[WhatsApp-Integration] Erro ao reverter status no banco: ${updateErr.message}`);
    }
  };

  if (!appUrl && (path.endsWith("/webhook") || path.endsWith("/send-notification") || path.endsWith("/process-reminders"))) {
    console.error("[WhatsApp-Integration] Erro: A variável de ambiente APP_URL não está configurada.");
    return new Response(JSON.stringify({ error: "Configuração inválida: APP_URL ausente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log(`[WhatsApp-Integration] Recebendo requisição: ${req.method} ${path}`);

  try {
    // -------------------------------------------------------------------------
    // ROTA: /manage-instance
    // -------------------------------------------------------------------------
    if (path.endsWith("/manage-instance")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { action, instance_id, instance_name } = body;

      if (!action || !instance_id || !instance_name) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authError = await validateManageInstanceAuth(req, instance_id);
      if (authError) return authError;

      console.log(`[WhatsApp-Integration] /manage-instance: Ação '${action}' para instância '${instance_name}'`);

      // Buscar API Key da instância no banco de dados para usar nas chamadas
      const { data: dbInstance, error: fetchErr } = await supabase
        .from("evolution_api_instances")
        .select("api_key")
        .eq("id", instance_id)
        .single();

      if (fetchErr || !dbInstance) {
        console.error(`[WhatsApp-Integration] Instância ${instance_id} não encontrada no banco`);
        return new Response(JSON.stringify({ error: "Instance not found in database" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceApiKey = dbInstance.api_key;

      if (action === "create") {
        try {
          await provider.createInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
          });
        } catch {
          console.error("[WhatsApp-Integration] Falha do provedor ao criar instância");
          return providerFailureResponse();
        }

        console.log("[WhatsApp-Integration] Instância criada com sucesso pelo provedor");
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      else if (action === "connect") {
        // Garantir que a instância exista no provedor com o token correto antes de solicitar o QR Code.
        try {
          await provider.createInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
          });
          console.log(`[WhatsApp-Integration] [Connect-Preflight] Instância garantida no provedor`);
        } catch (createErr) {
          console.warn(`[WhatsApp-Integration] [Connect-Preflight] Falha silenciosa no preflight de criação:`, createErr);
        }

        // Iniciar o pareamento e configurar o webhook por meio do contrato neutro.
        try {
          const targetWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`;
          await provider.connectInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
            webhookUrl: targetWebhookUrl,
            events: ["connection", "messages"],
          });
          console.log(`[WhatsApp-Integration] [Webhook-Preflight] Pareamento iniciado e webhook configurado pelo provedor`);
        } catch (webhookErr) {
          console.error(`[WhatsApp-Integration] [Webhook-Preflight] Falha ao iniciar pareamento no provedor:`, webhookErr);
          await revertInstanceToDisconnected(instance_id);
          return providerFailureResponse();
        }

        console.log(`[WhatsApp-Integration] Pareamento iniciado para ${instance_name}; aguardando evento QRCODE no webhook`);
        return new Response(JSON.stringify({ success: true, status: "pairing" }), {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      else if (action === "disconnect") {
        // Caso a instância já esteja desconectada no provedor, limpamos o status no banco mesmo assim.
        try {
          await provider.disconnectInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
          });
        } catch (disconnectError) {
          console.warn("[WhatsApp-Integration] Provedor recusou a desconexão. Prosseguindo com limpeza no banco.", disconnectError);
        }

        // Atualizar status no banco de dados para disconnected e limpar QR Code
        const { error: updateErr } = await supabase
          .from("evolution_api_instances")
          .update({
            status: "disconnected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance_id);

        if (updateErr) {
          console.error(`[WhatsApp-Integration] Erro ao limpar status no banco: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: "Failed to clean status in DB" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[WhatsApp-Integration] Instância ${instance_name} desconectada com sucesso`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (action === "debug-webhook") {
        const targetWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`;
        
        try {
          const webhookResult = await provider.configureWebhook({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
            webhookUrl: targetWebhookUrl,
            events: ["connection", "messages"],
          });
          
          return new Response(JSON.stringify({ 
            success: true, 
            debug: {
              status: webhookResult.statusCode,
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return providerFailureResponse();
        }
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // ROTA: /webhook (VPS -> Edge Function)
    // -------------------------------------------------------------------------
    if (path.endsWith("/webhook")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const event = body.event;
      const instanceName = body.instance || body.instanceName;
      const instanceToken = body.instanceToken;
      const vpsStatus = body.data?.status || body.data?.state;
      const eventClean = String(event || "").toLowerCase().replace(/_/g, ".");

      console.log(`[WhatsApp-Integration] Webhook recebido: Evento '${event}' (normalizado: '${eventClean}') da instância '${instanceName}' (status VPS: '${vpsStatus}')`);

      const cleanInstanceToken = typeof instanceToken === "string" ? instanceToken.trim() : "";
      if (!cleanInstanceToken) {
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authenticatedInstance, error: instanceAuthError } = await supabase
        .from("evolution_api_instances")
        .select("tenant_id, instance_name, api_key, status")
        .eq("api_key", cleanInstanceToken)
        .single();

      if (instanceAuthError || !authenticatedInstance) {
        console.warn("[WhatsApp-Integration] Webhook rejeitado: token de instância inválido");
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isConnectionUpdate = ["connection.update", "connected", "pairsuccess"].includes(eventClean);
      const isQrCodeUpdate = ["qrcode", "qrcode.updated", "qr.code"].includes(eventClean);

      const isEvolutionGoMessage = eventClean === "message";

      if (isQrCodeUpdate) {
        const qrCode =
          body.data?.qrcode ||
          body.data?.Qrcode ||
          body.qrcode ||
          body.Qrcode;

        if (typeof qrCode !== "string" || !qrCode.trim()) {
          return new Response(JSON.stringify({ error: "QR Code missing from webhook payload" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateErr } = await supabase
          .from("evolution_api_instances")
          .update({
            status: "pairing",
            qr_code: qrCode,
            updated_at: new Date().toISOString(),
          })
          .eq("api_key", cleanInstanceToken);

        if (updateErr) {
          console.error(`[WhatsApp-Integration] Erro ao persistir QR Code via webhook: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: "Failed to persist QR Code" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isEvolutionGoMessage) {
        const messageInfo = body.data?.Info || body.data?.info || {};
        const isFromMe = messageInfo.IsFromMe ?? messageInfo.isFromMe ?? false;
        const senderJid = String(messageInfo.Sender ?? messageInfo.sender ?? "");
        const chatJid = String(messageInfo.Chat ?? messageInfo.chat ?? "");
        const candidateJids = [senderJid, chatJid].filter(Boolean);

        if (
          isFromMe ||
          candidateJids.some((jid) => jid.endsWith("@g.us") || jid.includes("@broadcast"))
        ) {
          return new Response(JSON.stringify({ ignored: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const senderPhone = getSupportedPhoneFromJids(candidateJids);
        if (!senderPhone) {
          return new Response(JSON.stringify({ ignored: true, reason: "Sender phone missing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (authenticatedInstance.status !== "connected") {
          console.warn(`[WhatsApp-Integration] Mensagem ignorada: instância não encontrada ou desconectada`);
          return new Response(JSON.stringify({ ignored: true, reason: "Instance unavailable" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const pushName = String(messageInfo.PushName ?? messageInfo.pushName ?? "").trim() || null;
        const { data: customerRows, error: customerError } = await supabase.rpc(
          "find_or_create_whatsapp_customer",
          {
            p_tenant_id: authenticatedInstance.tenant_id,
            p_phone: senderPhone,
            p_push_name: pushName,
          },
        );
        const customer = customerRows?.[0];
        if (customerError || !customer?.token_acesso) {
          console.error(`[WhatsApp-Integration] Erro ao criar/reutilizar cliente da mensagem: ${customerError?.message || "empty response"}`);
          return new Response(JSON.stringify({ error: "Failed to find or create customer" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Buscar nome do tenant
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", authenticatedInstance.tenant_id)
          .single();
        const barbeariaNome = tenantData?.name || "nossa barbearia";

        // Buscar nome do cliente
        const { data: customerRow } = await supabase
          .from("customers")
          .select("name")
          .eq("id", customer.customer_id)
          .single();
        const clientName = customerRow?.name || pushName || "Cliente";

        const messageText = `Olá, ${clientName}! Para escolher seu serviço e agendar um horário na *${barbeariaNome}*, acesse: ${appUrl}/cliente/${customer.token_acesso}/agendar`;
        try {
          await provider.sendText({
            instanceName: authenticatedInstance.instance_name || instanceName || "",
            instanceToken: authenticatedInstance.api_key,
            number: senderPhone,
            text: messageText,
          });
        } catch (sendError) {
          console.error("[WhatsApp-Integration] Falha do provedor ao responder mensagem recebida", sendError);
          return providerFailureResponse();
        }

        return new Response(JSON.stringify({ success: true, created: customer.created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isConnectionUpdate) {
        // Mapear status da VPS (Evolution API Go) para o nosso enum local
        let localStatus: "connected" | "disconnected" | "pairing" = "disconnected";
        const statusClean = String(vpsStatus || "").toLowerCase();

        if (eventClean === "connected" || eventClean === "pairsuccess" || statusClean === "open" || statusClean === "connected") {
          localStatus = "connected";
        } else if (statusClean === "connecting" || statusClean === "pairing") {
          localStatus = "pairing";
        } else {
          localStatus = "disconnected";
        }

        console.log(`[WhatsApp-Integration] Mapeando status VPS '${vpsStatus}' -> local '${localStatus}'`);

        // Atualizar no banco de dados
        const updateQuery = supabase
          .from("evolution_api_instances")
          .update({
            status: localStatus,
            // Limpa o QR Code caso a conexão esteja ativa
            qr_code: localStatus === "connected" ? null : undefined,
            updated_at: new Date().toISOString(),
          });

        const { error: updateErr } = await updateQuery.eq("api_key", cleanInstanceToken);

        if (updateErr) {
          console.error(`[WhatsApp-Integration] Erro ao atualizar status via webhook: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: "Failed to update connection status" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Responder sucesso para eventos ignorados
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // ROTA: /send-notification (Postgres Triggers)
    // -------------------------------------------------------------------------
    if (path.endsWith("/send-notification")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const triggerAuthError = validateTriggerSecret("/send-notification");
      if (triggerAuthError) return triggerAuthError;

      const body = await req.json();
      const { event, appointment_id, tenant_id } = body;

      if (!event || !appointment_id || !tenant_id) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[WhatsApp-Integration] /send-notification: Evento '${event}' para agendamento '${appointment_id}'`);

      // 1. Obter a configuração da Evolution API do tenant
      const { data: config, error: configErr } = await supabase
        .from("evolution_api_instances")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (configErr || !config) {
        console.warn(`[WhatsApp-Integration] Nenhuma integração de WhatsApp configurada para o tenant ${tenant_id}`);
        return new Response(JSON.stringify({ status: "skipped", reason: "Integration not configured for tenant" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se a integração está conectada
      if (config.status !== "connected") {
        console.warn(`[WhatsApp-Integration] WhatsApp do tenant ${tenant_id} não está conectado (Status: ${config.status})`);
        return new Response(JSON.stringify({ status: "skipped", reason: "WhatsApp disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar regras de envio baseadas no evento
      if (event === "appointment_created" && !config.send_confirmation) {
        console.log(`[WhatsApp-Integration] Envio de confirmação desativado para o tenant ${tenant_id}`);
        return new Response(JSON.stringify({ status: "skipped", reason: "Confirmations disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event === "appointment_cancelled" && !config.send_cancellation) {
        console.log(`[WhatsApp-Integration] Envio de cancelamento desativado para o tenant ${tenant_id}`);
        return new Response(JSON.stringify({ status: "skipped", reason: "Cancellations disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Buscar detalhes completos do agendamento
      const { data: appointment, error: appErr } = await supabase
        .from("appointments")
        .select(`
          id,
          start_time,
          customers ( name, phone, token_acesso ),
          professionals ( name ),
          services ( name ),
          tenants ( name, timezone )
        `)
        .eq("id", appointment_id)
        .single();

      if (appErr || !appointment) {
        console.error(`[WhatsApp-Integration] Erro ao carregar agendamento ${appointment_id}: ${appErr?.message}`);
        return new Response(JSON.stringify({ error: "Appointment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = singleRelation(appointment.customers);
      const professional = singleRelation(appointment.professionals);
      const service = singleRelation(appointment.services);
      const tenant = singleRelation(appointment.tenants);

      if (!customer?.phone || !professional || !service || !tenant) {
        console.warn(`[WhatsApp-Integration] Dados relacionais incompletos no agendamento ${appointment_id}`);
        return new Response(JSON.stringify({ status: "skipped", reason: "Appointment details are incomplete" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientPhone = formatPhoneNumber(customer.phone);
      const { date, time } = formatDateTime(appointment.start_time, tenant.timezone || "America/Sao_Paulo");
      const link = `${appUrl}/cliente/${customer.token_acesso}`;

      let messageText = "";

      if (event === "appointment_created") {
        messageText = `Olá, ${customer.name}! Seu agendamento na *${tenant.name}* foi confirmado!\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: ${link}\n\nObrigado!`;
      } else if (event === "appointment_rescheduled" || event === "appointment_updated") {
        messageText = `Olá, ${customer.name}! Seu reagendamento na *${tenant.name}* foi confirmado!\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: ${link}\n\nObrigado!`;
      } else if (event === "appointment_cancelled") {
        messageText = `Olá, ${customer.name}! Seu agendamento na *${tenant.name}* foi cancelado.\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nSe precisar, você pode agendar um novo horário acessando: ${appUrl}/cliente/${customer.token_acesso}/agendar\n\nAgradecemos a compreensão!`;
      }

      // 3. Enviar mensagem pelo provedor configurado
      try {
        await provider.sendText({
          instanceName: config.instance_name,
          instanceToken: config.api_key,
          number: clientPhone,
          text: messageText,
        });
      } catch (sendError) {
        console.error("[WhatsApp-Integration] Falha do provedor ao disparar notificação", sendError);
        return providerFailureResponse();
      }

      console.log(`[WhatsApp-Integration] Mensagem disparada com sucesso para ${clientPhone}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // ROTA: /process-reminders (pg_cron)
    // -------------------------------------------------------------------------
    if (path.endsWith("/process-reminders")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const triggerAuthError = validateTriggerSecret("/process-reminders");
      if (triggerAuthError) return triggerAuthError;

      console.log("[WhatsApp-Integration] /process-reminders: Iniciando processamento de lembretes...");

      // 1. Buscar todas as instâncias conectadas e com envio de lembretes ativo
      const { data: activeInstances, error: instErr } = await supabase
        .from("evolution_api_instances")
        .select("*")
        .eq("status", "connected")
        .eq("send_reminders", true);

      if (instErr) {
        console.error(`[WhatsApp-Integration] Erro ao buscar instâncias ativas: ${instErr.message}`);
        return new Response(JSON.stringify({ error: "Failed to query active instances" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!activeInstances || activeInstances.length === 0) {
        console.log("[WhatsApp-Integration] Nenhuma barbearia com integração conectada e lembretes ativos no momento");
        return new Response(JSON.stringify({ status: "success", processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalSent = 0;

      // 2. Processar lembretes para cada tenant/instância conectada
      for (const instance of activeInstances) {
        const hours = instance.reminder_hours;
        console.log(`[WhatsApp-Integration] Processando lembretes de ${hours}h para tenant ${instance.tenant_id} (${instance.instance_name})`);

        // Obter data atual e limite no fuso horário do banco (UTC)
        const now = new Date();
        const futureLimit = new Date(now.getTime() + hours * 60 * 60 * 1000);

        // Buscar agendamentos pendentes de lembrete dentro da janela de tempo do tenant
        const { data: pendingAppointments, error: appErr } = await supabase
          .from("appointments")
          .select(`
            id,
            start_time,
            customers ( name, phone, token_acesso ),
            professionals ( name ),
            services ( name ),
            tenants ( name, timezone )
          `)
          .eq("tenant_id", instance.tenant_id)
          .eq("status", "confirmed")
          .eq("reminder_sent", false)
          .gt("start_time", now.toISOString())
          .lte("start_time", futureLimit.toISOString());

        if (appErr) {
          console.error(`[WhatsApp-Integration] Erro ao buscar agendamentos do tenant ${instance.tenant_id}: ${appErr.message}`);
          continue;
        }

        console.log(`[WhatsApp-Integration] Encontrado(s) ${pendingAppointments?.length || 0} agendamento(s) pendente(s) de lembrete`);

        if (pendingAppointments && pendingAppointments.length > 0) {
          for (const app of pendingAppointments) {
            const customer = singleRelation(app.customers);
            const professional = singleRelation(app.professionals);
            const service = singleRelation(app.services);
            const tenant = singleRelation(app.tenants);

            if (!customer?.phone || !professional || !service || !tenant) continue;

            const clientPhone = formatPhoneNumber(customer.phone);
            const { date, time } = formatDateTime(app.start_time, tenant.timezone || "America/Sao_Paulo");
            const link = `${appUrl}/cliente/${customer.token_acesso}`;

            const messageText = `Olá, ${customer.name}! Passando para lembrar do seu agendamento na *${tenant.name}* nas próximas horas.\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nPara confirmar, cancelar ou ver detalhes do agendamento, acesse: ${link}\n\nEsperamos você!`;

            // Enviar pelo provedor configurado
            try {
              await provider.sendText({
                instanceName: instance.instance_name,
                instanceToken: instance.api_key,
                number: clientPhone,
                text: messageText,
              });

              console.log(`[WhatsApp-Integration] Lembrete enviado com sucesso para ${clientPhone}`);
              // Atualizar no banco
              const { error: markErr } = await supabase
                .from("appointments")
                .update({ reminder_sent: true })
                .eq("id", app.id);

              if (markErr) {
                console.error(`[WhatsApp-Integration] Erro ao marcar reminder_sent no agendamento ${app.id}: ${markErr.message}`);
              } else {
                totalSent++;
              }
            } catch (sendError) {
              console.error("[WhatsApp-Integration] Falha do provedor no envio do lembrete", sendError);
            }
          }
        }
      }

      console.log(`[WhatsApp-Integration] Finalizado processamento de lembretes. Total enviados: ${totalSent}`);
      return new Response(JSON.stringify({ status: "success", processed: totalSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // ROTA: /send-test (Frontend Manual Trigger)
    // -------------------------------------------------------------------------
    if (path.endsWith("/send-test")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validar autenticação do usuário
      const authHeader = req.headers.get("authorization") || "";
      const bearerMatch = authHeader.match(/^Bearer ([^\s]+)$/i);
      if (!bearerMatch) {
        return new Response(JSON.stringify({ error: "Invalid Authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = bearerMatch[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { tenant_id, number, text } = body as Record<string, unknown>;

      if (
        typeof tenant_id !== "string" || !tenant_id.trim() || tenant_id.length > 128 ||
        typeof number !== "string" || !number.trim() ||
        typeof text !== "string" || !text.trim() || text.length > 4096
      ) {
        return new Response(JSON.stringify({ error: "Invalid request parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanTenantId = tenant_id.trim();
      const clientPhone = formatPhoneNumber(number);
      if (!/^55[1-9][0-9]{9,10}$/.test(clientPhone)) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se o usuário pertence a este tenant_id
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

      const hasAllowedRole = userData?.role === "gerente" || userData?.role === "proprietario";
      const hasTenantAccess = userData?.role === "proprietario" || userData?.tenant_id === cleanTenantId;
      if (userError || !userData || !hasAllowedRole || !hasTenantAccess) {
        return new Response(JSON.stringify({ error: "Forbidden: You do not have access to this tenant" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar a instância ativa do WhatsApp para esse tenant
      const { data: instance, error: instanceError } = await supabase
        .from("evolution_api_instances")
        .select("instance_name, api_key, status")
        .eq("tenant_id", cleanTenantId)
        .single();

      if (instanceError || !instance) {
        return new Response(JSON.stringify({ error: "WhatsApp instance not found for this tenant" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (instance.status !== "connected") {
        return new Response(JSON.stringify({ error: "WhatsApp instance is not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        await provider.sendText({
          instanceName: instance.instance_name,
          instanceToken: instance.api_key,
          number: clientPhone,
          text: text,
        });
      } catch (sendError) {
        console.error("[WhatsApp-Integration] Erro ao enviar mensagem de teste pelo provedor", sendError);
        return providerFailureResponse();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rota padrão - 404
    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    console.error("[WhatsApp-Integration] Erro crítico não tratado");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

export const handler = createHandler();

if (import.meta.main) {
  serve(handler);
}

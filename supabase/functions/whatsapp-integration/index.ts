import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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

// Formata data e hora no fuso horário do Brasil
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date: formattedDate, time: formattedTime };
};

export const handler = async (req: Request): Promise<Response> => {
  // CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Carregar variáveis de ambiente
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
  const getCleanVpsUrl = (endpoint: string): string => {
    const base = evolutionApiUrl.replace(/\/+$/, "");
    const cleanPath = endpoint.replace(/^\/+/, "");
    return `${base}/${cleanPath}`;
  };
  const evolutionGlobalApiKey = Deno.env.get("EVOLUTION_GLOBAL_APIKEY") || "";
  const dbTriggerSecret = "db_trigger_secret_5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const appUrl = Deno.env.get("APP_URL") || "https://navalhado.com";

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

      // Validar segredo do trigger do banco de dados
      const reqSecret = req.headers.get("x-db-trigger-secret");
      if (reqSecret !== dbTriggerSecret) {
        console.error("[WhatsApp-Integration] /manage-instance: Segredo de trigger inválido");
        return new Response(JSON.stringify({ error: "Unauthorized trigger secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { action, instance_id, instance_name, tenant_id } = body;

      if (!action || !instance_id || !instance_name) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
        // Chamar o VPS Evolution Go para criar a instância
        const vpsUrl = getCleanVpsUrl("instance/create");
        console.log(`[WhatsApp-Integration] Chamando VPS para criar instância: ${vpsUrl}`);
        
        const response = await fetch(vpsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionGlobalApiKey,
          },
          body: JSON.stringify({
            name: instance_name,
            token: instanceApiKey,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[WhatsApp-Integration] Erro ao criar instância na VPS: ${errText}`);
          return new Response(JSON.stringify({ error: `VPS failed to create instance: ${errText}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resData = await response.json();
        console.log(`[WhatsApp-Integration] Instância criada com sucesso na VPS`, resData);
        return new Response(JSON.stringify({ success: true, data: resData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      else if (action === "connect") {
        // Garantir que a instância exista na VPS com o token correto antes de solicitar o QR Code
        try {
          const createVpsUrl = getCleanVpsUrl("instance/create");
          console.log(`[WhatsApp-Integration] [Connect-Preflight] Garantindo existência da instância: ${createVpsUrl}`);
          const preflightRes = await fetch(createVpsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evolutionGlobalApiKey,
            },
            body: JSON.stringify({
              name: instance_name,
              token: instanceApiKey,
            }),
          });
          const preflightText = await preflightRes.text();
          console.log(`[WhatsApp-Integration] [Connect-Preflight] Resposta do preflight de criação: ${preflightText}`);
        } catch (createErr) {
          console.warn(`[WhatsApp-Integration] [Connect-Preflight] Falha silenciosa no preflight de criação:`, createErr);
        }

        // Configurar o webhook da instância na VPS de forma dinâmica usando instance/connect
        try {
          const connectVpsUrl = getCleanVpsUrl("instance/connect");
          const targetWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`;
          console.log(`[WhatsApp-Integration] [Webhook-Preflight] Conectando instância na VPS para setar webhook: ${connectVpsUrl} -> ${targetWebhookUrl}`);
          const connectRes = await fetch(connectVpsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": instanceApiKey,
            },
            body: JSON.stringify({
              immediate: true,
              webhookUrl: targetWebhookUrl,
              subscribe: ["CONNECTION", "MESSAGE"]
            }),
          });
          const connectText = await connectRes.text();
          console.log(`[WhatsApp-Integration] [Webhook-Preflight] Resposta do connect da instância: ${connectText}`);
        } catch (webhookErr) {
          console.warn(`[WhatsApp-Integration] [Webhook-Preflight] Falha silenciosa ao chamar instance/connect:`, webhookErr);
        }

        // Chamar o VPS Evolution Go para gerar o QR Code
        const vpsUrl = getCleanVpsUrl("instance/qr");
        console.log(`[WhatsApp-Integration] Chamando VPS para obter QR Code: ${vpsUrl}`);

        const response = await fetch(vpsUrl, {
          method: "GET",
          headers: {
            "apikey": instanceApiKey,
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[WhatsApp-Integration] Erro ao obter QR Code da VPS: ${errText}`);
          
          // Tratar o caso de a instância já estar conectada
          const errClean = errText.toLowerCase();
          if (errClean.includes("already") || errClean.includes("connected") || errClean.includes("open")) {
            console.log(`[WhatsApp-Integration] VPS reportou que a instância já está conectada. Sincronizando status local.`);
            const { error: updateErr } = await supabase
              .from("evolution_api_instances")
              .update({
                status: "connected",
                qr_code: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", instance_id);
              
            if (updateErr) {
              console.error(`[WhatsApp-Integration] Erro ao atualizar status conectado no banco: ${updateErr.message}`);
            }
            return new Response(JSON.stringify({ success: true, status: "connected" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ 
            error: `VPS failed to get QR Code: ${errText}`, 
            debug: { vpsUrl, evolutionApiUrl, instanceApiKey, instance_name } 
          }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resData = await response.json();
        // Conforme ADR 001 e implementation_plan, chaves retornadas da VPS em Go são Qrcode e Code dentro de data
        const qrcode = resData?.data?.Qrcode || resData?.data?.qrcode;
        const pairingCode = resData?.data?.Code || resData?.data?.code;

        if (!qrcode) {
          console.error("[WhatsApp-Integration] QR Code não retornado pela VPS", resData);
          return new Response(JSON.stringify({ error: "QR Code not returned by VPS" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Salvar o QR Code obtido na tabela de instâncias
        const { error: updateErr } = await supabase
          .from("evolution_api_instances")
          .update({
            qr_code: qrcode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance_id);

        if (updateErr) {
          console.error(`[WhatsApp-Integration] Erro ao atualizar QR Code no banco: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: "Failed to update QR Code in DB" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[WhatsApp-Integration] QR Code atualizado no banco para a instância ${instance_name}`);
        return new Response(JSON.stringify({ success: true, qrcode, code: pairingCode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      else if (action === "disconnect") {
        // Chamar o VPS Evolution Go para desconectar a instância
        const vpsUrl = getCleanVpsUrl("instance/disconnect");
        console.log(`[WhatsApp-Integration] Chamando VPS para desconectar: ${vpsUrl}`);

        const response = await fetch(vpsUrl, {
          method: "POST",
          headers: {
            "apikey": instanceApiKey,
          },
        });

        // Caso a instância já esteja desconectada na VPS (retornando erro), limpamos o status no banco mesmo assim
        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[WhatsApp-Integration] VPS retornou erro na desconexão: ${errText}. Prosseguindo com limpeza no banco.`);
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
        const connectVpsUrl = getCleanVpsUrl("instance/connect");
        const targetWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`;
        
        try {
          const connectRes = await fetch(connectVpsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": instanceApiKey,
            },
            body: JSON.stringify({
              immediate: true,
              webhookUrl: targetWebhookUrl
            }),
          });
          const status = connectRes.status;
          const headers = Object.fromEntries(connectRes.headers.entries());
          const text = await connectRes.text();
          
          return new Response(JSON.stringify({ 
            success: true, 
            debug: {
              connectVpsUrl,
              targetWebhookUrl,
              status,
              headers,
              body: text
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: err?.message || err 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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

      const isLegacyConnectionUpdate = eventClean === "connection.update" && instanceName;
      const isEvolutionGoConnected =
        (eventClean === "connected" || eventClean === "pairsuccess") && instanceToken;

      const isEvolutionGoMessage = eventClean === "message" && instanceToken;

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

        const { data: instance, error: instanceErr } = await supabase
          .from("evolution_api_instances")
          .select("tenant_id, api_key, status")
          .eq("api_key", instanceToken)
          .single();

        if (instanceErr || !instance || instance.status !== "connected") {
          console.warn(`[WhatsApp-Integration] Mensagem ignorada: instância não encontrada ou desconectada`);
          return new Response(JSON.stringify({ ignored: true, reason: "Instance unavailable" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const pushName = String(messageInfo.PushName ?? messageInfo.pushName ?? "").trim() || null;
        const { data: customerRows, error: customerError } = await supabase.rpc(
          "find_or_create_whatsapp_customer",
          {
            p_tenant_id: instance.tenant_id,
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

        const messageText = `Para agendar, acesse: ${appUrl}/cliente/${customer.token_acesso}/agendar`;
        const sendResponse = await fetch(getCleanVpsUrl("send/text"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": instance.api_key,
          },
          body: JSON.stringify({
            number: senderPhone,
            text: messageText,
          }),
        });

        if (!sendResponse.ok) {
          const errText = await sendResponse.text();
          console.error(`[WhatsApp-Integration] Falha ao responder mensagem recebida: ${errText}`);
          return new Response(JSON.stringify({ error: `VPS failed to send booking link: ${errText}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, created: customer.created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ((isLegacyConnectionUpdate || isEvolutionGoConnected) && vpsStatus) {
        // Mapear status da VPS (Evolution API Go) para o nosso enum local
        let localStatus: "connected" | "disconnected" | "pairing" = "disconnected";
        const statusClean = String(vpsStatus).toLowerCase();

        if (statusClean === "open" || statusClean === "connected") {
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

        const { error: updateErr } = instanceToken
          ? await updateQuery.eq("api_key", instanceToken)
          : await updateQuery.eq("instance_name", instanceName);

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

      // Validar segredo de trigger
      const reqSecret = req.headers.get("x-db-trigger-secret");
      if (reqSecret !== dbTriggerSecret) {
        console.error("[WhatsApp-Integration] /send-notification: Segredo de trigger inválido");
        return new Response(JSON.stringify({ error: "Unauthorized trigger secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          tenants ( name )
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

      const customer = appointment.customers;
      const professional = appointment.professionals;
      const service = appointment.services;
      const tenant = appointment.tenants;

      if (!customer || !customer.phone) {
        console.warn(`[WhatsApp-Integration] Cliente ou telefone do cliente ausente no agendamento ${appointment_id}`);
        return new Response(JSON.stringify({ status: "skipped", reason: "Customer phone is missing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clientPhone = formatPhoneNumber(customer.phone);
      const { date, time } = formatDateTime(appointment.start_time);
      const link = `${appUrl}/cliente/${customer.token_acesso}`;

      let messageText = "";

      if (event === "appointment_created") {
        messageText = `Olá, ${customer.name}! Seu agendamento na *${tenant.name}* foi confirmado!\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: ${link}\n\nObrigado!`;
      } else if (event === "appointment_cancelled") {
        messageText = `Olá, ${customer.name}! Seu agendamento na *${tenant.name}* para o dia *${date} às ${time}* foi cancelado.\n\n✂️ Serviço: *${service.name}*\n\nSe desejar realizar um novo agendamento, acesse: ${appUrl}/cliente/${customer.token_acesso}/agendar\n\nQualquer dúvida, estamos à disposição!`;
      }

      // 3. Enviar mensagem via VPS
      const vpsUrl = getCleanVpsUrl("send/text");
      console.log(`[WhatsApp-Integration] Enviando notificação para ${clientPhone} via VPS: ${vpsUrl}`);

      const response = await fetch(vpsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.api_key,
        },
        body: JSON.stringify({
          number: clientPhone,
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[WhatsApp-Integration] Falha no disparo da mensagem VPS: ${errText}`);
        return new Response(JSON.stringify({ error: `VPS failed to send message: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

      // Validar segredo de trigger
      const reqSecret = req.headers.get("x-db-trigger-secret");
      if (reqSecret !== dbTriggerSecret) {
        console.error("[WhatsApp-Integration] /process-reminders: Segredo de trigger inválido");
        return new Response(JSON.stringify({ error: "Unauthorized trigger secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
            tenants ( name )
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
            const customer = app.customers;
            const professional = app.professionals;
            const service = app.services;
            const tenant = app.tenants;

            if (!customer || !customer.phone) continue;

            const clientPhone = formatPhoneNumber(customer.phone);
            const { date, time } = formatDateTime(app.start_time);
            const link = `${appUrl}/cliente/${customer.token_acesso}`;

            const messageText = `Olá, ${customer.name}! Passando para lembrar do seu agendamento na *${tenant.name}* nas próximas horas.\n\n📅 Data: *${date} às ${time}*\n✂️ Serviço: *${service.name}*\n👤 Profissional: *${professional.name}*\n\nPara confirmar, cancelar ou ver detalhes do agendamento, acesse: ${link}\n\nEsperamos você!`;

            // Enviar via VPS
            const vpsUrl = getCleanVpsUrl("send/text");
            try {
              const response = await fetch(vpsUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": instance.api_key,
                },
                body: JSON.stringify({
                  number: clientPhone,
                  text: messageText,
                }),
              });

              if (response.ok) {
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
              } else {
                const errText = await response.text();
                console.error(`[WhatsApp-Integration] Falha ao enviar lembrete para ${clientPhone} via VPS: ${errText}`);
              }
            } catch (fetchErr) {
              console.error(`[WhatsApp-Integration] Falha de comunicação com a VPS no envio do lembrete:`, fetchErr);
            }
          }
        }
      }

      console.log(`[WhatsApp-Integration] Finalizado processamento de lembretes. Total enviados: ${totalSent}`);
      return new Response(JSON.stringify({ status: "success", processed: totalSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rota padrão - 404
    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[WhatsApp-Integration] Erro crítico não tratado: ${error?.message || error}`);
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve(handler);
}

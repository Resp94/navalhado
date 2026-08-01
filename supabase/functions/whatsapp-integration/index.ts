import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import {
  createUazapiProvider,
  WhatsAppProviderError,
  type ProviderSendTextInput,
  type ProviderStatus,
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
    const value = jid.trim();
    const match = value.match(/^([0-9]{10,13})(?::[0-9]{1,3})?@(s\.whatsapp\.net|c\.us)$/);
    const plainPhone = value.match(/^[0-9]{10,13}$/);
    if (!match && !plainPhone) continue;

    const phone = formatPhoneNumber(match?.[1] ?? plainPhone?.[0] ?? "");
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

const PAIRING_GRACE_PERIOD_MS = 150_000;

const isRecentPairing = (status: unknown, updatedAt: unknown): boolean => {
  if (status !== "connecting" || typeof updatedAt !== "string") return false;
  const startedAt = Date.parse(updatedAt);
  const elapsed = Date.now() - startedAt;
  return Number.isFinite(startedAt) && elapsed >= 0 && elapsed < PAIRING_GRACE_PERIOD_MS;
};

export const createHandler = (dependencies: HandlerDependencies = {}) => async (req: Request): Promise<Response> => {
  // CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Carregar variáveis de ambiente
  const uazapiBaseUrl = Deno.env.get("UAZAPI_BASE_URL") || "";
  const uazapiAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
  const instancesTable = "whatsapp_instances";
  const instanceTokenColumn = "instance_token";
  const runtimeEnvironment = (Deno.env.get("APP_ENV") || Deno.env.get("ENVIRONMENT") || "dev").trim();
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
  const providerFactory = dependencies.providerFactory ?? ((config) => createUazapiProvider(config, globalThis.fetch));
  const provider = providerFactory({
    baseUrl: uazapiBaseUrl,
    adminToken: uazapiAdminToken,
  });
  if (!dependencies.providerFactory && (!uazapiBaseUrl.trim() || !uazapiAdminToken.trim())) {
    return new Response(JSON.stringify({ error: "WhatsApp provider configuration is missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const providerFailureResponse = (attempts?: number): Response => new Response(
    JSON.stringify({
      error: "WhatsApp provider request failed",
      ...(attempts ? { attempts } : {}),
    }),
    {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

  const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const outboundProcessingLeaseMs = 5 * 60 * 1000;
  const sendTextWithRetry = async (input: ProviderSendTextInput, initialAttempt = 1): Promise<number> => {
    let backoffMs = 250;
    for (let attempt = initialAttempt; attempt <= 3; attempt++) {
      try {
        await provider.sendText(input);
        return attempt;
      } catch (error) {
        const status = error instanceof WhatsAppProviderError
          ? error.status
          : Number((error as { status?: unknown })?.status) || undefined;
        const retryAfterMs = error instanceof WhatsAppProviderError ? error.retryAfterMs : undefined;
        const retryable = status === undefined || status === 429 || status >= 500;
        if (!retryable || attempt === 3) {
          if (error && typeof error === "object") {
            (error as { attempts?: number }).attempts = attempt;
          }
          throw error;
        }

        await sleep(Math.min(Math.max(backoffMs, retryAfterMs ?? 0), 60 * 1000));
        backoffMs *= 2;
      }
    }

    throw new Error("WhatsApp provider request failed");
  };

  type OutboundReservation = {
    duplicate: boolean;
    attempts: number;
    error?: boolean;
    status?: "processing" | "succeeded" | "failed";
  };

  const reserveOutboundMessage = async ({
    tenantId,
    instanceId,
    appointmentId,
    eventType,
    reminderWindow,
  }: {
    tenantId: string;
    instanceId?: string;
    appointmentId: string;
    eventType: string;
    reminderWindow?: string;
  }): Promise<OutboundReservation> => {
    const idempotencyKey = reminderWindow
      ? `appointment:${appointmentId}:${eventType}:${reminderWindow}`
      : `appointment:${appointmentId}:${eventType}`;
    const { error: insertError } = await supabase
      .from("whatsapp_message_idempotency")
      .insert({
        tenant_id: tenantId,
        whatsapp_instance_id: instanceId ?? null,
        direction: "outbound",
        event_type: eventType,
        idempotency_key: idempotencyKey,
        appointment_id: appointmentId,
        reminder_window: reminderWindow ?? null,
        status: "processing",
        attempt_count: 1,
      });

    if (!insertError) return { duplicate: false, attempts: 1, status: "processing" };
    if (insertError.code !== "23505") return { duplicate: false, attempts: 0, error: true };

    const { data: existing, error: existingError } = await supabase
      .from("whatsapp_message_idempotency")
      .select("status, attempt_count, last_error, updated_at")
      .eq("tenant_id", tenantId)
      .eq("direction", "outbound")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) return { duplicate: false, attempts: 0, error: true };

    const attempts = Number(existing?.attempt_count ?? 0);
    const updatedAt = existing?.updated_at ? Date.parse(existing.updated_at) : NaN;
    const processingIsStale = existing?.status === "processing" &&
      Number.isFinite(updatedAt) && Date.now() - updatedAt >= outboundProcessingLeaseMs;
    const reclaimStatus = existing?.status === "failed" && existing.last_error !== "permanent provider error"
      ? "failed"
      : processingIsStale
        ? "processing"
        : null;
    if (reclaimStatus && attempts < 3) {
      const { data: reclaimed, error: reclaimError } = await supabase
        .from("whatsapp_message_idempotency")
        .update({
          status: "processing",
          attempt_count: attempts + 1,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .eq("idempotency_key", idempotencyKey)
        .eq("status", reclaimStatus)
        .eq("attempt_count", attempts)
        .eq("updated_at", existing!.updated_at)
        .select("status, attempt_count")
        .maybeSingle();

      if (reclaimError) return { duplicate: false, attempts, error: true };
      if (!reclaimed) return { duplicate: true, attempts };
      return { duplicate: false, attempts: attempts + 1, status: "processing" };
    }

    return { duplicate: true, attempts, status: existing?.status };
  };

  const finalizeOutboundMessage = async ({
    tenantId,
    appointmentId,
    eventType,
    reminderWindow,
    status,
    attempts,
    expectedAttempt,
    errorMessage,
  }: {
    tenantId: string;
    appointmentId: string;
    eventType: string;
    reminderWindow?: string;
    status: "succeeded" | "failed";
    attempts: number;
    expectedAttempt?: number;
    errorMessage?: string;
  }): Promise<boolean> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { data: finalized, error } = await supabase
        .from("whatsapp_message_idempotency")
        .update({
          status,
          attempt_count: Math.min(Math.max(attempts, 1), 3),
          last_error: errorMessage ?? null,
          completed_at: status === "succeeded" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .eq("status", "processing")
        .eq("attempt_count", expectedAttempt ?? attempts)
        .eq(
          "idempotency_key",
          reminderWindow
            ? `appointment:${appointmentId}:${eventType}:${reminderWindow}`
            : `appointment:${appointmentId}:${eventType}`,
        )
        .select("status, attempt_count")
        .maybeSingle();
      if (!error && finalized) return true;
      if (attempt === 2) console.error("[WhatsApp-Integration] Falha ao persistir resultado da notificação");
    }
    return false;
  };

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

  const validateManageInstanceAuth = async (req: Request, instanceId?: string, tableName = instancesTable): Promise<Response | null> => {
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
            .from(tableName)
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

  const revertInstanceToDisconnected = async (instanceId: string, tableName = instancesTable) => {
    const { error: updateErr } = await supabase
      .from(tableName)
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
    // ROTA: /activate-instance (ativação transacional Uazapi)
    // -------------------------------------------------------------------------
    if (path.endsWith("/activate-instance")) {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authHeader = req.headers.get("Authorization") || "";
      const bearerMatch = authHeader.match(/^Bearer\s+([^\s]+)$/i);
      if (!bearerMatch) {
        return new Response(JSON.stringify({ error: "Unauthorized user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("tenant_id, role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile?.tenant_id || profile.role !== "gerente") {
        return new Response(JSON.stringify({ error: "Apenas gerentes podem ativar a integração de WhatsApp." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tenantId = String(profile.tenant_id);
      const { data: existing, error: existingError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingError) {
        console.error("[WhatsApp-Integration] Falha ao verificar integração existente");
        return new Response(JSON.stringify({ error: "Não foi possível verificar a integração atual." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing) {
        return new Response(JSON.stringify({ error: "A barbearia já possui uma integração de WhatsApp." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = `nav_${tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}_${crypto.randomUUID().slice(0, 8)}`;
      const reservationToken = `pending-${crypto.randomUUID()}`;
      const { data: reservation, error: reservationError } = await supabase
        .from("whatsapp_instances")
        .insert({
          tenant_id: tenantId,
          provider: "uazapi",
          instance_name: instanceName,
          instance_token: reservationToken,
          status: "disconnected",
        })
        .select("id, tenant_id, provider, instance_name, status, send_confirmation, send_reminders, send_cancellation, reminder_hours, qr_code, created_at, updated_at")
        .single();

      if (reservationError || !reservation) {
        if (reservationError?.code === "23505") {
          return new Response(JSON.stringify({ error: "A barbearia já possui uma integração de WhatsApp." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("[WhatsApp-Integration] Falha ao reservar integração de WhatsApp");
        return new Response(JSON.stringify({ error: "Não foi possível iniciar a ativação do WhatsApp." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let createdToken = "";
      let providerCreateCompleted = false;
      try {
        const created = await provider.createInstance({
          instanceName,
          metadata: { tenantId, environment: runtimeEnvironment },
        });
        providerCreateCompleted = true;
        createdToken = created.instanceToken;

        await provider.configureWebhook({
          instanceName,
          instanceToken: createdToken,
          webhookUrl: `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`,
          events: ["connection", "messages"],
          excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"],
        });

        const { data: activated, error: activationError } = await supabase
          .from("whatsapp_instances")
          .update({
            instance_token: createdToken,
            provider_instance_id: created.providerInstanceId ?? null,
            status: "disconnected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservation.id)
          .select("id, tenant_id, provider, instance_name, status, send_confirmation, send_reminders, send_cancellation, reminder_hours, qr_code, created_at, updated_at")
          .single();

        if (activationError || !activated) throw new Error("local persistence failed");

        return new Response(JSON.stringify({ success: true, instance: activated }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (activationError) {
        console.error("[WhatsApp-Integration] Falha na ativação transacional do WhatsApp");
        let remoteCompensated = !providerCreateCompleted;
        if (createdToken && provider.deleteInstance) {
          for (let attempt = 1; attempt <= 3 && !remoteCompensated; attempt++) {
            try {
              await provider.deleteInstance({ instanceName, instanceToken: createdToken });
              remoteCompensated = true;
            } catch {
              if (attempt === 3) {
                console.error("[WhatsApp-Integration] Falha ao compensar instância remota da Uazapi");
              }
            }
          }
        }
        let localReservationRemoved = false;
        if (remoteCompensated) {
          for (let attempt = 1; attempt <= 3 && !localReservationRemoved; attempt++) {
            const { error: cleanupError } = await supabase.from("whatsapp_instances").delete().eq("id", reservation.id);
            if (!cleanupError) {
              localReservationRemoved = true;
            } else if (attempt === 3) {
              console.error("[WhatsApp-Integration] Falha ao remover reserva local da ativação");
            }
          }
        }
        if (!localReservationRemoved) {
          await supabase.from("whatsapp_instances").update({
            status: "disconnected",
            qr_code: null,
            updated_at: new Date().toISOString(),
          }).eq("id", reservation.id);
        }
        return providerFailureResponse();
      }
    }

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
      if (body.provider && body.provider !== "uazapi") {
        return new Response(JSON.stringify({ error: "WhatsApp provider is not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const manageTable = "whatsapp_instances";
      const manageTokenColumn = "instance_token";

      if (!action || !instance_id || !instance_name) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authError = await validateManageInstanceAuth(req, instance_id, manageTable);
      if (authError) return authError;

      console.log(`[WhatsApp-Integration] /manage-instance: Ação '${action}' para instância '${instance_name}'`);

      // Buscar o token da instância no banco de dados para usar nas chamadas
      const { data: dbInstance, error: fetchErr } = await supabase
        .from(manageTable)
        .select(`${manageTokenColumn}, status, qr_code, updated_at`)
        .eq("id", instance_id)
        .single();

      if (fetchErr || !dbInstance) {
        console.error(`[WhatsApp-Integration] Instância ${instance_id} não encontrada no banco`);
        return new Response(JSON.stringify({ error: "Instance not found in database" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceApiKey = dbInstance[manageTokenColumn];
      const syncProviderStatus = async (providerStatus: ProviderStatus) => {
        const normalizedStatus = providerStatus.status;
        if (normalizedStatus === "disconnected" && isRecentPairing(dbInstance.status, dbInstance.updated_at)) {
          return {
            status: "connecting" as const,
            qrcode: dbInstance.qr_code ?? providerStatus.qrCode,
            pairingCode: providerStatus.pairingCode,
          };
        }

        if (normalizedStatus === "connecting" && dbInstance.status === "connecting") {
          if (providerStatus.qrCode && providerStatus.qrCode !== dbInstance.qr_code) {
            const { error: qrError } = await supabase
              .from(manageTable)
              .update({ qr_code: providerStatus.qrCode })
              .eq("id", instance_id);
            if (qrError) throw qrError;
          }
          return {
            status: "connecting" as const,
            qrcode: providerStatus.qrCode ?? dbInstance.qr_code,
            pairingCode: providerStatus.pairingCode,
          };
        }

        const shouldClearQr = ["connected", "disconnected", "hibernated"].includes(normalizedStatus);
        const { error: statusError } = await supabase
          .from(manageTable)
          .update({
            status: normalizedStatus,
            qr_code: shouldClearQr ? null : (providerStatus.qrCode ?? undefined),
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance_id);
        if (statusError) throw statusError;
        return { status: normalizedStatus, qrcode: providerStatus.qrCode, pairingCode: providerStatus.pairingCode };
      };

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
        return new Response(JSON.stringify({ success: true, status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } 
      
      else if (action === "connect" || action === "resume") {
        // Garantir que a instância exista no provedor com o token correto antes de solicitar o QR Code.
        // Iniciar o pareamento e configurar o webhook por meio do contrato neutro.
        try {
          const targetWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-integration/webhook`;
          const connectionStatus = await provider.connectInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
            webhookUrl: targetWebhookUrl,
            events: ["connection", "messages"],
          });
          const synchronized = await syncProviderStatus(connectionStatus);
          console.log(`[WhatsApp-Integration] [Webhook-Preflight] Pareamento iniciado e webhook configurado pelo provedor`);
          return new Response(JSON.stringify({ success: true, ...synchronized }), {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (webhookErr) {
          console.error(`[WhatsApp-Integration] [Webhook-Preflight] Falha ao iniciar pareamento no provedor:`, webhookErr);
          await revertInstanceToDisconnected(instance_id, manageTable);
          return providerFailureResponse();
        }

      } 

      else if (action === "status") {
        try {
          const providerStatus = await provider.getInstanceStatus({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
          });
          const synchronized = await syncProviderStatus(providerStatus);
          return new Response(JSON.stringify({ success: true, ...synchronized }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return providerFailureResponse();
        }
      }
      
      else if (action === "disconnect") {
        // Caso a instância já esteja desconectada no provedor, limpamos o status no banco mesmo assim.
        try {
          await provider.disconnectInstance({
            instanceName: instance_name,
            instanceToken: instanceApiKey,
          });
        } catch (disconnectError) {
          console.error("[WhatsApp-Integration] Falha ao desconectar a instância no provedor", disconnectError);
          return providerFailureResponse();
        }

        // Atualizar status no banco de dados para disconnected e limpar QR Code
        const { error: updateErr } = await supabase
          .from(manageTable)
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
      const event = body.event ?? body.EventType;
      const instanceName = typeof body.instance === "string"
        ? body.instance
        : typeof body.instance?.name === "string"
        ? body.instance.name
        : typeof body.instanceName === "string"
        ? body.instanceName
        : "";
      const instanceToken = body.instanceToken || body.token || body.data?.token ||
        req.headers.get("x-instance-token") || req.headers.get("x-uazapi-token") || req.headers.get("token");
      const statusCandidates = [
        body.data?.status,
        body.data?.state,
        body.data?.instance?.status,
        body.instance?.status,
        body.status?.status,
        body.status,
        body.state,
      ];
      const explicitStatus = statusCandidates.find((candidate) => typeof candidate === "string" && candidate.trim());
      const connectedFlag = body.status?.connected ?? body.data?.status?.connected ?? body.data?.connected;
      const reportedConnectionStatus = connectedFlag === true
        ? "connected"
        : connectedFlag === false && !explicitStatus
        ? "disconnected"
        : explicitStatus;
      const eventClean = String(event || "").toLowerCase().replace(/_/g, ".");

      console.log(`[WhatsApp-Integration] Webhook recebido: Evento '${event}' (normalizado: '${eventClean}') da instância '${instanceName}' (status informado: '${reportedConnectionStatus}')`);

      const cleanInstanceToken = typeof instanceToken === "string" ? instanceToken.trim() : "";
      if (!cleanInstanceToken) {
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authenticatedInstance, error: instanceAuthError } = await supabase
        .from(instancesTable)
        .select(`id, tenant_id, instance_name, ${instanceTokenColumn}, status, qr_code, updated_at`)
        .eq(instanceTokenColumn, cleanInstanceToken)
        .single();

      if (instanceAuthError || !authenticatedInstance) {
        console.warn("[WhatsApp-Integration] Webhook rejeitado: token de instância inválido");
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isConnectionUpdate = ["connection", "connection.update", "connected", "pairsuccess"].includes(eventClean);
      const isQrCodeUpdate = ["qrcode", "qrcode.updated", "qr.code"].includes(eventClean);

      const isMessageEvent = ["message", "messages"].includes(eventClean);

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
          .from(instancesTable)
          .update({
            status: "connecting",
            qr_code: qrCode,
            updated_at: new Date().toISOString(),
          })
          .eq(instanceTokenColumn, cleanInstanceToken);

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

      if (isMessageEvent) {
        const messageInfo = body.data?.Info || body.data?.info || {};
        const messagePayload = body.data?.message || body.data?.Message || body.message || body.data || {};
        const asBoolean = (value: unknown): boolean => {
          const normalized = String(value).toLowerCase();
          return value === true || value === 1 || normalized === "true" || normalized === "yes" || normalized === "1";
        };
        const isFromMe = asBoolean(
          messagePayload.fromMe ?? messagePayload.isFromMe ?? messagePayload.fromMeYes ??
            messageInfo.IsFromMe ?? messageInfo.isFromMe ?? body.fromMe ?? body.fromMeYes,
        );
        const wasSentByApi = asBoolean(messagePayload.wasSentByApi ?? body.wasSentByApi);
        const isGroup = asBoolean(
          messagePayload.isGroup ?? messagePayload.isGroupMessage ?? messagePayload.isGroupYes ?? body.isGroup ?? body.isGroupYes,
        );
        const senderJid = String(messagePayload.sender ?? messagePayload.sender_pn ?? messageInfo.Sender ?? messageInfo.sender ?? body.sender ?? "");
        const chatJid = String(messagePayload.chatid ?? messagePayload.chat ?? messageInfo.Chat ?? messageInfo.chat ?? body.chatid ?? "");
        const candidateJids = [senderJid, chatJid, String(messagePayload.sender_lid ?? "")].filter(Boolean);

        if (
          isFromMe ||
          wasSentByApi ||
          isGroup ||
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

        const externalMessageId = String(
          messagePayload.messageid ?? messagePayload.messageId ?? messagePayload.id ?? messageInfo.ID ?? body.messageid ?? "",
        ).trim();
        if (!externalMessageId) {
          return new Response(JSON.stringify({ ignored: true, reason: "Message id missing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const markInboundFailed = async (reason: string) => {
          await supabase
            .from("whatsapp_message_idempotency")
            .update({
              status: "failed",
              last_error: reason,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", authenticatedInstance.tenant_id)
            .eq("direction", "inbound")
            .eq("idempotency_key", externalMessageId);
        };

        const { error: idempotencyError } = await supabase
          .from("whatsapp_message_idempotency")
          .insert({
            tenant_id: authenticatedInstance.tenant_id,
            whatsapp_instance_id: authenticatedInstance.id,
            direction: "inbound",
            event_type: "first_contact",
            idempotency_key: externalMessageId,
            external_message_id: externalMessageId,
            status: "processing",
            attempt_count: 1,
          });

        if (idempotencyError) {
          if (idempotencyError.code === "23505") {
              const { data: existingMessage, error: existingMessageError } = await supabase
                .from("whatsapp_message_idempotency")
                .select("status, attempt_count")
                .eq("tenant_id", authenticatedInstance.tenant_id)
                .eq("direction", "inbound")
                .eq("idempotency_key", externalMessageId)
                .maybeSingle();

              if (existingMessageError) {
                console.error("[WhatsApp-Integration] Falha ao consultar idempotência da mensagem");
                return new Response(JSON.stringify({ error: "Failed to reserve message" }), {
                  status: 500,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }

              const attemptCount = Number(existingMessage?.attempt_count ?? 0);
              if (existingMessage?.status === "failed" && attemptCount < 3) {
                const { error: retryError } = await supabase
                  .from("whatsapp_message_idempotency")
                  .update({
                    status: "processing",
                    attempt_count: attemptCount + 1,
                    last_error: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("tenant_id", authenticatedInstance.tenant_id)
                  .eq("direction", "inbound")
                  .eq("idempotency_key", externalMessageId);

                if (retryError) {
                  console.error("[WhatsApp-Integration] Falha ao reabrir idempotência da mensagem");
                  return providerFailureResponse();
                }
              } else {
                return new Response(JSON.stringify({ success: true, duplicate: true }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          if (idempotencyError.code !== "23505") {
              console.error("[WhatsApp-Integration] Falha ao reservar idempotência da mensagem");
              return new Response(JSON.stringify({ error: "Failed to reserve message" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
          }
        }

        const pushName = String(messagePayload.senderName ?? messagePayload.pushName ?? messageInfo.PushName ?? messageInfo.pushName ?? "").trim() || null;
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
          await markInboundFailed("customer lookup failed");
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
            instanceToken: authenticatedInstance[instanceTokenColumn],
            number: senderPhone,
            text: messageText,
          });
        } catch (sendError) {
          await supabase
            .from("whatsapp_message_idempotency")
            .update({
              status: "failed",
              last_error: "provider request failed",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", authenticatedInstance.tenant_id)
            .eq("direction", "inbound")
            .eq("idempotency_key", externalMessageId);
          console.error("[WhatsApp-Integration] Falha do provedor ao responder mensagem recebida");
          return providerFailureResponse();
        }

        const { error: idempotencyUpdateError } = await supabase
          .from("whatsapp_message_idempotency")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", authenticatedInstance.tenant_id)
          .eq("direction", "inbound")
          .eq("idempotency_key", externalMessageId);

        if (idempotencyUpdateError) {
          console.error("[WhatsApp-Integration] Falha ao concluir idempotência da mensagem");
        }

        return new Response(JSON.stringify({ success: true, created: customer.created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isConnectionUpdate) {
        let localStatus: "connected" | "disconnected" | "connecting" | "hibernated" = "disconnected";
        const statusClean = String(reportedConnectionStatus || "").toLowerCase();

        if (eventClean === "connected" || eventClean === "pairsuccess" || statusClean === "open" || statusClean === "connected") {
          localStatus = "connected";
        } else if (statusClean === "connecting") {
          localStatus = "connecting";
        } else if (statusClean === "hibernated" || statusClean === "paused") {
          localStatus = "hibernated";
        } else {
          localStatus = "disconnected";
        }

        const shouldPreservePairing =
          (localStatus === "disconnected" && String(explicitStatus || "").toLowerCase() !== "disconnected" &&
            isRecentPairing(authenticatedInstance.status, authenticatedInstance.updated_at)) ||
          (localStatus === "connecting" && authenticatedInstance.status === "connecting");

        if (localStatus === "disconnected" && shouldPreservePairing) {
          console.log("[WhatsApp-Integration] Ignorando desconexão transitória durante a janela de pareamento");
        }

        if (shouldPreservePairing) {
          return new Response(JSON.stringify({ success: true, status: "connecting" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[WhatsApp-Integration] Mapeando status informado '${reportedConnectionStatus}' -> local '${localStatus}'`);

        // Atualizar no banco de dados
        const updateQuery = supabase
          .from(instancesTable)
          .update({
            status: localStatus,
            // Limpa o QR Code caso a conexão esteja ativa
            qr_code: localStatus === "connected" ? null : undefined,
            updated_at: new Date().toISOString(),
          });

        const { error: updateErr } = await updateQuery.eq(instanceTokenColumn, cleanInstanceToken);

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

      // 1. Obter a configuração de WhatsApp do tenant
      const { data: config, error: configErr } = await supabase
        .from(instancesTable)
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
        .eq("tenant_id", tenant_id)
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

      const reservation = await reserveOutboundMessage({
        tenantId: tenant_id,
        instanceId: config.id,
        appointmentId: appointment_id,
        eventType: event,
      });
      if (reservation.error) {
        console.error("[WhatsApp-Integration] Falha ao reservar idempotência da notificação");
        return new Response(JSON.stringify({ error: "Failed to reserve notification" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (reservation.duplicate) {
        return new Response(JSON.stringify({ success: true, duplicate: true, attempts: reservation.attempts }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Enviar mensagem pelo provedor configurado com retry controlado
      let attempts = reservation.attempts || 1;
      try {
        attempts = await sendTextWithRetry({
          instanceName: config.instance_name,
          instanceToken: config[instanceTokenColumn],
          number: clientPhone,
          text: messageText,
          idempotencyKey: `appointment:${appointment_id}:${event}`,
        }, reservation.attempts || 1);
      } catch (sendError) {
        const failedAttempts = Number((sendError as { attempts?: unknown })?.attempts ?? attempts);
        const permanentFailure = sendError instanceof WhatsAppProviderError &&
          sendError.status !== undefined && sendError.status >= 400 && sendError.status < 500 && sendError.status !== 429;
        await finalizeOutboundMessage({
          tenantId: tenant_id,
          appointmentId: appointment_id,
          eventType: event,
          status: "failed",
          attempts: failedAttempts,
          expectedAttempt: reservation.attempts || 1,
          errorMessage: permanentFailure ? "permanent provider error" : "provider request failed",
        });
        console.error("[WhatsApp-Integration] Falha do provedor ao disparar notificação");
        return providerFailureResponse(failedAttempts);
      }

      const finalized = await finalizeOutboundMessage({
        tenantId: tenant_id,
        appointmentId: appointment_id,
        eventType: event,
        status: "succeeded",
        attempts,
        expectedAttempt: reservation.attempts || 1,
      });
      console.log(`[WhatsApp-Integration] Mensagem disparada com sucesso para ${clientPhone}`);
      return new Response(JSON.stringify({ success: true, attempts, diagnostic_persisted: finalized }), {
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
        .from(instancesTable)
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
      let totalFailed = 0;

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

            const reminderWindow = `${hours}h`;
            const reservation = await reserveOutboundMessage({
              tenantId: instance.tenant_id,
              instanceId: instance.id,
              appointmentId: app.id,
              eventType: "appointment_reminder",
              reminderWindow,
            });

            if (reservation.error) {
              console.error("[WhatsApp-Integration] Falha ao reservar idempotência do lembrete");
              totalFailed++;
              continue;
            }

            if (reservation.duplicate) {
              if (reservation.status === "succeeded") {
                const { error: markDuplicateError } = await supabase
                  .from("appointments")
                  .update({ reminder_sent: true })
                  .eq("id", app.id)
                  .eq("tenant_id", instance.tenant_id);
                if (markDuplicateError) {
                  console.error("[WhatsApp-Integration] Falha ao marcar lembrete já concluído");
                }
              }
              continue;
            }

            let attempts = reservation.attempts || 1;
            try {
              attempts = await sendTextWithRetry({
                instanceName: instance.instance_name,
                instanceToken: instance[instanceTokenColumn],
                number: clientPhone,
                text: messageText,
                idempotencyKey: `appointment:${app.id}:appointment_reminder:${reminderWindow}`,
              }, reservation.attempts || 1);

              const finalized = await finalizeOutboundMessage({
                tenantId: instance.tenant_id,
                appointmentId: app.id,
                eventType: "appointment_reminder",
                reminderWindow,
                status: "succeeded",
                attempts,
                expectedAttempt: reservation.attempts || 1,
              });
              if (!finalized) {
                console.error("[WhatsApp-Integration] Lembrete enviado, mas o diagnóstico de idempotência não foi persistido");
                totalFailed++;
              }

              console.log(`[WhatsApp-Integration] Lembrete enviado com sucesso para ${clientPhone}`);
              const { error: markErr } = await supabase
                .from("appointments")
                .update({ reminder_sent: true })
                .eq("id", app.id)
                .eq("tenant_id", instance.tenant_id);

              if (markErr) {
                console.error(`[WhatsApp-Integration] Erro ao marcar reminder_sent no agendamento ${app.id}: ${markErr.message}`);
                totalFailed++;
              } else {
                totalSent++;
              }
            } catch (sendError) {
              const failedAttempts = Number((sendError as { attempts?: unknown })?.attempts ?? attempts);
              const permanentFailure = sendError instanceof WhatsAppProviderError &&
                sendError.status !== undefined && sendError.status >= 400 && sendError.status < 500 && sendError.status !== 429;
              await finalizeOutboundMessage({
                tenantId: instance.tenant_id,
                appointmentId: app.id,
                eventType: "appointment_reminder",
                reminderWindow,
                status: "failed",
                attempts: failedAttempts,
                expectedAttempt: reservation.attempts || 1,
                errorMessage: permanentFailure ? "permanent provider error" : "provider request failed",
              });
              console.error("[WhatsApp-Integration] Falha do provedor no envio do lembrete");
              totalFailed++;
            }
          }
        }
      }

      console.log(`[WhatsApp-Integration] Finalizado processamento de lembretes. Total enviados: ${totalSent}`);
      return new Response(JSON.stringify({ status: "success", processed: totalSent, failed: totalFailed }), {
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
        .from(instancesTable)
        .select(`instance_name, ${instanceTokenColumn}, status`)
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

      let attempts = 1;
      try {
        attempts = await sendTextWithRetry({
          instanceName: instance.instance_name,
          instanceToken: instance[instanceTokenColumn],
          number: clientPhone,
          text: text,
        });
      } catch (sendError) {
        const failedAttempts = Number((sendError as { attempts?: unknown })?.attempts ?? attempts);
        console.error("[WhatsApp-Integration] Erro ao enviar mensagem de teste pelo provedor");
        return providerFailureResponse(failedAttempts);
      }

      return new Response(JSON.stringify({ success: true, attempts }), {
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

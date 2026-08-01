export type ProviderConnectionStatus = "connected" | "connecting" | "disconnected" | "hibernated";
export type ProviderEvent = "connection" | "messages";

export interface ProviderCreateInput {
  instanceName: string;
  instanceToken?: string;
  metadata?: {
    tenantId?: string;
    environment?: string;
  };
}

export interface ProviderInstanceInput {
  instanceName: string;
  instanceToken: string;
}

export interface ProviderWebhookInput extends ProviderInstanceInput {
  webhookUrl: string;
  events: ProviderEvent[];
  excludeMessages?: string[];
}

export interface ProviderSendTextInput extends ProviderInstanceInput {
  number: string;
  text: string;
  idempotencyKey?: string;
}

export interface ProviderStatus {
  status: ProviderConnectionStatus;
  qrCode?: string;
  pairingCode?: string;
}

export interface ProviderCreateResult {
  instanceToken: string;
  providerInstanceId?: string;
}

export interface ProviderWebhookResult {
  statusCode: number;
}

export interface WhatsAppProvider {
  createInstance(input: ProviderCreateInput): Promise<ProviderCreateResult>;
  connectInstance(input: ProviderWebhookInput): Promise<ProviderStatus>;
  getInstanceStatus(input: ProviderInstanceInput): Promise<ProviderStatus>;
  disconnectInstance(input: ProviderInstanceInput): Promise<void>;
  configureWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult>;
  sendText(input: ProviderSendTextInput): Promise<void>;
  deleteInstance?(input: ProviderInstanceInput): Promise<void>;
}

export interface WhatsAppProviderConfig {
  baseUrl: string;
  adminToken: string;
}

export type WhatsAppProviderFactory = (config: WhatsAppProviderConfig) => WhatsAppProvider;

export class WhatsAppProviderError extends Error {
  constructor(
    readonly operation: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(status ? `WhatsApp provider ${operation} failed with status ${status}` : `WhatsApp provider ${operation} failed`);
    this.name = "WhatsAppProviderError";
  }
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const normalizeStatus = (
  value: unknown,
  fallback: ProviderConnectionStatus = "disconnected",
): ProviderConnectionStatus => {
  const status = String(value || "").toLowerCase();
  if (status === "connected" || status === "open") return "connected";
  if (status === "hibernated") return "hibernated";
  if (status === "connecting" || status === "pairing") return "connecting";
  return fallback;
};

export const createEvolutionGoProvider = (
  config: WhatsAppProviderConfig,
  fetcher: Fetcher = globalThis.fetch,
): WhatsAppProvider => {
  const endpointUrl = (endpoint: string): string => {
    const base = config.baseUrl.replace(/\/+$/, "");
    const path = endpoint.replace(/^\/+/, "");
    return `${base}/${path}`;
  };

  const request = async (
    operation: string,
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> => {
    let response: Response;
    try {
      response = await fetcher(endpointUrl(endpoint), init);
    } catch {
      throw new WhatsAppProviderError(operation);
    }

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter
        ? /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
          ? Number(retryAfter.trim()) * 1000
          : (() => {
            const parsed = Date.parse(retryAfter);
            return Number.isFinite(parsed) ? Math.max(0, parsed - Date.now()) : undefined;
          })()
        : undefined;
      await response.body?.cancel();
      throw new WhatsAppProviderError(operation, response.status, retryAfterMs);
    }

    return response;
  };

  const evolutionEventsFor = (events: ProviderEvent[]): string[] => {
    // A versão Evolution Go atualmente instalada expõe a assinatura consolidada ALL.
    // O handler usa eventos neutros; o futuro adaptador Uazapi fará seu próprio mapeamento.
    return events.length > 0 ? ["ALL"] : [];
  };

  const postConnectConfiguration = async (input: ProviderWebhookInput): Promise<Response> => {
    const response = await request("connect instance", "instance/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": input.instanceToken,
      },
      body: JSON.stringify({
        immediate: true,
        webhookUrl: input.webhookUrl,
        subscribe: evolutionEventsFor(input.events),
      }),
    });
    return response;
  };

  return {
    async createInstance(input) {
      const instanceToken = input.instanceToken?.trim();
      if (!instanceToken) {
        throw new WhatsAppProviderError("create instance");
      }
      const response = await request("create instance", "instance/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.adminToken,
        },
        body: JSON.stringify({
          name: input.instanceName,
          token: instanceToken,
        }),
      });
      await response.body?.cancel();
      return { instanceToken };
    },

    async connectInstance(input) {
      const response = await postConnectConfiguration(input);
      let data: Record<string, any> | undefined;
      try {
        data = await response.json();
      } catch {
        throw new WhatsAppProviderError("connect instance");
      }

      return {
        status: normalizeStatus(data?.data?.status ?? data?.data?.state ?? data?.status, "connecting"),
        qrCode: data?.data?.Qrcode ?? data?.data?.qrcode,
        pairingCode: data?.data?.Code ?? data?.data?.code,
      };
    },

    async getInstanceStatus(input) {
      const response = await request("get instance status", "instance/qr", {
        method: "GET",
        headers: { "apikey": input.instanceToken },
      });
      let data: Record<string, any>;
      try {
        data = await response.json();
      } catch {
        throw new WhatsAppProviderError("get instance status");
      }
      return {
        status: normalizeStatus(data?.data?.status ?? data?.data?.state ?? data?.status),
        qrCode: data?.data?.Qrcode ?? data?.data?.qrcode,
        pairingCode: data?.data?.Code ?? data?.data?.code,
      };
    },

    async disconnectInstance(input) {
      const response = await request("disconnect instance", "instance/disconnect", {
        method: "POST",
        headers: { "apikey": input.instanceToken },
      });
      await response.body?.cancel();
    },

    async configureWebhook(input) {
      const response = await postConnectConfiguration(input);
      const result = { statusCode: response.status };
      await response.body?.cancel();
      return result;
    },

    async sendText(input) {
      const response = await request("send text", "send/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": input.instanceToken,
        },
        body: JSON.stringify({
          number: input.number,
          text: input.text,
        }),
      });
      await response.body?.cancel();
    },
  };
};

export const createUazapiProvider = (
  config: WhatsAppProviderConfig,
  fetcher: Fetcher = globalThis.fetch,
): WhatsAppProvider => {
  const endpointUrl = (endpoint: string): string => {
    const base = config.baseUrl.replace(/\/+$/, "");
    const path = endpoint.replace(/^\/+/, "");
    return `${base}/${path}`;
  };

  const request = async (
    operation: string,
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> => {
    let response: Response;
    try {
      response = await fetcher(endpointUrl(endpoint), init);
    } catch {
      throw new WhatsAppProviderError(operation);
    }

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter
        ? /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
          ? Number(retryAfter.trim()) * 1000
          : (() => {
            const parsed = Date.parse(retryAfter);
            return Number.isFinite(parsed) ? Math.max(0, parsed - Date.now()) : undefined;
          })()
        : undefined;
      await response.body?.cancel();
      throw new WhatsAppProviderError(operation, response.status, retryAfterMs);
    }

    return response;
  };

  const parseJson = async (operation: string, response: Response): Promise<Record<string, any>> => {
    try {
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("invalid response");
      }
      return data as Record<string, any>;
    } catch {
      throw new WhatsAppProviderError(operation);
    }
  };

  const instanceFrom = (data: Record<string, any>): Record<string, any> =>
    data.instance && typeof data.instance === "object" ? data.instance : data;

  return {
    async createInstance(input) {
      const response = await request("create instance", "instance/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          admintoken: config.adminToken,
        },
        body: JSON.stringify({
          name: input.instanceName,
          systemName: "Navalhado",
          adminField01: input.metadata?.tenantId,
          adminField02: input.metadata?.environment,
        }),
      });
      const data = await parseJson("create instance", response);
      const instance = instanceFrom(data);
      const instanceToken = String(data.token ?? instance.token ?? "").trim();
      if (!instanceToken) throw new WhatsAppProviderError("create instance");
      const providerInstanceId = String(data.id ?? instance.id ?? "").trim() || undefined;
      return { instanceToken, providerInstanceId };
    },

    async connectInstance(input) {
      const response = await request("connect instance", "instance/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: input.instanceToken,
        },
        body: JSON.stringify({}),
      });
      const data = await parseJson("connect instance", response);
      const instance = instanceFrom(data);
      return {
        status: normalizeStatus(instance.status ?? data.status, "connecting"),
        qrCode: instance.qrcode ?? instance.Qrcode ?? data.qrcode ?? data.Qrcode,
        pairingCode: instance.paircode ?? instance.pairingCode ?? data.paircode,
      };
    },

    async getInstanceStatus(input) {
      const response = await request("get instance status", "instance/status", {
        method: "GET",
        headers: { token: input.instanceToken },
      });
      const data = await parseJson("get instance status", response);
      const instance = instanceFrom(data);
      return {
        status: normalizeStatus(instance.status ?? data.status, "disconnected"),
        qrCode: instance.qrcode ?? instance.Qrcode ?? data.qrcode ?? data.Qrcode,
        pairingCode: instance.paircode ?? instance.pairingCode ?? data.paircode,
      };
    },

    async disconnectInstance(input) {
      const response = await request("disconnect instance", "instance/disconnect", {
        method: "POST",
        headers: { token: input.instanceToken },
      });
      await response.body?.cancel();
    },

    async configureWebhook(input) {
      const response = await request("configure webhook", "webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: input.instanceToken,
        },
        body: JSON.stringify({
          enabled: true,
          url: input.webhookUrl,
          events: input.events,
          excludeMessages: input.excludeMessages ?? ["wasSentByApi", "fromMeYes", "isGroupYes"],
        }),
      });
      const result = { statusCode: response.status };
      await response.body?.cancel();
      return result;
    },

    async sendText(input) {
      const response = await request("send text", "send/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: input.instanceToken,
        },
        body: JSON.stringify({
          number: input.number,
          text: input.text,
          ...(input.idempotencyKey ? { track_id: input.idempotencyKey } : {}),
        }),
      });
      await response.body?.cancel();
    },

    async deleteInstance(input) {
      const response = await request("delete instance", "instance", {
        method: "DELETE",
        headers: { token: input.instanceToken },
      });
      await response.body?.cancel();
    },
  };
};

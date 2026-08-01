export type ProviderConnectionStatus = "connected" | "connecting" | "disconnected" | "hibernated";
export type ProviderEvent = "connection" | "messages";

export interface ProviderCreateInput {
  instanceName: string;
  instanceToken?: string;
}

export interface ProviderInstanceInput {
  instanceName: string;
  instanceToken: string;
}

export interface ProviderWebhookInput extends ProviderInstanceInput {
  webhookUrl: string;
  events: ProviderEvent[];
}

export interface ProviderSendTextInput extends ProviderInstanceInput {
  number: string;
  text: string;
}

export interface ProviderStatus {
  status: ProviderConnectionStatus;
  qrCode?: string;
  pairingCode?: string;
}

export interface ProviderCreateResult {
  instanceToken: string;
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
      await response.body?.cancel();
      throw new WhatsAppProviderError(operation, response.status);
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

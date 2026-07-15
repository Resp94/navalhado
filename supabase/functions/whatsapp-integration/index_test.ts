import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./index.ts";

// Set environment variables for tests
Deno.env.set("EVOLUTION_API_URL", "https://mock-vps.com");
Deno.env.set("EVOLUTION_GLOBAL_APIKEY", "mock-global-key");
Deno.env.set("DB_TRIGGER_SECRET", "mock-db-secret");
Deno.env.set("SUPABASE_URL", "https://mock-supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
Deno.env.set("APP_URL", "https://mock-app.com");

// Helper to mock the global fetch function
const setupMockFetch = (mockResponses: Record<string, { status: number; body: any }>) => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    
    // Find a matching mock response
    for (const [key, response] of Object.entries(mockResponses)) {
      if (urlStr.includes(key)) {
        return Promise.resolve(new Response(JSON.stringify(response.body), {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }));
      }
    }
    
    // Default fallback
    return Promise.resolve(new Response(JSON.stringify({ error: "Mock not configured for " + urlStr }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    }));
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
};

Deno.test("POST /manage-instance - create action should call VPS create endpoint and succeed", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select instance api_key
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: [{ api_key: "mock-instance-key" }]
    },
    // Mock VPS create instance call
    "mock-vps.com/instance/create": {
      status: 200,
      body: { success: true, message: "Instance created" }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-db-trigger-secret": "mock-db-secret",
    },
    body: JSON.stringify({
      action: "create",
      instance_id: "inst-123",
      instance_name: "nav_test",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);
  
  restoreFetch();
});

Deno.test("POST /manage-instance - connect action should get QR Code from VPS and save to DB", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select instance api_key
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: [{ api_key: "mock-instance-key" }]
    },
    // Mock VPS qr endpoint returning Qrcode & Code (capitalized)
    "mock-vps.com/instance/qr": {
      status: 200,
      body: { data: { Qrcode: "base64qrcode...", Code: "123-456" } }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-db-trigger-secret": "mock-db-secret",
    },
    body: JSON.stringify({
      action: "connect",
      instance_id: "inst-123",
      instance_name: "nav_test",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);
  assertEquals(data.qrcode, "base64qrcode...");
  assertEquals(data.code, "123-456");

  restoreFetch();
});

Deno.test("POST /manage-instance - disconnect action should call VPS disconnect and reset status in DB", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: [{ api_key: "mock-instance-key" }]
    },
    "mock-vps.com/instance/disconnect": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-db-trigger-secret": "mock-db-secret",
    },
    body: JSON.stringify({
      action: "disconnect",
      instance_id: "inst-123",
      instance_name: "nav_test",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /webhook - should map state and update DB status", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      event: "connection.update",
      instance: "nav_test",
      data: {
        status: "open"
      }
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /webhook - should accept Evolution Go Connected payload", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      event: "Connected",
      data: {
        status: "open",
        jid: "5511999999999@s.whatsapp.net",
        pushName: "Navalhado"
      },
      instanceId: "249aad2e-68f9-464f-bc84-aca560c38f0e",
      instanceToken: "mock-instance-key"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /webhook - should accept Evolution Go PairSuccess payload", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      event: "PairSuccess",
      data: {
        BusinessName: "",
        ID: "5511999999999@s.whatsapp.net",
        Platform: "android",
        jid: "5511999999999@s.whatsapp.net",
        pushName: "Navalhado",
        status: "open"
      },
      instanceId: "249aad2e-68f9-464f-bc84-aca560c38f0e",
      instanceToken: "mock-instance-key"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /manage-instance connect - should subscribe to Evolution Go connection events", async () => {
  const originalFetch = globalThis.fetch;
  let connectRequestBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      return new Response(JSON.stringify([{ api_key: "mock-instance-key" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("mock-vps.com/instance/create")) {
      return new Response(JSON.stringify({ success: true, message: "Instance ready" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("mock-vps.com/instance/connect")) {
      connectRequestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        data: {
          eventString: "CONNECTION",
          jid: "",
          webhookUrl: "https://mock-supabase.co/functions/v1/whatsapp-integration/webhook"
        },
        message: "success"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("mock-vps.com/instance/qr")) {
      return new Response(JSON.stringify({
        data: {
          Qrcode: "data:image/png;base64,base64qrcode...",
          Code: "123-456"
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Mock not configured for ${urlStr}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-db-trigger-secret": "mock-db-secret"
      },
      body: JSON.stringify({
        action: "connect",
        instance_id: "inst-123",
        instance_name: "nav_test",
        tenant_id: "tenant-456"
      })
    });

    const res = await handler(req);
    assertEquals(res.status, 200);
    assertEquals(connectRequestBody?.subscribe, ["CONNECTION", "MESSAGE"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("POST /webhook - should reply with booking link to a registered customer message", async () => {
  const originalFetch = globalThis.fetch;
  let sentMessage: Record<string, unknown> | undefined;

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      return new Response(JSON.stringify({
        tenant_id: "tenant-456",
        api_key: "mock-instance-key",
        status: "connected"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("rest/v1/rpc/find_or_create_whatsapp_customer")) {
      return new Response(JSON.stringify([{
        customer_id: "customer-123",
        tenant_id: "tenant-456",
        token_acesso: "token-abc",
        cadastro_completo: true,
        created: false
      }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("mock-vps.com/send/text")) {
      sentMessage = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Mock not configured for ${urlStr}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "Message",
        data: {
          Info: {
            Chat: "5592999992222@s.whatsapp.net",
            Sender: "5592999992222@s.whatsapp.net",
            IsFromMe: false,
            ID: "message-123"
          },
          Message: {
            conversation: "Quero agendar"
          }
        },
        instanceId: "instance-123",
        instanceName: "nav_test",
        instanceToken: "mock-instance-key"
      })
    });

    const res = await handler(req);
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.success, true);
    assertEquals(sentMessage?.number, "5592999992222");
    assertEquals(sentMessage?.text, "Para agendar, acesse: https://mock-app.com/cliente/token-abc/agendar");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
type CustomerRpcRow = {
  customer_id: string;
  tenant_id: string;
  token_acesso: string;
  cadastro_completo: boolean;
  created: boolean;
};

const customerRow = (overrides: Partial<CustomerRpcRow> = {}): CustomerRpcRow => ({
  customer_id: "customer-123",
  tenant_id: "tenant-456",
  token_acesso: "token-abc",
  cadastro_completo: false,
  created: true,
  ...overrides,
});

const createMessageRequest = ({
  sender = "5592999992222@s.whatsapp.net",
  chat = sender,
  isFromMe = false,
  pushName = "  Cliente Perfil  ",
}: {
  sender?: string;
  chat?: string;
  isFromMe?: boolean;
  pushName?: string;
} = {}) => new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: "Message",
    data: {
      Info: {
        Chat: chat,
        Sender: sender,
        IsFromMe: isFromMe,
        PushName: pushName,
        ID: "message-123",
      },
      Message: { conversation: "Quero agendar" },
    },
    instanceId: "instance-123",
    instanceName: "nav_test",
    instanceToken: "mock-instance-key",
  }),
});

const setupMessageWebhookFetch = ({
  rpcStatus = 200,
  rpcBody = [customerRow()],
  sendStatus = 200,
}: {
  rpcStatus?: number;
  rpcBody?: unknown;
  sendStatus?: number;
} = {}) => {
  const originalFetch = globalThis.fetch;
  const rpcRequests: Record<string, unknown>[] = [];
  const sentMessages: Record<string, unknown>[] = [];

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      return new Response(JSON.stringify({
        tenant_id: "tenant-456",
        api_key: "mock-instance-key",
        status: "connected",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (urlStr.includes("rest/v1/rpc/find_or_create_whatsapp_customer")) {
      rpcRequests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(rpcBody), {
        status: rpcStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("mock-vps.com/send/text")) {
      sentMessages.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(sendStatus === 200 ? { success: true } : { error: "unavailable" }), {
        status: sendStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Mock not configured for ${urlStr}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    rpcRequests,
    sentMessages,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};

Deno.test("POST /webhook Message - creates customer and replies with new token", async () => {
  const mock = setupMessageWebhookFetch({
    rpcBody: [customerRow({ token_acesso: "token-new", created: true })],
  });

  try {
    const res = await handler(createMessageRequest());
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { success: true, created: true });
    assertEquals(mock.rpcRequests[0], {
      p_tenant_id: "tenant-456",
      p_phone: "5592999992222",
      p_push_name: "Cliente Perfil",
    });
    assertEquals(mock.sentMessages[0], {
      number: "5592999992222",
      text: "Para agendar, acesse: https://mock-app.com/cliente/token-new/agendar",
    });
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Message - returns 500 and does not send when RPC fails", async () => {
  const mock = setupMessageWebhookFetch({
    rpcStatus: 500,
    rpcBody: { message: "rpc failed" },
  });

  try {
    const res = await handler(createMessageRequest());
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: "Failed to find or create customer" });
    assertEquals(mock.sentMessages.length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Message - returns 500 and does not send when RPC is empty", async () => {
  const mock = setupMessageWebhookFetch({ rpcBody: [] });

  try {
    const res = await handler(createMessageRequest());
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: "Failed to find or create customer" });
    assertEquals(mock.sentMessages.length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Message - returns 502 when send text fails", async () => {
  const mock = setupMessageWebhookFetch({ sendStatus: 503 });

  try {
    const res = await handler(createMessageRequest());
    assertEquals(res.status, 502);
    assertEquals(mock.sentMessages.length, 1);
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Message - ignores own, group, broadcast and unsupported lid messages", async () => {
  const cases = [
    createMessageRequest({ isFromMe: true }),
    createMessageRequest({ sender: "5592999992222@g.us" }),
    createMessageRequest({ sender: "status@broadcast" }),
    createMessageRequest({ sender: "1234567890@lid", chat: "1234567890@lid" }),
  ];

  for (const req of cases) {
    const mock = setupMessageWebhookFetch();
    try {
      const res = await handler(req);
      assertEquals(res.status, 200);
      assertEquals((await res.json()).ignored, true);
      assertEquals(mock.rpcRequests.length, 0);
      assertEquals(mock.sentMessages.length, 0);
    } finally {
      mock.restore();
    }
  }
});

Deno.test("POST /webhook Message - uses alternate phone JID for lid sender", async () => {
  const mock = setupMessageWebhookFetch();

  try {
    const res = await handler(createMessageRequest({
      sender: "1234567890@lid",
      chat: "5592999992222:17@s.whatsapp.net",
    }));
    assertEquals(res.status, 200);
    assertEquals(mock.rpcRequests[0]?.p_phone, "5592999992222");
    assertEquals(mock.sentMessages[0]?.number, "5592999992222");
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Message - reuses the same token across repeated messages", async () => {
  const mock = setupMessageWebhookFetch({
    rpcBody: [customerRow({ token_acesso: "token-stable", created: false })],
  });

  try {
    const first = await handler(createMessageRequest());
    const second = await handler(createMessageRequest());
    assertEquals(first.status, 200);
    assertEquals(second.status, 200);
    assertEquals(mock.sentMessages.length, 2);
    assertEquals(mock.sentMessages[0]?.text, mock.sentMessages[1]?.text);
    assertEquals(
      mock.sentMessages[0]?.text,
      "Para agendar, acesse: https://mock-app.com/cliente/token-stable/agendar",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("POST /send-notification - should format message and send it to VPS", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select active instance settings
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: [{
        api_key: "mock-instance-key",
        status: "connected",
        send_confirmation: true,
        send_reminders: true,
        send_cancellation: true,
        reminder_hours: 2
      }]
    },
    // Mock DB select appointment details
    "rest/v1/appointments": {
      status: 200,
      body: [{
        id: "app-123",
        start_time: "2026-07-15T10:00:00Z",
        customers: { name: "Jonathas", phone: "11999998888", token_acesso: "token-abc" },
        professionals: { name: "Guto" },
        services: { name: "Corte e Barba" },
        tenants: { name: "Navalhado Ouro" }
      }]
    },
    // Mock VPS send message call
    "mock-vps.com/send/text": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/send-notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-db-trigger-secret": "mock-db-secret",
    },
    body: JSON.stringify({
      event: "appointment_created",
      appointment_id: "app-123",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /process-reminders - should scan pending appointments and send reminders", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select connected instances
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: [{
        tenant_id: "tenant-456",
        instance_name: "nav_test",
        api_key: "mock-instance-key",
        status: "connected",
        send_confirmation: true,
        send_reminders: true,
        send_cancellation: true,
        reminder_hours: 2
      }]
    },
    // Mock DB select pending appointments
    "rest/v1/appointments": {
      status: 200,
      body: [{
        id: "app-789",
        start_time: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours in the future
        customers: { name: "Cliente Teste", phone: "11999992222", token_acesso: "token-def" },
        professionals: { name: "Guto" },
        services: { name: "Barba" },
        tenants: { name: "Navalhado Ouro" }
      }]
    },
    // Mock VPS send text call
    "mock-vps.com/send/text": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/process-reminders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-db-trigger-secret": "mock-db-secret",
    },
    body: JSON.stringify({})
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "success");
  assertEquals(data.processed, 1);

  restoreFetch();
});

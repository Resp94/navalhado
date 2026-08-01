import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createHandler, handler, singleRelation } from "./index.ts";
import {
  createEvolutionGoProvider,
  createUazapiProvider,
  WhatsAppProviderError,
  type WhatsAppProvider,
} from "./whatsapp_provider.ts";

// Set environment variables for tests
Deno.env.set("EVOLUTION_API_URL", "https://mock-vps.com");
Deno.env.set("EVOLUTION_GLOBAL_APIKEY", "mock-global-key");
Deno.env.set("DB_TRIGGER_SECRET", "mock-db-secret");
Deno.env.set("SUPABASE_URL", "https://mock-supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
Deno.env.set("APP_URL", "https://mock-app.com");

Deno.test("singleRelation normalizes embedded Supabase relations", () => {
  const relation = { id: "relation-1" };

  assertEquals(singleRelation(relation), relation);
  assertEquals(singleRelation([relation]), relation);
  assertEquals(singleRelation([]), null);
  assertEquals(singleRelation(null), null);
});

Deno.test("Evolution Go adapter returns provider-neutral create, connect and webhook results", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];
  let connectCalls = 0;
  const provider = createEvolutionGoProvider(
    { baseUrl: "https://mock-vps.com", adminToken: "mock-global-key" },
    (_input, init) => {
      if (init?.body) requestBodies.push(JSON.parse(String(init.body)));
      if (requestBodies.at(-1)?.name === "nav_test") {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }

      connectCalls++;
      if (connectCalls === 1) {
        return Promise.resolve(new Response(JSON.stringify({
          data: { status: "pairing", qrcode: "data:image/png;base64,qr" },
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  );

  const created = await provider.createInstance({
    instanceName: "nav_test",
    instanceToken: "mock-instance-key",
  });
  const connected = await provider.connectInstance({
    instanceName: "nav_test",
    instanceToken: "mock-instance-key",
    webhookUrl: "https://mock-app.com/webhook",
    events: ["connection", "messages"],
  });
  const configured = await provider.configureWebhook({
    instanceName: "nav_test",
    instanceToken: "mock-instance-key",
    webhookUrl: "https://mock-app.com/webhook",
    events: ["connection", "messages"],
  });

  assertEquals(created, { instanceToken: "mock-instance-key" });
  assertEquals(connected, {
    status: "connecting",
    qrCode: "data:image/png;base64,qr",
    pairingCode: undefined,
  });
  assertEquals(configured, { statusCode: 204 });
  assertEquals(requestBodies[1]?.subscribe, ["ALL"]);
});

Deno.test("Evolution Go adapter converts malformed provider responses to safe errors", async () => {
  const provider = createEvolutionGoProvider(
    { baseUrl: "https://mock-vps.com", adminToken: "secret-admin-token" },
    () => Promise.resolve(new Response("not-json", { status: 200 })),
  );

  const error = await assertRejects(
    () => provider.getInstanceStatus({
      instanceName: "nav_test",
      instanceToken: "secret-instance-token",
    }),
    WhatsAppProviderError,
  );

  assertEquals(error.message.includes("secret-admin-token"), false);
  assertEquals(error.message.includes("secret-instance-token"), false);

  const connectError = await assertRejects(
    () => provider.connectInstance({
      instanceName: "nav_test",
      instanceToken: "secret-instance-token",
      webhookUrl: "https://mock-app.com/webhook",
      events: ["connection", "messages"],
    }),
    WhatsAppProviderError,
  );

  assertEquals(connectError.message.includes("secret-admin-token"), false);
  assertEquals(connectError.message.includes("secret-instance-token"), false);
});

Deno.test("Uazapi adapter creates instances and configures filtered webhooks", async () => {
  const requests: Array<{ url: string; headers: Headers; body?: Record<string, unknown> }> = [];
  const provider = createUazapiProvider(
    { baseUrl: "https://api.uazapi.com", adminToken: "admin-secret" },
    async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, headers, body });

      if (url.endsWith("/instance/create")) {
        return new Response(JSON.stringify({
          token: "instance-secret",
          instance: { id: "uaz-instance-1", token: "instance-secret", status: "disconnected" },
        }), { status: 200 });
      }
      if (url.endsWith("/instance/connect")) {
        return new Response(JSON.stringify({ instance: { status: "connecting", qrcode: "qr-now", paircode: "1234" } }), { status: 200 });
      }
      if (url.endsWith("/instance/status")) {
        return new Response(JSON.stringify({ instance: { status: "hibernated" } }), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: "webhook-1" }]), { status: 200 });
    },
  );

  const created = await provider.createInstance({
    instanceName: "nav_tenant_1",
    metadata: { tenantId: "tenant-1", environment: "dev" },
  });
  await provider.configureWebhook({
    instanceName: "nav_tenant_1",
    instanceToken: created.instanceToken,
    webhookUrl: "https://dev.example.com/webhook",
    events: ["connection", "messages"],
  });
  const connecting = await provider.connectInstance({
    instanceName: "nav_tenant_1",
    instanceToken: created.instanceToken,
    webhookUrl: "https://dev.example.com/webhook",
    events: ["connection", "messages"],
  });
  const paused = await provider.getInstanceStatus({
    instanceName: "nav_tenant_1",
    instanceToken: created.instanceToken,
  });

  assertEquals(created, { instanceToken: "instance-secret", providerInstanceId: "uaz-instance-1" });
  assertEquals(requests[0]?.url, "https://api.uazapi.com/instance/create");
  assertEquals(requests[0]?.headers.get("admintoken"), "admin-secret");
  assertEquals(requests[0]?.body, {
    name: "nav_tenant_1",
    systemName: "Navalhado",
    adminField01: "tenant-1",
    adminField02: "dev",
  });
  assertEquals(requests[1]?.url, "https://api.uazapi.com/webhook");
  assertEquals(requests[1]?.headers.get("token"), "instance-secret");
  assertEquals(requests[1]?.body, {
    enabled: true,
    url: "https://dev.example.com/webhook",
    events: ["connection", "messages"],
    excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"],
  });
  assertEquals(connecting, { status: "connecting", qrCode: "qr-now", pairingCode: "1234" });
  assertEquals(paused, { status: "hibernated", qrCode: undefined, pairingCode: undefined });
});

// Helper to mock the global fetch function
const setupMockFetch = (mockResponses: Record<string, { status: number; body: any }>) => {
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = (input: string | URL | Request): Promise<Response> => {
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

const createProviderStub = (
  overrides: Partial<WhatsAppProvider> = {},
): WhatsAppProvider => ({
  createInstance: ({ instanceToken }) => Promise.resolve({
    instanceToken: instanceToken ?? "stub-instance-token",
  }),
  connectInstance: () => Promise.resolve({ status: "connecting" }),
  getInstanceStatus: () => Promise.resolve({ status: "disconnected" }),
  disconnectInstance: () => Promise.resolve(),
  configureWebhook: () => Promise.resolve({ statusCode: 200 }),
  sendText: () => Promise.resolve(),
  ...overrides,
});

Deno.test("POST /activate-instance creates, configures and persists a neutral Uazapi instance without exposing credentials", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const originalAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");
  const calls: string[] = [];
  const providerCalls: string[] = [];
  const provider = createProviderStub({
    createInstance: () => {
      providerCalls.push("create");
      return Promise.resolve({ instanceToken: "secret-instance-token", providerInstanceId: "uaz-id-1" });
    },
    configureWebhook: (input) => {
      providerCalls.push(`webhook:${input.events.join(",")}`);
      return Promise.resolve({ statusCode: 200 });
    },
  });

  Deno.env.set("UAZAPI_BASE_URL", "https://api.uazapi.com");
  Deno.env.set("UAZAPI_ADMIN_TOKEN", "secret-admin-token");
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";
    calls.push(`${method} ${url}`);
    if (url.includes("auth/v1/user")) return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    if (url.includes("rest/v1/users")) return new Response(JSON.stringify({ tenant_id: "tenant-1", role: "gerente" }), { status: 200 });
    if (url.includes("rest/v1/whatsapp_instances")) {
      if (method === "GET") return new Response(JSON.stringify([]), { status: 200 });
      if (method === "POST") return new Response(JSON.stringify({
        id: "local-1",
        tenant_id: "tenant-1",
        provider: "uazapi",
        instance_name: "nav_tenant_1",
        status: "disconnected",
        send_confirmation: true,
        send_reminders: true,
        send_cancellation: true,
        reminder_hours: 2,
        qr_code: null,
      }), { status: 201 });
      if (method === "PATCH") return new Response(JSON.stringify({
        id: "local-1",
        tenant_id: "tenant-1",
        provider: "uazapi",
        instance_name: "nav_tenant_1",
        status: "disconnected",
        send_confirmation: true,
        send_reminders: true,
        send_cancellation: true,
        reminder_hours: 2,
        qr_code: null,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500 });
  };

  try {
    const response = await createHandler({ providerFactory: () => provider })(
      new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/activate-instance", {
        method: "POST",
        headers: { Authorization: "Bearer user-token" },
        body: "{}",
      }),
    );
    const body = await response.json();
    assertEquals(response.status, 201);
    assertEquals(body.success, true);
    assertEquals(body.instance.instance_name, "nav_tenant_1");
    assertEquals("instance_token" in body.instance, false);
    assertEquals(providerCalls, ["create", "webhook:connection,messages"]);
    assertEquals(calls.some((call) => call.includes("rest/v1/whatsapp_instances")), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) Deno.env.delete("UAZAPI_BASE_URL");
    else Deno.env.set("UAZAPI_BASE_URL", originalBaseUrl);
    if (originalAdminToken === undefined) Deno.env.delete("UAZAPI_ADMIN_TOKEN");
    else Deno.env.set("UAZAPI_ADMIN_TOKEN", originalAdminToken);
  }
});

Deno.test("POST /activate-instance rejects an existing tenant integration and compensates partial activation", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const originalAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");
  const providerCalls: string[] = [];
  const provider = createProviderStub({
    createInstance: () => {
      providerCalls.push("create");
      return Promise.resolve({ instanceToken: "secret-instance-token", providerInstanceId: "uaz-id-2" });
    },
    configureWebhook: () => {
      providerCalls.push("webhook");
      return Promise.reject(new WhatsAppProviderError("configure webhook"));
    },
    deleteInstance: () => {
      providerCalls.push("delete");
      return Promise.resolve();
    },
  });

  Deno.env.set("UAZAPI_BASE_URL", "https://api.uazapi.com");
  Deno.env.set("UAZAPI_ADMIN_TOKEN", "secret-admin-token");

  const run = async (existing: boolean) => {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || "GET";
      if (url.includes("auth/v1/user")) return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
      if (url.includes("rest/v1/users")) return new Response(JSON.stringify({ tenant_id: "tenant-1", role: "gerente" }), { status: 200 });
      if (url.includes("rest/v1/whatsapp_instances")) {
        if (method === "GET") return new Response(JSON.stringify(existing ? { id: "existing-1" } : []), { status: 200 });
        if (method === "POST") return new Response(JSON.stringify({ id: "local-2", instance_name: "nav_tenant_2" }), { status: 201 });
        if (method === "DELETE") return new Response(JSON.stringify({}), { status: 204 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500 });
    };
    return createHandler({ providerFactory: () => provider })(new Request(
      "https://mock-supabase.co/functions/v1/whatsapp-integration/activate-instance",
      { method: "POST", headers: { Authorization: "Bearer user-token" }, body: "{}" },
    ));
  };

  try {
    const conflict = await run(true);
    assertEquals(conflict.status, 409);
    assertEquals(providerCalls, []);

    const compensated = await run(false);
    assertEquals(compensated.status, 502);
    assertEquals(providerCalls, ["create", "webhook", "delete"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) Deno.env.delete("UAZAPI_BASE_URL");
    else Deno.env.set("UAZAPI_BASE_URL", originalBaseUrl);
    if (originalAdminToken === undefined) Deno.env.delete("UAZAPI_ADMIN_TOKEN");
    else Deno.env.set("UAZAPI_ADMIN_TOKEN", originalAdminToken);
  }
});

Deno.test("POST /manage-instance - create delegates through the provider gateway", async () => {
  const providerCalls: Array<Record<string, unknown>> = [];
  const provider = createProviderStub({
    createInstance: (input) => {
      providerCalls.push({ operation: "create", ...input });
      return Promise.resolve({ instanceToken: input.instanceToken ?? "stub-instance-token" });
    },
  });
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" },
    },
  });

  try {
    const testHandler = createHandler({ providerFactory: () => provider });
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
      }),
    });

    const res = await testHandler(req);

    assertEquals(res.status, 200);
    assertEquals(providerCalls, [{
      operation: "create",
      instanceName: "nav_test",
      instanceToken: "mock-instance-key",
    }]);
  } finally {
    restoreFetch();
  }
});

Deno.test("POST /manage-instance - connect delegates through the provider gateway", async () => {
  const providerCalls: Array<Record<string, unknown>> = [];
  const provider = createProviderStub({
    createInstance: (input) => {
      providerCalls.push({ operation: "create", ...input });
      return Promise.resolve({ instanceToken: input.instanceToken ?? "stub-instance-token" });
    },
    connectInstance: (input) => {
      providerCalls.push({ operation: "connect", ...input });
      return Promise.resolve({ status: "connecting" });
    },
  });
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" },
    },
  });

  try {
    const testHandler = createHandler({ providerFactory: () => provider });
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
      }),
    });

    const res = await testHandler(req);

    assertEquals(res.status, 202);
    assertEquals(providerCalls, [
      {
        operation: "create",
        instanceName: "nav_test",
        instanceToken: "mock-instance-key",
      },
      {
        operation: "connect",
        instanceName: "nav_test",
        instanceToken: "mock-instance-key",
        webhookUrl: "https://mock-supabase.co/functions/v1/whatsapp-integration/webhook",
        events: ["connection", "messages"],
      },
    ]);
  } finally {
    restoreFetch();
  }
});

Deno.test("POST /manage-instance - disconnect and webhook configuration delegate through the provider gateway", async () => {
  const providerCalls: Array<Record<string, unknown>> = [];
  const provider = createProviderStub({
    disconnectInstance: (input) => {
      providerCalls.push({ operation: "disconnect", ...input });
      return Promise.resolve();
    },
    configureWebhook: (input) => {
      providerCalls.push({ operation: "configure-webhook", ...input });
      return Promise.resolve({ statusCode: 204 });
    },
  });
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" },
    },
  });

  try {
    const testHandler = createHandler({ providerFactory: () => provider });
    const requestFor = (action: string) => new Request(
      "https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-db-trigger-secret": "mock-db-secret",
        },
        body: JSON.stringify({
          action,
          instance_id: "inst-123",
          instance_name: "nav_test",
        }),
      },
    );

    const disconnectResponse = await testHandler(requestFor("disconnect"));
    const webhookResponse = await testHandler(requestFor("debug-webhook"));

    assertEquals(disconnectResponse.status, 200);
    assertEquals(webhookResponse.status, 200);
    assertEquals((await webhookResponse.json()).debug.status, 204);
    assertEquals(providerCalls, [
      {
        operation: "disconnect",
        instanceName: "nav_test",
        instanceToken: "mock-instance-key",
      },
      {
        operation: "configure-webhook",
        instanceName: "nav_test",
        instanceToken: "mock-instance-key",
        webhookUrl: "https://mock-supabase.co/functions/v1/whatsapp-integration/webhook",
        events: ["connection", "messages"],
      },
    ]);
  } finally {
    restoreFetch();
  }
});

Deno.test("POST /manage-instance - create action should call VPS create endpoint and succeed", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select instance api_key
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" }
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

Deno.test("POST /manage-instance - connect starts pairing and waits for the QR webhook", async () => {
  const originalFetch = globalThis.fetch;
  const observedInstanceHeaders: Array<Record<string, string | null>> = [];

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init?.headers);

    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      return new Response(JSON.stringify({ api_key: "mock-instance-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("mock-vps.com/instance/create")) {
      return new Response(JSON.stringify({ error: "instance already exists" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("mock-vps.com/instance/connect")) {
      const body = JSON.parse(String(init?.body));
      observedInstanceHeaders.push({
        route: "connect",
        apikey: headers.get("apikey"),
        instanceId: headers.get("instanceId"),
      });
      const validTarget =
        headers.get("apikey") === "mock-instance-key" &&
        headers.get("instanceId") === null &&
        body.subscribe.includes("ALL");

      return new Response(JSON.stringify(validTarget ? { success: true } : { error: "not authorized" }), {
        status: validTarget ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("mock-vps.com/instance/qr")) {
      observedInstanceHeaders.push({
        route: "qr",
        apikey: headers.get("apikey"),
        instanceId: headers.get("instanceId"),
      });
      const validTarget =
        headers.get("apikey") === "mock-instance-key" &&
        headers.get("instanceId") === null;

      return new Response(JSON.stringify(validTarget ? {
        data: {
          Qrcode: "data:image/png;base64,targeted-qrcode",
          Code: "targeted-pairing-code",
        },
        message: "success",
      } : { error: "not authorized" }), {
        status: validTarget ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Mock not configured for ${urlStr}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
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
      }),
    });

    const res = await handler(req);
    assertEquals(observedInstanceHeaders, [
      { route: "connect", apikey: "mock-instance-key", instanceId: null },
    ]);
    assertEquals(res.status, 202);
    assertEquals(await res.json(), {
      success: true,
      status: "pairing",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("POST /manage-instance - connect action should authenticate gerente user JWT and grant access", async () => {
  const restoreFetch = setupMockFetch({
    "auth/v1/user": {
      status: 200,
      body: { id: "user-gerente-123", email: "gerente@barbearia.com" }
    },
    "rest/v1/users": {
      status: 200,
      body: { tenant_id: "tenant-456", role: "gerente" }
    },
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key", tenant_id: "tenant-456" }
    },
    "mock-vps.com/instance/create": {
      status: 409,
      body: { error: "instance already exists" }
    },
    "mock-vps.com/instance/connect": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer valid-gerente-jwt-token",
    },
    body: JSON.stringify({
      action: "connect",
      instance_id: "inst-123",
      instance_name: "nav_test",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 202);
  const data = await res.json();
  assertEquals(data, { success: true, status: "pairing" });

  restoreFetch();
});

Deno.test("POST /manage-instance - connect action should reject unauthorized user without gerente role", async () => {
  const restoreFetch = setupMockFetch({
    "auth/v1/user": {
      status: 200,
      body: { id: "user-cliente-123", email: "cliente@email.com" }
    },
    "rest/v1/users": {
      status: 200,
      body: { tenant_id: "tenant-456", role: "cliente" }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/manage-instance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer valid-cliente-jwt-token",
    },
    body: JSON.stringify({
      action: "connect",
      instance_id: "inst-123",
      instance_name: "nav_test",
      tenant_id: "tenant-456"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 403);

  restoreFetch();
});

Deno.test("POST /manage-instance - connect action should revert status to disconnected on VPS error", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" }
    },
    "mock-vps.com/instance/qr": {
      status: 500,
      body: { error: "VPS Internal Error" }
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
  assertEquals(res.status, 502);

  restoreFetch();
});

Deno.test("POST /manage-instance - disconnect action should call VPS disconnect and reset status in DB", async () => {
  const restoreFetch = setupMockFetch({
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { api_key: "mock-instance-key" }
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

Deno.test("POST /webhook - should reject legacy name-only connection updates", async () => {
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
  assertEquals(res.status, 401);
  const data = await res.json();
  assertEquals(data.error, "Unauthorized webhook");

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

Deno.test("POST /webhook - should persist Evolution Go QRCode payload", async () => {
  const originalFetch = globalThis.fetch;
  let savedPayload: Record<string, unknown> | undefined;

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      if ((init?.method || "GET") === "PATCH") {
        savedPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        tenant_id: "tenant-456",
        api_key: "mock-instance-key",
        status: "pairing",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Mock not configured for ${urlStr}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "QRCode",
        data: {
          qrcode: "data:image/png;base64,webhook-qrcode",
        },
        instanceId: "evo-instance-123",
        instanceToken: "mock-instance-key",
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { success: true });
    assertEquals(savedPayload?.status, "pairing");
    assertEquals(savedPayload?.qr_code, "data:image/png;base64,webhook-qrcode");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
      return new Response(JSON.stringify({ api_key: "mock-instance-key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("mock-vps.com/instance/create")) {
      return new Response(JSON.stringify({ data: { id: "evo-instance-123" }, message: "success" }), {
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
    assertEquals(res.status, 202);
    assertEquals(connectRequestBody?.subscribe, ["ALL"]);
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

    if (urlStr.includes("rest/v1/tenants")) {
      return new Response(JSON.stringify({
        name: "Barbearia Estilo"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("rest/v1/customers")) {
      return new Response(JSON.stringify({
        name: "Cliente Perfil"
      }), {
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
    assertEquals(sentMessage?.text, "Olá, Cliente Perfil! Para escolher seu serviço e agendar um horário na *Barbearia Estilo*, acesse: https://mock-app.com/cliente/token-abc/agendar");
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

    if (urlStr.includes("rest/v1/tenants")) {
      return new Response(JSON.stringify({
        name: "Barbearia Estilo"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (urlStr.includes("rest/v1/customers")) {
      return new Response(JSON.stringify({
        name: "Cliente Perfil"
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
      text: "Olá, Cliente Perfil! Para escolher seu serviço e agendar um horário na *Barbearia Estilo*, acesse: https://mock-app.com/cliente/token-new/agendar",
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
      "Olá, Cliente Perfil! Para escolher seu serviço e agendar um horário na *Barbearia Estilo*, acesse: https://mock-app.com/cliente/token-stable/agendar",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("POST /webhook Uazapi - authenticates token, normalizes sender and deduplicates first contact", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const originalAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");
  const sentMessages: Record<string, unknown>[] = [];
  const idempotencyRows: Record<string, unknown>[] = [];
  let duplicate = false;

  Deno.env.set("UAZAPI_BASE_URL", "https://api.uazapi.com");
  Deno.env.set("UAZAPI_ADMIN_TOKEN", "test-admin-token");

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";

    if (url.includes("rest/v1/whatsapp_instances")) {
      return new Response(JSON.stringify({
        id: "instance-uaz-1",
        tenant_id: "tenant-uaz-1",
        instance_name: "nav_tenant_uaz",
        instance_token: "uaz-instance-token",
        status: "connected",
      }), { status: 200 });
    }
    if (url.includes("rest/v1/whatsapp_message_idempotency")) {
      if (method === "POST") {
        if (duplicate) {
          return new Response(JSON.stringify({ code: "23505", message: "duplicate" }), { status: 409 });
        }
        duplicate = true;
        idempotencyRows.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({}), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes("rest/v1/rpc/find_or_create_whatsapp_customer")) {
      return new Response(JSON.stringify([{
        customer_id: "customer-uaz-1",
        token_acesso: "token-uaz-1",
        created: true,
      }]), { status: 200 });
    }
    if (url.includes("rest/v1/tenants")) {
      return new Response(JSON.stringify({ name: "Barbearia Uazapi" }), { status: 200 });
    }
    if (url.includes("rest/v1/customers")) {
      return new Response(JSON.stringify({ name: "Cliente Uazapi" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
  };

  const provider = createProviderStub({
    sendText: (input) => {
      sentMessages.push({ ...input });
      return Promise.resolve();
    },
  });
  const testHandler = createHandler({ providerFactory: () => provider });
  const requestFor = (overrides: Record<string, unknown> = {}) => new Request(
    "https://mock-supabase.co/functions/v1/whatsapp-integration/webhook",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages",
        instance: "nav_tenant_uaz",
        token: "uaz-instance-token",
        data: {
          messageid: "uaz-message-1",
          sender: "5511999992222@s.whatsapp.net",
          chatid: "5511999992222@s.whatsapp.net",
          senderName: "Cliente Uazapi",
          fromMe: false,
          wasSentByApi: false,
          isGroup: false,
          ...overrides,
        },
      }),
    },
  );

  try {
    const first = await testHandler(requestFor());
    const second = await testHandler(requestFor());
    assertEquals(first.status, 200);
    assertEquals(await first.json(), { success: true, created: true });
    assertEquals(second.status, 200);
    assertEquals(await second.json(), { success: true, duplicate: true });
    assertEquals(idempotencyRows[0]?.idempotency_key, "uaz-message-1");
    assertEquals(idempotencyRows[0]?.external_message_id, "uaz-message-1");
    assertEquals(sentMessages.length, 1);
    assertEquals(sentMessages[0]?.number, "5511999992222");
    assertEquals(sentMessages[0]?.instanceToken, "uaz-instance-token");

    const ignoredFromMe = await testHandler(requestFor({ messageid: "uaz-message-from-me", fromMeYes: "yes" }));
    const ignoredApi = await testHandler(requestFor({ messageid: "uaz-message-api", wasSentByApi: true }));
    const ignoredGroup = await testHandler(requestFor({ messageid: "uaz-message-group", isGroupYes: "yes" }));
    assertEquals((await ignoredFromMe.json()).ignored, true);
    assertEquals((await ignoredApi.json()).ignored, true);
    assertEquals((await ignoredGroup.json()).ignored, true);
    assertEquals(sentMessages.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) Deno.env.delete("UAZAPI_BASE_URL");
    else Deno.env.set("UAZAPI_BASE_URL", originalBaseUrl);
    if (originalAdminToken === undefined) Deno.env.delete("UAZAPI_ADMIN_TOKEN");
    else Deno.env.set("UAZAPI_ADMIN_TOKEN", originalAdminToken);
  }
});

Deno.test("POST /webhook Uazapi - retries a failed first-contact attempt within the limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const originalAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");
  let idempotencyStatus = "failed";
  let attemptCount = 1;
  let insertCount = 0;
  let sendCount = 0;

  Deno.env.set("UAZAPI_BASE_URL", "https://api.uazapi.com");
  Deno.env.set("UAZAPI_ADMIN_TOKEN", "test-admin-token");
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";
    if (url.includes("rest/v1/whatsapp_instances")) {
      return new Response(JSON.stringify({ id: "instance-1", tenant_id: "tenant-1", instance_name: "nav_1", instance_token: "token-1", status: "connected" }), { status: 200 });
    }
    if (url.includes("rest/v1/whatsapp_message_idempotency")) {
      if (method === "POST") {
        insertCount++;
        if (insertCount > 1) return new Response(JSON.stringify({ code: "23505" }), { status: 409 });
        return new Response(JSON.stringify({}), { status: 201 });
      }
      if (method === "GET") return new Response(JSON.stringify({ status: idempotencyStatus, attempt_count: attemptCount }), { status: 200 });
      const patchBody = JSON.parse(String(init?.body));
      if (patchBody.status) idempotencyStatus = patchBody.status;
      if (patchBody.attempt_count) attemptCount = patchBody.attempt_count;
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes("rest/v1/rpc/find_or_create_whatsapp_customer")) {
      return new Response(JSON.stringify([{ customer_id: "customer-1", token_acesso: "token-1", created: false }]), { status: 200 });
    }
    if (url.includes("rest/v1/tenants")) return new Response(JSON.stringify({ name: "Barbearia" }), { status: 200 });
    if (url.includes("rest/v1/customers")) return new Response(JSON.stringify({ name: "Cliente" }), { status: 200 });
    return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
  };

  const provider = createProviderStub({
    sendText: () => {
      sendCount++;
      return sendCount === 1 ? Promise.reject(new Error("temporary provider failure")) : Promise.resolve();
    },
  });
  const testHandler = createHandler({ providerFactory: () => provider });
  const request = () => new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "messages",
      token: "token-1",
      data: { messageid: "retry-1", sender: "5511999992222@s.whatsapp.net", chatid: "5511999992222@s.whatsapp.net", senderName: "Cliente" },
    }),
  });

  try {
    const failed = await testHandler(request());
    const retried = await testHandler(request());
    assertEquals(failed.status, 502);
    assertEquals(retried.status, 200);
    assertEquals(sendCount, 2);
    assertEquals(idempotencyStatus, "succeeded");
    assertEquals(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) Deno.env.delete("UAZAPI_BASE_URL");
    else Deno.env.set("UAZAPI_BASE_URL", originalBaseUrl);
    if (originalAdminToken === undefined) Deno.env.delete("UAZAPI_ADMIN_TOKEN");
    else Deno.env.set("UAZAPI_ADMIN_TOKEN", originalAdminToken);
  }
});

Deno.test("POST /send-notification - should format message and send it to VPS", async () => {
  const restoreFetch = setupMockFetch({
    // Mock DB select active instance settings
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: {
        api_key: "mock-instance-key",
        status: "connected",
        send_confirmation: true,
        send_reminders: true,
        send_cancellation: true,
        reminder_hours: 2
      }
    },
    // Mock DB select appointment details
    "rest/v1/appointments": {
      status: 200,
      body: {
        id: "app-123",
        start_time: "2026-07-15T10:00:00Z",
        customers: { name: "Jonathas", phone: "11999998888", token_acesso: "token-abc" },
        professionals: { name: "Guto" },
        services: { name: "Corte e Barba" },
        tenants: { name: "Navalhado Ouro", timezone: "America/Sao_Paulo" }
      }
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
        tenants: { name: "Navalhado Ouro", timezone: "America/Sao_Paulo" }
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

Deno.test("POST /send-test - should authenticate user, verify tenant, call VPS send text and succeed", async () => {
  const restoreFetch = setupMockFetch({
    // Mock obter usuario via Supabase Auth
    "auth/v1/user": {
      status: 200,
      body: { id: "user-123", email: "gerente@email.com" }
    },
    // Mock DB select tenant_id from users
    "rest/v1/users": {
      status: 200,
      body: { tenant_id: "tenant-456", role: "gerente" }
    },
    // Mock DB select evolution_api_instances
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { instance_name: "nav_test", api_key: "mock-instance-key", status: "connected" }
    },
    // Mock VPS send text call
    "mock-vps.com/send/text": {
      status: 200,
      body: { success: true }
    }
  });

  const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/send-test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer mock-user-token",
    },
    body: JSON.stringify({
      tenant_id: "tenant-456",
      number: "11999991111",
      text: "Mensagem de teste"
    })
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.success, true);

  restoreFetch();
});

Deno.test("POST /send-test delegates message delivery through the provider gateway", async () => {
  const providerCalls: Array<Record<string, unknown>> = [];
  const provider = createProviderStub({
    sendText: (input) => {
      providerCalls.push({ operation: "send-text", ...input });
      return Promise.resolve();
    },
  });
  const restoreFetch = setupMockFetch({
    "auth/v1/user": {
      status: 200,
      body: { id: "user-123", email: "gerente@email.com" },
    },
    "rest/v1/users": {
      status: 200,
      body: { tenant_id: "tenant-456", role: "gerente" },
    },
    "rest/v1/evolution_api_instances": {
      status: 200,
      body: { instance_name: "nav_test", api_key: "mock-instance-key", status: "connected" },
    },
  });

  try {
    const testHandler = createHandler({ providerFactory: () => provider });
    const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/send-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock-user-token",
      },
      body: JSON.stringify({
        tenant_id: "tenant-456",
        number: "11999991111",
        text: "Mensagem de teste",
      }),
    });

    const res = await testHandler(req);

    assertEquals(res.status, 200);
    assertEquals(providerCalls, [{
      operation: "send-text",
      instanceName: "nav_test",
      instanceToken: "mock-instance-key",
      number: "5511999991111",
      text: "Mensagem de teste",
    }]);
  } finally {
    restoreFetch();
  }
});

Deno.test("trigger routes reject a blank configured secret before processing", async () => {
  const originalSecret = Deno.env.get("DB_TRIGGER_SECRET");
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  Deno.env.set("DB_TRIGGER_SECRET", "   ");
  globalThis.fetch = (): Promise<Response> => {
    fetchCalls++;
    return Promise.resolve(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  };

  const requests = [
    new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-db-trigger-secret": "   " },
      body: JSON.stringify({
        event: "appointment_created",
        appointment_id: "app-123",
        tenant_id: "tenant-456",
      }),
    }),
    new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/process-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-db-trigger-secret": "   " },
      body: JSON.stringify({}),
    }),
  ];

  try {
    for (const req of requests) {
      const res = await handler(req);
      assertEquals(res.status, 500);
      assertEquals(await res.json(), { error: "Server configuration error" });
    }
    assertEquals(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) Deno.env.delete("DB_TRIGGER_SECRET");
    else Deno.env.set("DB_TRIGGER_SECRET", originalSecret);
  }
});

Deno.test("POST /webhook rejects an unknown instance token without updating state", async () => {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];

  globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes("rest/v1/evolution_api_instances")) {
      const method = init?.method || (input instanceof Request ? input.method : "GET");
      methods.push(method);
      return Promise.resolve(new Response(JSON.stringify(
        method === "GET" ? { message: "No rows found" } : { success: true },
      ), {
        status: method === "GET" ? 406 : 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    return Promise.resolve(new Response(JSON.stringify({ error: "Unexpected request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));
  };

  try {
    const req = new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "Connected",
        instanceToken: "attacker-controlled-token",
        data: { status: "open" },
      }),
    });

    const res = await handler(req);
    assertEquals(res.status, 401);
    assertEquals(await res.json(), { error: "Unauthorized webhook" });
    assertEquals(methods, ["GET"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

type SendTestMockOptions = {
  role?: string;
  sendStatus?: number;
  sendBody?: unknown;
};

const setupSendTestFetch = ({
  role = "gerente",
  sendStatus = 200,
  sendBody = { success: true },
}: SendTestMockOptions = {}) => {
  const originalFetch = globalThis.fetch;
  let sendCalls = 0;

  globalThis.fetch = (input: string | URL | Request): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let status = 200;
    let body: unknown;

    if (urlStr.includes("auth/v1/user")) {
      body = { id: "user-123", email: "user@example.com" };
    } else if (urlStr.includes("rest/v1/users")) {
      body = { tenant_id: "tenant-456", role };
    } else if (urlStr.includes("rest/v1/evolution_api_instances")) {
      body = { instance_name: "nav_test", api_key: "mock-instance-key", status: "connected" };
    } else if (urlStr.includes("mock-vps.com/send/text")) {
      sendCalls++;
      status = sendStatus;
      body = sendBody;
    } else {
      status = 500;
      body = { error: `Unexpected request to ${urlStr}` };
    }

    return Promise.resolve(new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }));
  };

  return {
    get sendCalls() {
      return sendCalls;
    },
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};

const createSendTestRequest = (
  body: unknown = {
    tenant_id: "tenant-456",
    number: "11999991111",
    text: "Mensagem de teste",
  },
  authorization = "Bearer mock-user-token",
) => new Request("https://mock-supabase.co/functions/v1/whatsapp-integration/send-test", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: authorization },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

Deno.test("POST /send-test only permits gerente and proprietario roles", async () => {
  for (const [role, expectedStatus] of [["barbeiro", 403], ["gerente", 200], ["proprietario", 200]] as const) {
    const mock = setupSendTestFetch({ role });
    try {
      const res = await handler(createSendTestRequest());
      assertEquals(res.status, expectedStatus);
      assertEquals(mock.sendCalls, expectedStatus === 200 ? 1 : 0);
    } finally {
      mock.restore();
    }
  }
});

Deno.test("POST /send-test requires a Bearer authorization scheme", async () => {
  const mock = setupSendTestFetch();
  try {
    const res = await handler(createSendTestRequest(undefined, "Basic mock-user-token"));
    assertEquals(res.status, 401);
    assertEquals(mock.sendCalls, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("POST /send-test rejects malformed JSON", async () => {
  const mock = setupSendTestFetch();
  try {
    const res = await handler(createSendTestRequest("{"));
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { error: "Invalid JSON body" });
    assertEquals(mock.sendCalls, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("POST /send-test rejects invalid phone and message values", async () => {
  const invalidBodies = [
    { tenant_id: "tenant-456", number: "not-a-phone", text: "Mensagem" },
    { tenant_id: "tenant-456", number: "11999991111", text: "   " },
    { tenant_id: "tenant-456", number: "11999991111", text: "x".repeat(4097) },
    { tenant_id: 123, number: "11999991111", text: "Mensagem" },
  ];

  for (const body of invalidBodies) {
    const mock = setupSendTestFetch();
    try {
      const res = await handler(createSendTestRequest(body));
      assertEquals(res.status, 400);
      assertEquals(mock.sendCalls, 0);
    } finally {
      mock.restore();
    }
  }
});

Deno.test("POST /send-test does not expose upstream response bodies", async () => {
  const mock = setupSendTestFetch({
    sendStatus: 502,
    sendBody: { error: "apikey=mock-instance-key service_role=mock-service-role-key" },
  });

  try {
    const res = await handler(createSendTestRequest());
    assertEquals(res.status, 502);
    assertEquals(await res.json(), { error: "WhatsApp provider request failed" });
    assertEquals(mock.sendCalls, 1);
  } finally {
    mock.restore();
  }
});

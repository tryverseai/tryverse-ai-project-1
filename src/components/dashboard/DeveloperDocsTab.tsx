import { useState } from "react";
import { Code, Copy, Check, Terminal, Key, Webhook, Package, FlaskConical, Download, FileJson } from "lucide-react";
import { toast } from "sonner";
import { widgetBackendPublicUrl } from "@/lib/backendApi";

const endpoints = [
  {
    method: "POST",
    path: "/api/widget/request",
    description:
      "Generate a virtual try-on from storage paths. Upload images first with POST /api/upload (multipart, same x-api-key) or POST /api/upload/from-url for remote product images.",
    headers: [
      { name: "x-api-key", type: "string", required: true, description: "Your TryVerse API key (tv_live_...)" },
      { name: "Content-Type", type: "string", required: true, description: "application/json" },
    ],
    body: [
      { name: "personImagePath", type: "string", required: true, description: "Path returned from POST /api/upload (type=person)" },
      { name: "productImagePath", type: "string", required: true, description: "Path returned from POST /api/upload (type=product)" },
      { name: "category", type: "string", required: true, description: "clothing, tops, bottoms, dresses, or one-pieces" },
      { name: "productDescription", type: "string", required: false, description: "Optional caption for routing quality" },
    ],
    response: `{
  "success": true,
  "tryonId": "…",
  "status": "completed",
  "resultUrl": "https://…"
}

// Or when jobs are queued:
{
  "success": true,
  "tryonId": "…",
  "status": "queued",
  "pollUrl": "/api/tryon/…",
  "estimatedWaitSeconds": 30
}`,
    errors: [
      { code: "401", description: "Invalid or missing API key" },
      { code: "402", description: "No credits remaining" },
      { code: "403", description: "Domain not authorized or paths do not belong to key owner" },
      { code: "429", description: "Rate limit exceeded (60 req/min)" },
    ],
  },
  {
    method: "GET",
    path: "/api/widget/status/:tryonId",
    description: "Poll try-on status when the request returned queued/processing.",
    headers: [{ name: "x-api-key", type: "string", required: true, description: "Your TryVerse API key" }],
    body: [],
    response: `{
  "tryonId": "…",
  "status": "completed",
  "resultUrl": "https://…",
  "category": "clothing"
}`,
    errors: [
      { code: "401", description: "Invalid API key" },
      { code: "404", description: "Try-on not found" },
    ],
  },
];

const getApiBaseUrl = () => widgetBackendPublicUrl().replace(/\/$/, "");

const curlExample = () => `curl -X POST \\
  '${getApiBaseUrl()}/api/widget/request' \\
  -H 'x-api-key: tv_live_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "personImagePath": "userId/person/photo.jpg",
    "productImagePath": "userId/garment/product.jpg",
    "category": "clothing"
  }'`;

const jsExample = () => `const response = await fetch(
  '${getApiBaseUrl()}/api/widget/request',
  {
    method: 'POST',
    headers: {
      'x-api-key': 'tv_live_your_api_key_here',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personImagePath: 'userId/person/photo.jpg',
      productImagePath: 'userId/garment/product.jpg',
      category: 'clothing',
    }),
  }
);

const data = await response.json();
console.log(data.resultUrl);`;

function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: { title: "TryVerse API", version: "1.0.0" },
    servers: [{ url: getApiBaseUrl() }],
    paths: {
      "/api/widget/request": {
        post: {
          summary: endpoints[0].description,
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["personImagePath", "productImagePath", "category"],
                  properties: {
                    personImagePath: { type: "string" },
                    productImagePath: { type: "string" },
                    category: { type: "string", enum: ["clothing", "tops", "bottoms", "dresses", "one-pieces"] },
                    productDescription: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Try-on created or queued" } },
        },
      },
      "/api/widget/status/{tryonId}": {
        get: {
          summary: endpoints[1].description,
          security: [{ ApiKeyAuth: [] }],
          parameters: [{ name: "tryonId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Try-on status" } },
        },
      },
    },
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" } },
    },
  };
}

function buildPostmanCollection() {
  return {
    info: { name: "TryVerse API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: endpoints.map((ep) => ({
      name: ep.path,
      request: {
        method: ep.method,
        header: ep.headers.map((h) => ({ key: h.name, value: h.name === "x-api-key" ? "{{apiKey}}" : "application/json" })),
        url: { raw: `${getApiBaseUrl()}${ep.path}`, host: [getApiBaseUrl()], path: ep.path.split("/").filter(Boolean) },
        ...(ep.body.length > 0
          ? { body: { mode: "raw", raw: JSON.stringify(Object.fromEntries(ep.body.map((b) => [b.name, ""])), null, 2) } }
          : {}),
      },
    })),
    variable: [{ key: "apiKey", value: "" }],
  };
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DeveloperDocsTab() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(label);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Developer Documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reference for integrating TryVerse directly against the REST API — for engineers, once you're already connected.
        </p>
      </div>

      {/* Auth */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Key className="h-4 w-4" /> Authentication
        </h2>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
          <p className="text-sm text-muted-foreground mb-2">
            All requests require an <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">x-api-key</code> header.
            Never pass the key as a query param — production rejects <code className="text-xs">?api_key=</code>.
          </p>
          <p className="text-sm text-muted-foreground">
            Keys are prefixed <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">tv_live_</code> — manage yours from the Widget tab.
          </p>
        </div>
      </div>

      {/* Code Examples */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4" /> Code examples
        </h2>
        <div className="space-y-4">
          {[{ label: "cURL", code: curlExample() }, { label: "JavaScript", code: jsExample() }].map(({ label, code }) => (
            <div key={label} className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <button onClick={() => copyCode(code, label)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {copiedSnippet === label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSnippet === label ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="p-5 overflow-x-auto text-sm text-foreground font-mono leading-relaxed bg-muted/20">
                <code>{code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Code className="h-4 w-4" /> Endpoints
        </h2>
        <div className="space-y-6">
          {endpoints.map((ep) => (
            <div key={ep.path} className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${ep.method === "POST" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-foreground">{ep.path}</code>
              </div>
              <p className="text-sm text-muted-foreground mb-5">{ep.description}</p>

              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Headers</h4>
              <div className="mb-4 space-y-1">
                {ep.headers.map((h) => (
                  <div key={h.name} className="flex items-center gap-2 text-xs">
                    <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">{h.name}</code>
                    <span className="text-muted-foreground">({h.type})</span>
                    {h.required && <span className="text-destructive font-medium">required</span>}
                    <span className="text-muted-foreground">— {h.description}</span>
                  </div>
                ))}
              </div>

              {ep.body.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Request body</h4>
                  <div className="mb-4 space-y-1">
                    {ep.body.map((b) => (
                      <div key={b.name} className="flex items-center gap-2 text-xs">
                        <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">{b.name}</code>
                        <span className="text-muted-foreground">({b.type})</span>
                        {b.required && <span className="text-destructive font-medium">required</span>}
                        <span className="text-muted-foreground">— {b.description}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Success response</h4>
              <pre className="p-4 rounded-lg bg-muted/30 text-xs font-mono text-foreground overflow-x-auto mb-4">
                <code>{ep.response}</code>
              </pre>

              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Error codes</h4>
              <div className="space-y-1">
                {ep.errors.map((e) => (
                  <div key={e.code} className="flex items-center gap-2 text-xs">
                    <code className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded font-mono">{e.code}</code>
                    <span className="text-muted-foreground">{e.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate limits */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-2">Rate limits</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">60 requests per minute</strong> per API key. Exceeding it returns{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">429</code> with a{" "}
          <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">Retry-After</code> header.
        </p>
      </div>

      {/* Testing tools */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Testing tools
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => downloadJson(buildOpenApiSpec(), "tryverse-openapi.json")}
            className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors text-left"
          >
            <FileJson className="h-5 w-5 text-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">OpenAPI specification</p>
              <p className="text-xs text-muted-foreground">Import into your preferred API client</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground ml-auto" />
          </button>
          <button
            onClick={() => downloadJson(buildPostmanCollection(), "tryverse-postman-collection.json")}
            className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-colors text-left"
          >
            <Package className="h-5 w-5 text-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Postman collection</p>
              <p className="text-xs text-muted-foreground">Both endpoints, ready to import</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground ml-auto" />
          </button>
        </div>
      </div>

      {/* Coming soon — honest, not fabricated */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-dashed border-border/60 text-left opacity-70">
          <div className="flex items-center gap-2 mb-1">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Webhooks</p>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Push notifications for try-on completion instead of polling. Not built yet — poll{" "}
            <code className="text-foreground">GET /api/widget/status/:id</code> for now.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-dashed border-border/60 text-left opacity-70">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Official SDKs</p>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Node.js and Python client libraries. Not published yet — use the REST API directly (see cURL/JS examples above).
          </p>
        </div>
      </div>
    </div>
  );
}

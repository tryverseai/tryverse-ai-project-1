import { useEffect, useState } from "react";
import { Code, Copy, Check, Terminal, Key, Webhook, Package, FlaskConical, Download, FileJson, Globe2, ChevronDown, Rocket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { widgetBackendPublicUrl, listWidgetDomains, addWidgetDomain } from "@/lib/backendApi";

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

const sdkInstallExample = () => `npm install @tryverse/sdk`;

const sdkEnvExample = () => `# .env
TRYVERSE_API_KEY=tv_live_your_api_key_here`;

const sdkUsageExample = () => `import { TryVerse } from "@tryverse/sdk";

const tryverse = new TryVerse(); // reads TRYVERSE_API_KEY automatically

const { resultUrl } = await tryverse.tryOn({
  personImage: shopperPhoto,                 // File, Buffer, or URL
  productImage: "https://yourstore.com/products/denim-jacket.jpg",
  category: "clothing",
});

console.log(resultUrl); // the generated image`;

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

function CodeBlock({ label, code, copiedSnippet, onCopy }: { label: string; code: string; copiedSnippet: string | null; onCopy: (code: string, label: string) => void }) {
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button onClick={() => onCopy(code, label)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {copiedSnippet === label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedSnippet === label ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-sm text-foreground font-mono leading-relaxed bg-muted/20">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DeveloperDocsTab() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [domains, setDomains] = useState<Array<{ domain: string; apiKeyName: string }>>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listWidgetDomains()
      .then((data) => { if (!cancelled) setDomains(data.domains.map((d) => ({ domain: d.domain, apiKeyName: d.apiKeyName }))); })
      .catch(() => { if (!cancelled) setDomains([]); })
      .finally(() => { if (!cancelled) setDomainsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(label);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleAddDomain = async () => {
    const clean = newDomain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!clean) {
      toast.error("Enter a domain like yourshop.com");
      return;
    }
    setAddingDomain(true);
    try {
      await addWidgetDomain(clean);
      toast.success(`${clean} added`);
      setNewDomain("");
      const data = await listWidgetDomains();
      setDomains(data.domains.map((d) => ({ domain: d.domain, apiKeyName: d.apiKeyName })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add domain");
    } finally {
      setAddingDomain(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Developer Documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Install the SDK, add your API key, initialize. That's the whole integration.
        </p>
      </div>

      {/* SDK quick start — the primary, recommended path */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4" /> Quick start with the SDK
        </h2>
        <div className="space-y-4">
          <CodeBlock label="1. Install" code={sdkInstallExample()} copiedSnippet={copiedSnippet} onCopy={copyCode} />
          <CodeBlock label="2. Add your API key" code={sdkEnvExample()} copiedSnippet={copiedSnippet} onCopy={copyCode} />
          <CodeBlock label="3. Initialize and use it" code={sdkUsageExample()} copiedSnippet={copiedSnippet} onCopy={copyCode} />
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          That single <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">tryOn()</code> call
          uploads both images, starts generation, and waits for the result — authentication, retries, and status polling
          all happen inside the SDK. No endpoints, request bodies, or polling loops to write yourself.
        </p>
      </div>

      {/* Auth */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Key className="h-4 w-4" /> Your API key
        </h2>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
          <p className="text-sm text-muted-foreground mb-2">
            Keys are prefixed <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">tv_live_</code> — manage yours from Connect Store.
            The SDK reads it from the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">TRYVERSE_API_KEY</code> environment
            variable automatically; you never attach headers manually.
          </p>
        </div>
      </div>

      {/* Allowed domains */}
      <div className="mb-10">
        <h2 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe2 className="h-4 w-4" /> Allowed domains
        </h2>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
          <p className="text-sm text-muted-foreground mb-4">
            Requests are only accepted from domains listed here. Add the storefront domain(s) this
            integration will run on — e.g. <code className="text-foreground">yourshop.com</code>.
          </p>
          {domainsLoading ? (
            <p className="text-xs text-muted-foreground">Loading domains…</p>
          ) : domains.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 mb-3">
              <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                No domains configured — this key currently accepts requests from <strong>any</strong> website.
                Add your storefront domain below before going live to restrict it.
              </p>
            </div>
          ) : (
            <ul className="space-y-1 mb-4">
              {domains.map((d) => (
                <li key={d.domain} className="text-sm text-foreground font-mono">
                  {d.domain}
                  <span className="text-muted-foreground font-sans text-xs ml-2">({d.apiKeyName})</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="yourshop.com"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") void handleAddDomain(); }}
            />
            <Button type="button" variant="outline" onClick={() => void handleAddDomain()} disabled={addingDomain}>
              {addingDomain ? "Adding…" : "Add domain"}
            </Button>
          </div>
        </div>
      </div>

      {/* Webhooks — honest, not fabricated */}
      <div className="mb-10 p-4 rounded-xl border border-dashed border-border/60 text-left opacity-70">
        <div className="flex items-center gap-2 mb-1">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Webhooks</p>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Push notifications for try-on completion instead of polling. Not built yet — the SDK's{" "}
          <code className="text-foreground">onProgress</code> callback covers most cases in the meantime.
        </p>
      </div>

      {/* Advanced REST reference — present, but clearly secondary to the SDK */}
      <div className="border-t border-border/50 pt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Code className="h-4 w-4" /> Advanced REST API Reference
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              For advanced use cases that need low-level access. The SDK is the recommended integration path — most
              developers won't need this section.
            </p>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="mt-6 space-y-10">
            {/* Code Examples */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Raw request examples
              </h3>
              <div className="space-y-4">
                <CodeBlock label="cURL" code={curlExample()} copiedSnippet={copiedSnippet} onCopy={copyCode} />
                <CodeBlock label="JavaScript (fetch)" code={jsExample()} copiedSnippet={copiedSnippet} onCopy={copyCode} />
              </div>
            </div>

            {/* Endpoints */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Code className="h-4 w-4" /> Endpoints
              </h3>
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
            <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
              <h3 className="font-display text-sm font-semibold text-foreground mb-2">Rate limits</h3>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">60 requests per minute</strong> per API key. Exceeding it returns{" "}
                <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">429</code> with a{" "}
                <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">Retry-After</code> header.
                The SDK does not currently auto-retry on 429 — catch <code className="text-foreground">TryVerseError</code> and back off.
              </p>
            </div>

            {/* Testing tools */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Testing tools
              </h3>
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
          </div>
        )}
      </div>
    </div>
  );
}

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { Code, Copy, Check, Terminal, Key, Image, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const endpoints = [
  {
    method: "POST",
    path: "/functions/v1/generate-tryon",
    description: "Generate a virtual try-on image by combining a product image with a person image.",
    headers: [
      { name: "x-api-key", type: "string", required: true, description: "Your TryVerse API key (tv_live_...)" },
      { name: "Content-Type", type: "string", required: true, description: "application/json" },
    ],
    body: [
      { name: "productImage", type: "string", required: true, description: "URL of the product image (clothing/jewelry/glasses)" },
      { name: "personImage", type: "string", required: true, description: "URL of the person/model image" },
      { name: "category", type: "string", required: true, description: "Product category: 'clothing', 'jewelry', or 'glasses'" },
    ],
    response: `{
  "success": true,
  "resultImage": "https://replicate.delivery/...",
  "tryonId": "uuid",
  "creditsRemaining": 95
}`,
    errors: [
      { code: "401", description: "Invalid or missing API key" },
      { code: "402", description: "No credits remaining" },
      { code: "403", description: "Domain not authorized" },
      { code: "429", description: "Rate limit exceeded (60 req/min)" },
    ],
  },
  {
    method: "GET",
    path: "/functions/v1/check-credits",
    description: "Check remaining credits and widget activation status for an API key.",
    headers: [
      { name: "x-api-key", type: "string", required: true, description: "Your TryVerse API key" },
    ],
    body: [],
    response: `{
  "creditsRemaining": 95,
  "widgetActivated": true,
  "brandName": "Acme Fashion"
}`,
    errors: [
      { code: "401", description: "Invalid API key" },
    ],
  },
];

const getApiBaseUrl = () =>
  (import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co").replace(/\/$/, "");

const curlExample = () => `curl -X POST \\
  '${getApiBaseUrl()}/functions/v1/generate-tryon' \\
  -H 'x-api-key: tv_live_your_api_key_here' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "productImage": "https://example.com/shirt.jpg",
    "personImage": "https://example.com/model.jpg",
    "category": "clothing"
  }'`;

const jsExample = () => `const response = await fetch(
  '${getApiBaseUrl()}/functions/v1/generate-tryon',
  {
    method: 'POST',
    headers: {
      'x-api-key': 'tv_live_your_api_key_here',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productImage: 'https://example.com/shirt.jpg',
      personImage: 'https://example.com/model.jpg',
      category: 'clothing',
    }),
  }
);

const data = await response.json();
console.log(data.resultImage);`;

const ApiDocs = () => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyCode = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(label);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Documentation</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">API Reference</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Integrate TryVerse AI try-on into your application with our REST API.
            </p>
          </motion.div>

          {/* Quick Start */}
          <div className="mb-12">
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5" /> Quick Start
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Get your API key</p>
                  <p className="text-xs text-muted-foreground">Generate an API key from your Dashboard → API Keys tab</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Whitelist your domain</p>
                  <p className="text-xs text-muted-foreground">Add your website domain in Dashboard → Settings for production use</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Make your first request</p>
                  <p className="text-xs text-muted-foreground">Send a POST to the generate-tryon endpoint with product and person images</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auth */}
          <div className="mb-12">
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Key className="h-5 w-5" /> Authentication
            </h2>
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
              <p className="text-sm text-muted-foreground mb-3">
                All API requests require an <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">x-api-key</code> header with your TryVerse API key.
                Do not pass the key in the URL (<code className="text-xs">?api_key=</code>) — in production the API rejects query-string keys (they leak in logs and referrers).
              </p>
              <p className="text-sm text-muted-foreground">
                API keys are prefixed with <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">tv_live_</code> and can be managed from your dashboard.
              </p>
            </div>
          </div>

          {/* Code Examples */}
          <div className="mb-12">
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5" /> Code Examples
            </h2>
            <div className="space-y-4">
              {[
                { label: "cURL", code: curlExample() },
                { label: "JavaScript", code: jsExample() },
              ].map(({ label, code }) => (
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
          <div className="mb-12">
            <h2 className="font-display text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Code className="h-5 w-5" /> Endpoints
            </h2>
            <div className="space-y-8">
              {endpoints.map((ep) => (
                <div key={ep.path} className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${ep.method === 'POST' ? 'bg-foreground text-background' : 'bg-muted text-foreground'}`}>
                      {ep.method}
                    </span>
                    <code className="text-sm font-mono text-foreground">{ep.path}</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">{ep.description}</p>

                  {/* Headers */}
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Headers</h4>
                  <div className="mb-4 space-y-1">
                    {ep.headers.map(h => (
                      <div key={h.name} className="flex items-center gap-2 text-xs">
                        <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">{h.name}</code>
                        <span className="text-muted-foreground">({h.type})</span>
                        {h.required && <span className="text-destructive font-medium">required</span>}
                        <span className="text-muted-foreground">— {h.description}</span>
                      </div>
                    ))}
                  </div>

                  {/* Body */}
                  {ep.body.length > 0 && (
                    <>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Request Body</h4>
                      <div className="mb-4 space-y-1">
                        {ep.body.map(b => (
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

                  {/* Response */}
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Success Response</h4>
                  <pre className="p-4 rounded-lg bg-muted/30 text-xs font-mono text-foreground overflow-x-auto mb-4">
                    <code>{ep.response}</code>
                  </pre>

                  {/* Errors */}
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Error Codes</h4>
                  <div className="space-y-1">
                    {ep.errors.map(e => (
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

          {/* Rate Limits */}
          <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-foreground mb-3">Rate Limits</h2>
            <p className="text-sm text-muted-foreground">
              API requests are limited to <strong className="text-foreground">60 requests per minute</strong> per API key. 
              Exceeding this limit returns a <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">429</code> status with a <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">Retry-After</code> header.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApiDocs;

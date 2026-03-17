import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { FileText, Code, CheckCircle, AlertCircle } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const APP_URL = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

const WidgetGuide = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Documentation
                </p>
                <h1 className="font-display text-3xl font-bold text-foreground">
                  Widget Integration Guide
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground">
              Embed AI-powered virtual try-on on your e-commerce site in minutes.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-10 prose prose-neutral dark:prose-invert max-w-none"
          >
            {/* Prerequisites */}
            <section className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> Prerequisites
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 text-sm">
                <li>TryVerse account with an active plan</li>
                <li>API key (Dashboard → API Keys)</li>
                <li>Domain added to allowed list (Dashboard → Widget → add your domain)</li>
              </ul>
            </section>

            {/* Quick Start */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Quick Start</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-foreground mb-2">1. Add your domain</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Before embedding, add your website domain in the Dashboard under{" "}
                    <strong className="text-foreground">Widget → Allowed Domains</strong>. Example:{" "}
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">yourshop.com</code> or{" "}
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">www.yourshop.com</code>
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-2">2. Popup mode (button trigger)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add a &quot;Try It On&quot; button to your product page:
                  </p>
                  <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono text-foreground">
{`<script src="${APP_URL}/tryverse-widget.js"></script>
<button onclick="TryVerse.open({
  apiKey: 'YOUR_API_KEY',
  productImage: 'https://yoursite.com/product-image.jpg',
  category: 'clothing',
  backendUrl: '${BACKEND_URL}'
})">
  Try It On
</button>`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-2">3. Embed mode (inline component)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Embed the try-on UI directly in your page:
                  </p>
                  <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono text-foreground">
{`<div id="tryverse-embed"></div>
<script src="${APP_URL}/tryverse-widget.js"></script>
<script>
  TryVerse.embed({
    apiKey: 'YOUR_API_KEY',
    productImage: 'https://yoursite.com/product-image.jpg',
    category: 'clothing',
    container: 'tryverse-embed',
    backendUrl: '${BACKEND_URL}'
  });
</script>`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Configuration */}
            <section className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Code className="h-5 w-5" /> Configuration
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-foreground">Option</th>
                      <th className="text-left py-2 font-medium text-foreground">Required</th>
                      <th className="text-left py-2 font-medium text-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50"><td className="py-2"><code className="text-foreground">apiKey</code></td><td>Yes</td><td>Your TryVerse API key</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2"><code className="text-foreground">productImage</code></td><td>Yes</td><td>URL of the product image, or storage path</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2"><code className="text-foreground">category</code></td><td>No</td><td>clothing, bags, or glasses (default: clothing)</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2"><code className="text-foreground">backendUrl</code></td><td>Yes</td><td>Your TryVerse API base URL</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2"><code className="text-foreground">container</code></td><td>Embed only</td><td>DOM element ID for inline display</td></tr>
                    <tr><td className="py-2"><code className="text-foreground">productDescription</code></td><td>No</td><td>Optional text to help the AI (e.g. &quot;blue denim jacket&quot;)</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dynamic product images */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Dynamic product images</h2>
              <p className="text-sm text-muted-foreground mb-3">
                For product pages where the image changes, use a selector or data attribute:
              </p>
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono text-foreground">
{`<img data-product-image src="https://yoursite.com/shirt.jpg" />
<button onclick="TryVerse.open({
  apiKey: 'YOUR_API_KEY',
  productImage: document.querySelector('[data-product-image]').src,
  category: 'clothing',
  backendUrl: '${BACKEND_URL}'
})">
  Try It On
</button>`}
              </pre>
            </section>

            {/* Global config */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Global config</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Set defaults once to avoid repeating options:
              </p>
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono text-foreground">
{`TryVerse.config({
  apiKey: 'YOUR_API_KEY',
  backendUrl: '${BACKEND_URL}',
  category: 'clothing'
});

// Then call with minimal options
TryVerse.open({ productImage: 'https://...' });`}
              </pre>
            </section>

            {/* Supported categories */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Supported categories</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li><strong className="text-foreground">clothing</strong> – Tops, dresses, jackets, outerwear</li>
                <li><strong className="text-foreground">bags</strong> – Handbags, backpacks, clutches</li>
                <li><strong className="text-foreground">glasses</strong> – Sunglasses, prescription glasses, eyewear</li>
              </ul>
            </section>

            {/* CORS */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">CORS and domains</h2>
              <p className="text-sm text-muted-foreground">
                The API validates the request origin. Ensure your domain is in the allowed list. Contact support if you need <code className="px-1.5 py-0.5 bg-muted rounded">*</code> (all domains) for development.
              </p>
            </section>

            {/* Troubleshooting */}
            <section className="bg-card rounded-xl border border-border/50 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Troubleshooting
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-foreground">Error</th>
                      <th className="text-left py-2 font-medium text-foreground">Solution</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50"><td className="py-2">Invalid signature</td><td>Check API key and backend URL</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2">Domain not authorized</td><td>Add your domain in Dashboard → Widget</td></tr>
                    <tr className="border-b border-border/50"><td className="py-2">Insufficient credits</td><td>Upgrade plan or wait for monthly reset</td></tr>
                    <tr><td className="py-2">Upload failed</td><td>Ensure product image URL is accessible (no auth, CORS)</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WidgetGuide;

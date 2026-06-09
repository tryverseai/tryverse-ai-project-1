import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { submitDemoBooking } from "@/lib/backendApi";

const PLATFORMS = ["Shopify", "WooCommerce", "Wix", "Squarespace", "Other"] as const;
const VISITOR_RANGES = ["Under 10k", "10k-50k", "50k-100k", "100k+"] as const;

const BookDemo = () => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [storePlatform, setStorePlatform] = useState<string>("");
  const [monthlyVisitors, setMonthlyVisitors] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !brandName.trim() || !storePlatform || !monthlyVisitors) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await submitDemoBooking({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        brand_name: brandName.trim(),
        store_platform: storePlatform,
        monthly_visitors: monthlyVisitors,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Please try again or email info@tryverseai.com.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <CheckCircle2 className="h-14 w-14 text-foreground mx-auto mb-4" aria-hidden />
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">Request received</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Thank you! A member of the TryVerse team will reach out within 24 hours to schedule your private
            walkthrough.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-8"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to home
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground mb-3">Book a Demo</h1>
        <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
          See exactly how TryVerse works for your store. We&apos;ll walk you through the widget, dashboard, and
          integration options.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="demo-full-name">Full Name</Label>
            <Input
              id="demo-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">Work Email</Label>
            <Input
              id="demo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-brand">Brand / Company Name</Label>
            <Input
              id="demo-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              autoComplete="organization"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-platform">Store Platform</Label>
            <Select value={storePlatform || undefined} onValueChange={setStorePlatform} required>
              <SelectTrigger id="demo-platform">
                <SelectValue placeholder="Select platform…" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-visitors">Monthly Website Visitors</Label>
            <Select value={monthlyVisitors || undefined} onValueChange={setMonthlyVisitors} required>
              <SelectTrigger id="demo-visitors">
                <SelectValue placeholder="Select range…" />
              </SelectTrigger>
              <SelectContent>
                {VISITOR_RANGES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-message">Message (optional)</Label>
            <Textarea
              id="demo-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              placeholder="Tell us about your store or what you'd like to see in the demo…"
            />
          </div>
          <Button type="submit" className="w-full gradient-primary text-primary-foreground h-12" disabled={submitting}>
            {submitting ? "Submitting…" : "Book My Demo"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BookDemo;

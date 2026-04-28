import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitSupportContact } from "@/lib/backendApi";

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL?.trim();

function splitName(full: string): { first_name: string; last_name: string } {
  const t = full.trim();
  if (!t) return { first_name: "-", last_name: "-" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "-" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

const BookDemo = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !lookingFor.trim()) {
      toast({ title: "Missing fields", description: "Please fill in name, email, and what you’re looking to solve.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { first_name, last_name } = splitName(name);
      await submitSupportContact({
        first_name,
        last_name,
        company_name: company.trim() || null,
        email: email.trim().toLowerCase(),
        category: "demo_request",
        subject: "Book a demo — TryVerse",
        message: lookingFor.trim(),
      });
      toast({ title: "Request sent", description: "We’ll follow up shortly." });
      setName("");
      setCompany("");
      setEmail("");
      setLookingFor("");
    } catch (err) {
      toast({
        title: "Could not send",
        description: err instanceof Error ? err.message : "Please try again or email support.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-8"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground mb-3">See TryVerse in Action</h1>
        <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
          Request a private walkthrough for your brand or team.
        </p>

        {CALENDLY_URL ? (
          <div className="rounded-xl border border-border overflow-hidden bg-card min-h-[700px]">
            <iframe
              title="Schedule a demo"
              src={CALENDLY_URL}
              className="w-full min-h-[700px] border-0"
            />
          </div>
        ) : (
          <form onSubmit={handleFallbackSubmit} className="space-y-6 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="demo-name">Name</Label>
              <Input id="demo-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-company">Company</Label>
              <Input id="demo-company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email</Label>
              <Input id="demo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-looking">What are you looking to solve?</Label>
              <Textarea
                id="demo-looking"
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                className="min-h-[120px]"
                required
              />
            </div>
            <Button type="submit" className="gradient-primary text-primary-foreground" disabled={submitting}>
              {submitting ? "Sending…" : "Submit request"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default BookDemo;

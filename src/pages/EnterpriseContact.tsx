import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { submitEnterpriseInquiry } from "@/lib/backendApi";

const FEATURE_OPTIONS = [
  "Virtual Try-On",
  "Outfit Visualization",
  "AI Model Generation",
  "AI Photoshoot",
  "AI Video",
  "API / SDK integration",
  "Analytics",
  "Custom infrastructure / SLA",
] as const;

const EnterpriseContact = () => {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [catalogueSize, setCatalogueSize] = useState("");
  const [monthlyVolume, setMonthlyVolume] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [apiSdkRequirements, setApiSdkRequirements] = useState("");
  const [infrastructureRequirements, setInfrastructureRequirements] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleFeature = (f: string) => {
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !companyName.trim()) {
      toast({ title: "Missing fields", description: "Name, email, and company are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await submitEnterpriseInquiry({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        company_name: companyName.trim(),
        company_website: companyWebsite.trim() || undefined,
        role: role.trim() || undefined,
        country: country.trim() || undefined,
        catalogue_size: catalogueSize.trim() || undefined,
        monthly_generation_volume: monthlyVolume.trim() || undefined,
        features_interested: features.length ? features : undefined,
        api_sdk_requirements: apiSdkRequirements.trim() || undefined,
        infrastructure_requirements: infrastructureRequirements.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Please try again or email sales@tryverseai.com.",
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
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">Thanks — we'll be in touch</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            A member of our team will follow up within one business day to discuss your requirements.
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
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-8"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to pricing
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground mb-3">Let's talk</h1>
        <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
          Enterprise AI infrastructure for fashion visualization — custom models, dedicated infrastructure, and
          SLAs built around your catalogue and volume. Tell us about your needs and we'll follow up directly.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="ent-name">Name</Label>
              <Input id="ent-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-email">Work email</Label>
              <Input id="ent-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="ent-company">Company</Label>
              <Input id="ent-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-website">Company website</Label>
              <Input id="ent-website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="ent-role">Role</Label>
              <Input id="ent-role" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-country">Country</Label>
              <Input id="ent-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="ent-catalogue">Estimated catalogue size</Label>
              <Input id="ent-catalogue" value={catalogueSize} onChange={(e) => setCatalogueSize(e.target.value)} placeholder="e.g. 5,000 SKUs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-volume">Monthly expected generation volume</Label>
              <Input id="ent-volume" value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value)} placeholder="e.g. 50,000 / month" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Features interested in</Label>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
              {FEATURE_OPTIONS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={features.includes(f)} onCheckedChange={() => toggleFeature(f)} />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ent-api">API / SDK integration requirements</Label>
            <Textarea
              id="ent-api"
              value={apiSdkRequirements}
              onChange={(e) => setApiSdkRequirements(e.target.value)}
              className="min-h-[80px]"
              placeholder="Existing stack, endpoints you need, expected call volume…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ent-infra">Infrastructure requirements</Label>
            <Textarea
              id="ent-infra"
              value={infrastructureRequirements}
              onChange={(e) => setInfrastructureRequirements(e.target.value)}
              className="min-h-[80px]"
              placeholder="Uptime/SLA needs, data residency, dedicated capacity…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ent-message">Message</Label>
            <Textarea
              id="ent-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              placeholder="Anything else we should know?"
            />
          </div>

          <Button type="submit" className="w-full gradient-primary text-primary-foreground h-12" disabled={submitting}>
            {submitting ? "Submitting…" : "Talk to sales"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EnterpriseContact;

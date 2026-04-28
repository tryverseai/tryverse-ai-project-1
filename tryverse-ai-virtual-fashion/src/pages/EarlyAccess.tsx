import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { submitEarlyAccessRequest, submitIndividualEarlyAccessRequest } from "@/lib/backendApi";
import { inviteSignupEnabled, FEATURE_FLAGS } from "@/lib/featureFlags";
import { X } from "lucide-react";

const ROLES = [
  { value: "founder", label: "Founder / Co-Founder" },
  { value: "ceo", label: "CEO / Director" },
  { value: "ecommerce", label: "E-commerce Manager" },
  { value: "marketing", label: "Marketing Manager" },
  { value: "operations", label: "Operations Manager" },
  { value: "other", label: "Other" },
] as const;

const PLATFORMS = [
  "Shopify",
  "WooCommerce",
  "Wix",
  "Squarespace",
  "BigCommerce",
  "Magento",
  "Custom built",
  "I don't know",
  "Other",
] as const;

const PRODUCT_RANGES = [
  { value: "lt_50", label: "Less than 50" },
  { value: "50_200", label: "50 – 200" },
  { value: "200_1000", label: "200 – 1,000" },
  { value: "1000_plus", label: "1,000+" },
] as const;

const REVENUE_RANGES = [
  { value: "lt_5k", label: "Under $5,000" },
  { value: "5k_20k", label: "$5,000 – $20,000" },
  { value: "20k_100k", label: "$20,000 – $100,000" },
  { value: "100k_plus", label: "$100,000+" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

const RETURN_RATES = [
  { value: "lt_5", label: "Less than 5%" },
  { value: "5_15", label: "5% – 15%" },
  { value: "15_30", label: "15% – 30%" },
  { value: "over_30", label: "Over 30%" },
  { value: "no_track", label: "I don’t currently track this" },
] as const;

const RETURN_REASONS = [
  { value: "fit", label: "Wrong size / didn’t fit as expected" },
  { value: "photos", label: "Looked different than on the site" },
  { value: "bracketing", label: "Customers order multiple sizes to try" },
  { value: "quality", label: "Quality didn’t match expectations" },
  { value: "unknown", label: "We don’t have clear data on this" },
] as const;

const CONFIDENCE_LEVELS = [
  { value: "high", label: "Pretty confident — returns are manageable" },
  { value: "mixed", label: "Somewhat — returns or hesitation still hurt us" },
  { value: "low", label: "Not confident — we see it in returns or abandoned carts" },
  { value: "unsure", label: "Not sure — we don’t measure this well" },
] as const;

const TRIED_OPTIONS = [
  { id: "size_guides", label: "Size guides" },
  { id: "descriptions", label: "Rich product descriptions" },
  { id: "360", label: "360° or extra photography" },
  { id: "video", label: "Video / lifestyle content" },
  { id: "other_tryon", label: "Another virtual try-on tool" },
  { id: "nothing_yet", label: "Haven’t tried much yet" },
] as const;

const MUST_HAVE_OPTIONS = [
  { id: "integration", label: "Easy integration with our platform" },
  { id: "existing_images", label: "Works with our current product images" },
  { id: "performance", label: "Doesn’t slow down our storefront" },
  { id: "accuracy", label: "Realistic results customers will trust" },
  { id: "pricing", label: "Pricing that makes sense at our scale" },
  { id: "support", label: "Hands-on onboarding & support" },
] as const;

const TIMELINES = [
  { value: "urgent", label: "Soon — actively looking" },
  { value: "3mo", label: "Within 3 months" },
  { value: "6mo", label: "Within 6 months" },
  { value: "exploring", label: "Just exploring for now" },
] as const;

const HEARD_ABOUT = [
  { value: "instagram_tiktok", label: "Instagram / TikTok" },
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google", label: "Google search" },
  { value: "referral", label: "Referred by someone" },
  { value: "other", label: "Other" },
] as const;

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

type AccessFlow = "pick" | "business" | "individual";

const EarlyAccess = () => {
  const premiumWaitlistCopy = FEATURE_FLAGS.INVITE_ONLY_MODE;
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flow, setFlow] = useState<AccessFlow>("pick");
  const [submissionKind, setSubmissionKind] = useState<"business" | "individual">("business");
  const [pickSelection, setPickSelection] = useState<string>("");
  const [indFirstName, setIndFirstName] = useState("");
  const [indEmail, setIndEmail] = useState("");
  const [indInterests, setIndInterests] = useState("");
  const [indTimeline, setIndTimeline] = useState<string>("");
  const [indHeardAbout, setIndHeardAbout] = useState<string>("");

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [role, setRole] = useState<string>("");
  const [roleOther, setRoleOther] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [platform, setPlatform] = useState<string>("");

  const [productRange, setProductRange] = useState<string>("");
  const [monthlyRevenue, setMonthlyRevenue] = useState<string>("");
  const [returnRate, setReturnRate] = useState<string>("");

  const [topReturnReason, setTopReturnReason] = useState<string>("");
  const [customerConfidence, setCustomerConfidence] = useState<string>("");
  const [tried, setTried] = useState<string[]>([]);

  const [mustHave, setMustHave] = useState<string[]>([]);
  const [biggestChallenge, setBiggestChallenge] = useState("");
  const [timeline, setTimeline] = useState<string>("");
  const [heardAbout, setHeardAbout] = useState<string>("");
  const [priorNotes, setPriorNotes] = useState("");

  const toggleMulti = (list: string[], id: string, setList: (v: string[]) => void) => {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else setList([...list, id]);
  };

  const handlePickContinue = () => {
    if (pickSelection === "business") setFlow("business");
    else if (pickSelection === "individual") setFlow("individual");
    else toast.error("Please select what you are registering as.");
  };

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indFirstName.trim() || !indEmail.trim() || !indInterests.trim() || !indTimeline) {
      toast.error("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitIndividualEarlyAccessRequest({
        first_name: indFirstName.trim(),
        email: indEmail.trim().toLowerCase(),
        what_interests_you: indInterests.trim(),
        timeline: indTimeline,
        heard_about: indHeardAbout || null,
      });
      setSubmissionKind("individual");
      setSubmitted(true);
      toast.success(
        result.emailSent === false
          ? "Request received. We could not send the confirmation email yet — check spam, or ask the team to verify RESEND_API_KEY (backend) and AUTH_RESEND_KEY (Convex) at resend.com/api-keys."
          : "Request sent — check your inbox."
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing =
      !firstName.trim() ||
      !email.trim() ||
      !brandName.trim() ||
      !role ||
      (role === "other" && !roleOther.trim()) ||
      !websiteUrl.trim() ||
      !platform ||
      !productRange ||
      !monthlyRevenue ||
      !returnRate ||
      !topReturnReason ||
      !customerConfidence ||
      !timeline;
    if (missing) {
      toast.error("Please complete all required fields.");
      return;
    }
    if (tried.length === 0) {
      toast.error("Please select at least one option under “What you’ve tried”.");
      return;
    }
    if (mustHave.length === 0) {
      toast.error("Please select at least one “must-have” for a try-on tool.");
      return;
    }

    setSubmitting(true);
    try {
      const roleValue = role === "other" ? `Other: ${roleOther.trim()}` : role;

      const result = await submitEarlyAccessRequest({
        first_name: firstName.trim(),
        email: email.trim().toLowerCase(),
        brand_name: brandName.trim(),
        role: roleValue,
        website_url: websiteUrl.trim(),
        platform,
        product_range: productRange,
        monthly_revenue: monthlyRevenue,
        return_rate: returnRate,
        top_return_reason: topReturnReason,
        customer_confidence: customerConfidence,
        tried_solutions: tried,
        must_have_features: mustHave,
        biggest_challenge: biggestChallenge.trim(),
        timeline,
        heard_about: heardAbout || null,
        prior_solution_notes: priorNotes.trim() || null,
      });

      setSubmissionKind("business");
      setSubmitted(true);
      toast.success(
        result.emailSent === false
          ? "Application received. Confirmation email was not delivered — verify RESEND_API_KEY in backend/.env and AUTH_RESEND_KEY in Convex (same active key from resend.com/api-keys), then verify your domain or use Resend’s test inbox rules."
          : "Application sent — check your inbox for a confirmation."
      );
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Blurred page backdrop (visible behind modal) */}
      <div
        className="fixed inset-0 z-40 bg-gradient-to-b from-muted/80 via-background/90 to-background pointer-events-none"
        aria-hidden
      />
      <div className="fixed inset-0 z-40 backdrop-blur-sm pointer-events-none" aria-hidden />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-black/45 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] z-50 w-[calc(100vw-1.5rem)] max-w-xl max-h-[min(90vh,880px)] translate-x-[-50%] translate-y-[-50%]",
              "rounded-2xl border border-border/80 bg-card shadow-2xl p-6 sm:p-8 overflow-y-auto",
              "data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95 duration-200"
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {premiumWaitlistCopy
                ? "TryVerse — Apply for early access"
                : "TryVerse — Get early access for fashion brands"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {premiumWaitlistCopy
                ? "Founding access: request early access as a business or individual. Applications are reviewed within 48 hours."
                : "Waitlist and interest forms: choose business or individual, then complete the matching questionnaire."}
            </DialogPrimitive.Description>

            <DialogPrimitive.Close
              className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 hover:opacity-100 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

            {submitted ? (
              <div className="text-center py-6 px-2 space-y-4">
                <p className="font-display text-2xl font-semibold text-foreground">
                  Thank you for applying for early access.
                </p>
                <p className="text-4xl" aria-hidden>
                  🎉
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                  {submissionKind === "individual"
                    ? premiumWaitlistCopy
                      ? "Thank you. Applications are reviewed within 48 hours; we’ll reach out with next steps."
                      : "Thanks — we’ll be in touch about personal virtual try-on access when spots open up."
                    : premiumWaitlistCopy
                      ? "Thank you. Applications are reviewed within 48 hours. Our team will follow up to align on fit and rollout."
                      : "Thanks again — we’ll follow up to learn more about your store and share how TryVerse can support your goals."}
                </p>
                <Button className="mt-4 gradient-primary text-primary-foreground" onClick={() => handleOpenChange(false)}>
                  Back to home
                </Button>
                <div className="text-xs text-muted-foreground pt-2 space-y-1">
                  <p>
                    <Link to="/auth" className="underline hover:text-foreground">
                      Already have an account? Log in
                    </Link>
                  </p>
                  {inviteSignupEnabled && !premiumWaitlistCopy && (
                    <p>
                      Approved for a brand workspace?{" "}
                      <Link to="/auth?signup=business" className="underline hover:text-foreground">
                        Business sign up
                      </Link>
                      .
                    </p>
                  )}
                  {premiumWaitlistCopy && (
                    <p className="text-muted-foreground">
                      Invited brands receive a private onboarding link by email.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pr-1">
                {flow === "pick" && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                        {premiumWaitlistCopy ? "TryVerse — Founding access" : "TryVerse — Early access"}
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                        {premiumWaitlistCopy ? "Apply for Early Access" : "How are you joining?"}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {premiumWaitlistCopy
                          ? "Request founding member access. Applications are reviewed within 48 hours."
                          : "Choose one to continue — you&apos;ll get the right form."}
                      </p>
                    </div>
                    <Field label="Registering as *" htmlFor="ea-register-as">
                      <Select value={pickSelection} onValueChange={setPickSelection}>
                        <SelectTrigger id="ea-register-as">
                          <SelectValue placeholder="As a business or as an individual" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business">As a business (brand or store)</SelectItem>
                          <SelectItem value="individual">As an individual (personal try-on)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        className="flex-1 gradient-primary text-primary-foreground h-11"
                        onClick={handlePickContinue}
                      >
                        Next
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Already have an account?{" "}
                      <Link to="/auth" className="underline hover:text-foreground">
                        Log in
                      </Link>
                    </p>
                  </div>
                )}

                {flow === "individual" && (
                  <form onSubmit={handleSubmitIndividual} className="space-y-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                        {premiumWaitlistCopy ? "TryVerse — Founding access" : "TryVerse — Interest list"}
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                        Personal virtual try-on
                      </h2>
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {premiumWaitlistCopy
                          ? "Request founding member access. Applications are reviewed within 48 hours."
                          : "Tell us a bit about you — we&apos;ll reach out when we open more personal spots."}
                      </p>
                    </div>
                    <Field label="First name *" htmlFor="ind-first">
                      <Input
                        id="ind-first"
                        required
                        value={indFirstName}
                        onChange={(e) => setIndFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label="Email *" htmlFor="ind-email">
                      <Input
                        id="ind-email"
                        type="email"
                        required
                        value={indEmail}
                        onChange={(e) => setIndEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="What are you interested in? *" htmlFor="ind-interests">
                      <Textarea
                        id="ind-interests"
                        required
                        rows={4}
                        placeholder="e.g. Trying outfits before I buy, special events, experimenting with looks…"
                        value={indInterests}
                        onChange={(e) => setIndInterests(e.target.value)}
                      />
                    </Field>
                    <Field label="When are you hoping to try TryVerse? *">
                      <Select value={indTimeline} onValueChange={setIndTimeline}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMELINES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="How did you hear about us? (optional)">
                      <Select
                        value={indHeardAbout || "none"}
                        onValueChange={(v) => setIndHeardAbout(v === "none" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Prefer not to say</SelectItem>
                          {HEARD_ABOUT.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 gradient-primary text-primary-foreground h-11"
                      >
                        {submitting ? "Sending…" : "Submit interest"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setFlow("pick")}>
                        Back
                      </Button>
                    </div>
                  </form>
                )}

                {flow === "business" && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      {premiumWaitlistCopy ? "TryVerse — Founding access" : "TryVerse — Early access"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">For fashion brands & retailers</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                      {premiumWaitlistCopy ? "Apply for Early Access" : "Early access for fashion brands"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {premiumWaitlistCopy
                        ? "Request founding member access. Applications are reviewed within 48 hours."
                        : "Help us understand your needs so we can prioritize early access."}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                      About your business
                    </h3>
                    <Field label="First name *" htmlFor="ea-first">
                      <Input
                        id="ea-first"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label="Work email *" htmlFor="ea-email">
                      <Input
                        id="ea-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Brand / company name *" htmlFor="ea-brand">
                      <Input
                        id="ea-brand"
                        required
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                      />
                    </Field>
                    <Field label="Your role *" htmlFor="ea-role">
                      <Select
                        value={role}
                        onValueChange={(v) => {
                          setRole(v);
                          if (v !== "other") setRoleOther("");
                        }}
                      >
                        <SelectTrigger id="ea-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {role === "other" && (
                        <div className="pt-2">
                          <Label htmlFor="ea-role-other" className="sr-only">
                            Describe your role
                          </Label>
                          <Input
                            id="ea-role-other"
                            required
                            placeholder="Your title or role"
                            value={roleOther}
                            onChange={(e) => setRoleOther(e.target.value)}
                          />
                        </div>
                      )}
                    </Field>
                    <Field label="Store website *" htmlFor="ea-web">
                      <Input
                        id="ea-web"
                        type="url"
                        required
                        placeholder="https://"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                      />
                    </Field>
                    <div className="space-y-2">
                      <Label htmlFor="ea-plat" className="text-xs font-medium text-foreground">
                        Store platform *{" "}
                        <span className="font-normal text-muted-foreground">(where your shop is hosted)</span>
                      </Label>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        This is the e-commerce system that powers your website — e.g. Shopify, WooCommerce, or a
                        custom site. Pick the closest match so we know how integrations might work.
                      </p>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger id="ea-plat" className="max-w-full">
                          <SelectValue placeholder="Select platform" />
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
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                      Store snapshot
                    </h3>
                    <Field label="How many products do you sell online? *">
                      <Select value={productRange} onValueChange={setProductRange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_RANGES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Average monthly online revenue *">
                      <Select value={monthlyRevenue} onValueChange={setMonthlyRevenue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {REVENUE_RANGES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Current monthly return rate *">
                      <Select value={returnRate} onValueChange={setReturnRate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {RETURN_RATES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                      What you’re seeing
                    </h3>
                    <Field label="Main reason customers return *">
                      <Select value={topReturnReason} onValueChange={setTopReturnReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {RETURN_REASONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="How confident are shoppers when buying? *">
                      <Select value={customerConfidence} onValueChange={setCustomerConfidence}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFIDENCE_LEVELS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">What have you tried already? * (select all that apply)</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TRIED_OPTIONS.map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={tried.includes(opt.id)}
                              onCheckedChange={() => toggleMulti(tried, opt.id, setTried)}
                            />
                            <span className="text-xs leading-snug">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                      What you need from try-on
                    </h3>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Must-haves for you * (select all that apply)</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {MUST_HAVE_OPTIONS.map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={mustHave.includes(opt.id)}
                              onCheckedChange={() => toggleMulti(mustHave, opt.id, setMustHave)}
                            />
                            <span className="text-xs leading-snug">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Field label="Biggest challenge selling fashion online right now *" htmlFor="ea-challenge">
                      <Textarea
                        id="ea-challenge"
                        required
                        rows={3}
                        placeholder="Sizing, photography, returns, tech stack…"
                        value={biggestChallenge}
                        onChange={(e) => setBiggestChallenge(e.target.value)}
                      />
                    </Field>
                    <Field label="If something didn’t work before, what was missing? (optional)" htmlFor="ea-prior">
                      <Textarea
                        id="ea-prior"
                        rows={2}
                        placeholder="Briefly — what you tried and why it didn’t stick"
                        value={priorNotes}
                        onChange={(e) => setPriorNotes(e.target.value)}
                      />
                    </Field>
                    <Field label="When are you looking to implement? *">
                      <Select value={timeline} onValueChange={setTimeline}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMELINES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="How did you hear about TryVerse? (optional)">
                      <Select value={heardAbout || "none"} onValueChange={(v) => setHeardAbout(v === "none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Prefer not to say</SelectItem>
                          {HEARD_ABOUT.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 gradient-primary text-primary-foreground h-11"
                    >
                      {submitting ? "Sending…" : "Request early access"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    <Link to="/auth" className="underline hover:text-foreground">
                      Already have an account? Log in
                    </Link>
                  </p>
                  <div className="flex justify-center pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFlow("pick")}>
                      ← Change registration type
                    </Button>
                  </div>
                </form>
                )}
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export default EarlyAccess;

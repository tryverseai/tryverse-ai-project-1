import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Send, Building2, CheckCircle, ArrowLeft, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categories = [
  "Technical Support",
  "Integration Help",
  "Account & Billing",
  "Partnership Inquiry",
  "General Feedback",
  "Other",
];

const Support = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("support_requests").insert({
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      company_name: companyName || null,
      email,
      phone_number: phone,
      category,
      subject,
      message,
    });
    setLoading(false);
    if (error) {
      toast({
        title: "Failed to submit",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSubmitted(true);
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setCategory("");
      setSubject("");
      setMessage("");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Contact Us — TryVerse AI</title>
          <meta name="description" content="Thank you for contacting TryVerse AI. We'll get back to you soon." />
        </Helmet>
        <Navbar />
        <main className="pt-[var(--navbar-height)] pb-24 min-h-[60vh] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md mx-auto px-6"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Message received</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for reaching out. Our team will get back to you within 1–2 business days.
            </p>
            <Link to="/support">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Submit another request
              </Button>
            </Link>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Contact Us — TryVerse AI</title>
        <meta name="description" content="Contact TryVerse AI. Submit a request and our team will respond promptly." />
      </Helmet>
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Contact Us
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Submit the form below and our team will respond promptly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 shadow-card"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="firstName"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="lastName"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Your company (optional)"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                    Phone Number <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
                  Category <span className="text-destructive">*</span>
                </label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger id="category" className="h-11">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                  Subject <span className="text-destructive">*</span>
                </label>
                <Input
                  id="subject"
                  placeholder="Brief summary of your request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                  Message <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea
                    id="message"
                    placeholder="Describe your question or issue in detail..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full min-h-[160px] px-4 py-3 pl-10 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground shadow-soft h-12"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <>
                    Submit <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Support;

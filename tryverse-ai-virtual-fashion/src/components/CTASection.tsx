import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function CTASection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-black p-12 md:p-20 text-center"
        >
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground mb-5">
              Ready for Your Brand — or for You?
            </h2>
            <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto mb-8">
              {FEATURE_FLAGS.INVITE_ONLY_MODE
                ? "TryVerse is onboarding founding brands and teams by application. Request early access for your workspace, or book a private walkthrough."
                : "Start with 20 free AI try-ons on a personal account — no credit card. Running a store? Join the waitlist or sign up when your workspace is approved — same core AI for shoppers and for commerce teams."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              {FEATURE_FLAGS.INVITE_ONLY_MODE ? (
                <>
                  <Link to="/waitlist">
                    <Button size="lg" className="bg-background text-foreground hover:bg-background/90 text-base h-12 px-8 shadow-lg">
                      Join Waitlist
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/book-demo">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base h-12"
                    >
                      Book a Demo
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button size="lg" className="bg-background text-foreground hover:bg-background/90 text-base h-12 px-8 shadow-lg">
                      Sign up
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/early-access">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base h-12"
                    >
                      Join waitlist
                    </Button>
                  </Link>
                </>
              )}
              <Link to="/about">
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base h-12">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

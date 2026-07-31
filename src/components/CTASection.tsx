import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl bg-black p-12 md:p-20 text-center"
        >
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground mb-5">
              Ready to Transform Your Brand&apos;s Shopping Experience?
            </h2>
            <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto mb-8">
              TryVerse is now open for self-serve signup. Create your account and start embedding AI virtual try-on
              on your storefront in minutes — no waitlist required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              <Link to="/auth?signup=business">
                <Button
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/90 text-base h-12 px-8 shadow-lg transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/book-demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base h-12 transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Book a Demo for Enterprise
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

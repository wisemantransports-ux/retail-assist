import Link from "next/link";
import Hero from "@/marketing/components/Hero";
import Features from "@/marketing/components/Features";
import Pricing from "@/marketing/components/Pricing";
import Testimonials from "@/marketing/components/Testimonials";
import CTA from "@/marketing/components/CTA";
import Footer from "@/marketing/components/Footer";
import CommentBox from "@/components/CommentBox";

export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <CTA />
      <section className="py-12">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-xl font-semibold mb-2">Try it live</h3>
          <p className="text-muted mb-4">Leave a public comment and our AI bot will reply privately to you.</p>
          <CommentBox agentId="demo_agent" />
        </div>
      </section>
      <Footer />
    </main>
  );
}
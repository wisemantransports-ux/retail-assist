"use client";

import Link from "next/link";

const footerLinks = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "Security", href: "#" },
    { name: "Roadmap", href: "#" },
  ],
  Company: [
    { name: "About", href: "#" },
    { name: "Blog", href: "#" },
    { name: "Careers", href: "#" },
    { name: "Contact", href: "mailto:support@samuel.dev" },
  ],
  Legal: [
    { name: "Privacy", href: "#" },
    { name: "Terms", href: "#" },
    { name: "Cookies", href: "#" },
    { name: "Compliance", href: "#" },
  ],
  Developers: [
    { name: "API Docs", href: "#" },
    { name: "Integrations", href: "#" },
    { name: "SDKs", href: "#" },
    { name: "Support", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-card-bg/50 border-t border-card-border py-16">
      <div className="container-max">
        <div className="grid md:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Samuel</h3>
            <p className="text-muted">
              AI-powered customer automation for modern businesses.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-card-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-muted text-sm">
          <p>&copy; 2024 Samuel Marketplace. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

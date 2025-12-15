"use client";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "CEO, TechStore",
    quote:
      "Samuel's AI agents cut our customer support costs by 60%. Our team can focus on strategy while AI handles routine inquiries.",
    avatar: "SC",
  },
  {
    name: "Marcus Johnson",
    role: "Founder, EcomHub",
    quote:
      "The setup was incredibly easy. In 30 minutes, we had AI agents live on Instagram and Messenger. Game changer for our business.",
    avatar: "MJ",
  },
  {
    name: "Elena Rodriguez",
    role: "Operations Manager, RetailCo",
    quote:
      "The analytics dashboard helped us understand customer patterns. Conversion rates improved 35% within the first month.",
    avatar: "ER",
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 bg-card-bg/30">
      <div className="container-max">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Trusted by Innovative Businesses
          </h2>
          <p className="text-muted text-lg">Join thousands of companies automating customer conversations</p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="card">
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ★
                  </span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-lg mb-6 italic">"{testimonial.quote}"</p>

              {/* Author */}
              <div className="flex items-center gap-4 pt-6 border-t border-card-border">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

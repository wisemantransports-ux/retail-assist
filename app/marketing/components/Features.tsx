"use client";

const features = [
  {
    icon: "💬",
    title: "Multi-Channel Automation",
    description:
      "Deploy AI agents on Messenger, Instagram DM, website chat, and more. Reach customers everywhere.",
  },
  {
    icon: "🤖",
    title: "Custom AI Personalities",
    description:
      "Create unlimited AI agents with your unique system prompts, tone, and business rules.",
  },
  {
    icon: "⚡",
    title: "Powered by GPT-4",
    description:
      "Leverage cutting-edge OpenAI models for intelligent, context-aware responses.",
  },
  {
    icon: "📊",
    title: "Real-Time Analytics",
    description: "Track conversations, customer satisfaction, and agent performance.",
  },
  {
    icon: "🔐",
    title: "Enterprise Security",
    description:
      "API keys, role-based access, and compliance with industry standards.",
  },
  {
    icon: "🎨",
    title: "White-Label Ready",
    description: "Brand it as your own with custom domains and colors.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-card-bg/30">
      <div className="container-max">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Powerful Features for Modern Businesses
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Everything you need to automate customer conversations at scale.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card hover:border-primary transition-colors group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

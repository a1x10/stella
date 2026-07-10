"use client";

import { useState, useEffect } from "react";

const features = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "AI Agent",
    desc: "Read, create, edit files; run shell commands; search code",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "100+ Commands",
    desc: "/help, /model, /plan, /commit, /exec, /open, /tv, /docker",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "20+ Models",
    desc: "Free defaults (MiMo, DeepSeek), plus GPT, Claude, Gemini",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Computer Control",
    desc: "Screenshot, volume, brightness, WiFi, notifications",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    title: "Server Management",
    desc: "SSH, Docker, PM2, ports, firewall",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    title: "Smart Home",
    desc: "Sony TV, HDMI-CEC, Yeelight, Chromecast, Wake-on-LAN",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Office Automation",
    desc: "PowerPoint, Word, Excel via COM",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
    title: "App Control",
    desc: "Focus windows, type text, hotkeys, screenshots",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Antivirus",
    desc: "Built-in scanner with 100+ signatures",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Ollama local models", "Basic commands", "Community support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["20+ AI models", "All 100+ commands", "Smart home control", "Office automation", "Priority support"],
    cta: "Coming Soon",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    features: ["Everything in Pro", "Custom integrations", "Dedicated support", "SLA guarantee", "On-premise option"],
    cta: "Coming Soon",
    popular: false,
  },
];

const stats = [
  { value: "100+", label: "Commands" },
  { value: "20+", label: "AI Models" },
  { value: "100+", label: "Signatures" },
  { value: "24/7", label: "Always On" },
];

export default function SalesPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const fullText = "stella -p 'fix the bug in utils.ts'";

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#22c55e] text-lg font-mono">Loading Stella...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f8fafc] selection:bg-[#22c55e]/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#22c55e] rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">Stella Coder</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[#94a3b8] hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-[#94a3b8] hover:text-white transition-colors">Pricing</a>
              <a href="https://www.npmjs.com/package/stella-coder" className="text-[#94a3b8] hover:text-white transition-colors">npm</a>
              <a href="https://github.com" className="text-[#94a3b8] hover:text-white transition-colors">GitHub</a>
            </div>
            <a
              href="#pricing"
              className="px-4 py-2 bg-[#22c55e] text-black font-semibold rounded-lg hover:bg-[#16a34a] transition-colors cursor-pointer"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#22c55e]/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-8">
            <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
            <span className="text-sm text-[#94a3b8]">Now available on npm</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-white via-white to-[#94a3b8] bg-clip-text text-transparent">
              Stella
            </span>
            <span className="text-[#22c55e]"> Coder</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-[#94a3b8] mb-8 max-w-3xl mx-auto">
            AI coding agent with computer control, smart home, Office automation, and antivirus
          </p>

          {/* Terminal Demo */}
          <div className="max-w-2xl mx-auto mb-10 bg-[#111118] rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-[#22c55e]/5">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#16161f] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <div className="w-3 h-3 rounded-full bg-[#eab308]" />
              <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="ml-4 text-xs text-[#64748b] font-mono">Terminal</span>
            </div>
            <div className="p-4 font-mono text-sm">
              <div className="flex items-center">
                <span className="text-[#22c55e] mr-2">$</span>
                <span className="text-[#e2e8f0]">{typedText}</span>
                <span className={`w-2 h-5 bg-[#22c55e] ml-0.5 ${showCursor ? "opacity-100" : "opacity-0"} transition-opacity`} />
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="#pricing"
              className="px-8 py-4 bg-[#22c55e] text-black font-semibold rounded-xl text-lg hover:bg-[#16a34a] transition-colors cursor-pointer"
            >
              Get Started Free
            </a>
            <a
              href="#features"
              className="px-8 py-4 border border-white/20 rounded-xl font-semibold text-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              Learn More
            </a>
          </div>

          {/* Install Command */}
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <span className="text-[#64748b] font-mono text-sm">$</span>
            <code className="text-[#22c55e] font-mono text-sm">npm install -g stella-coder</code>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[#22c55e] mb-2">{stat.value}</div>
                <div className="text-[#64748b]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything you need
            </h2>
            <p className="text-[#64748b] text-lg max-w-2xl mx-auto">
              One terminal to rule them all. AI-powered coding, computer control, smart home, and more.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group p-6 bg-[#111118] rounded-2xl border border-white/5 hover:border-[#22c55e]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#22c55e]/5"
              >
                <div className="w-14 h-14 bg-[#22c55e]/10 rounded-xl flex items-center justify-center text-[#22c55e] mb-4 group-hover:bg-[#22c55e]/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-[#64748b]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Demo Section */}
      <section className="py-24 px-4 bg-[#0d0d14]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              See it in action
            </h2>
            <p className="text-[#64748b] text-lg">
              Watch Stella code in real-time
            </p>
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#16161f] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <div className="w-3 h-3 rounded-full bg-[#eab308]" />
              <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="ml-4 text-xs text-[#64748b] font-mono">stella-cli</span>
            </div>
            <div className="p-6 font-mono text-sm space-y-2">
              <div className="text-[#64748b]">$ stella</div>
              <div className="text-[#22c55e]">✓ Ollama found! (3 models)</div>
              <div className="text-[#e2e8f0]">  [1] codellama:7b (3.8GB)</div>
              <div className="text-[#e2e8f0]">  [2] deepseek-coder:6.7b (3.5GB)</div>
              <div className="text-[#e2e8f0]">  [3] llama2:7b (3.8GB)</div>
              <div className="text-[#64748b] mt-4">$ stella -p &quot;fix the bug in utils.ts&quot;</div>
              <div className="text-[#22c55e]">✓ Found bug in line 42</div>
              <div className="text-[#22c55e]">✓ Fixed: null check added</div>
              <div className="text-[#22c55e]">✓ File saved: utils.ts</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple pricing
            </h2>
            <p className="text-[#64748b] text-lg">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border ${
                  plan.popular
                    ? "bg-[#111118] border-[#22c55e]/50 shadow-lg shadow-[#22c55e]/10"
                    : "bg-[#111118] border-white/5"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#22c55e] text-black text-sm font-semibold rounded-full">
                    POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-[#64748b]">{plan.period}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[#cbd5e1]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-xl font-semibold transition-all cursor-pointer ${
                    plan.popular
                      ? "bg-[#22c55e] text-black hover:bg-[#16a34a]"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                  disabled={plan.cta === "Coming Soon"}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 bg-gradient-to-br from-[#111118] to-[#0d0d14] rounded-3xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#22c55e]/10 rounded-full blur-[100px]" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to code smarter?
              </h2>
              <p className="text-[#64748b] text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of developers using Stella to write better code faster.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <a
                  href="#pricing"
                  className="px-8 py-4 bg-[#22c55e] text-black font-semibold rounded-xl text-lg hover:bg-[#16a34a] transition-colors cursor-pointer"
                >
                  Get Started Free
                </a>
                <a
                  href="https://www.npmjs.com/package/stella-coder"
                  className="px-8 py-4 border border-white/20 rounded-xl font-semibold text-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  View on npm
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Stay updated</h2>
          <p className="text-[#64748b] mb-8">
            Get notified when new features drop
          </p>
          {subscribed ? (
            <div className="p-6 bg-[#22c55e]/10 rounded-2xl border border-[#22c55e]/30">
              <p className="text-[#22c55e] text-lg">Thanks for subscribing!</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-4 flex-col sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-6 py-4 bg-[#111118] border border-white/10 rounded-xl focus:outline-none focus:border-[#22c55e] transition-colors text-white placeholder:text-[#64748b]"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-[#22c55e] text-black rounded-xl font-semibold hover:bg-[#16a34a] transition-colors whitespace-nowrap cursor-pointer"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#22c55e] rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">Stella Coder</span>
            </div>
            <div className="flex gap-6 text-[#64748b]">
              <a href="https://www.npmjs.com/package/stella-coder" className="hover:text-white transition-colors">npm</a>
              <a href="https://github.com" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Docs</a>
            </div>
            <p className="text-[#475569] text-sm">
              powered by codex alex
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

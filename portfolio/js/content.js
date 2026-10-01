// ─────────────────────────────────────────────────────────────
// All portfolio content lives here. Edit this file to make the
// site yours — no HTML changes needed.
//
// ⚠ PLACEHOLDER CONTENT: apart from the SalesDW project (this
// repository), the stats, projects, testimonials and email below
// are made-up examples. Replace them with your real details
// before publishing.
// ─────────────────────────────────────────────────────────────
window.PORTFOLIO = {
  name: "Khalid Noah",
  initials: "KN",
  role: "Data Engineer & Full-Stack Developer",
  roles: ["Data Engineer", "Full-Stack Developer", "BI Developer", "Cloud Builder"],
  location: "Available worldwide · Remote",
  email: "hello@yourdomain.com",
  resumeUrl: "#",
  headline: ["I build data products", "that ship & scale."],
  intro:
    "I design warehouses, ETL pipelines and the apps on top of them — turning messy business data into dashboards and tools that teams actually use.",
  socials: [
    { label: "GitHub", url: "https://github.com/e2su" },
    { label: "LinkedIn", url: "#" },
    { label: "Email", url: "mailto:hello@yourdomain.com" },
  ],

  // PLACEHOLDER numbers — replace with your own
  stats: [
    { value: 5, suffix: "+", label: "Years building" },
    { value: 40, suffix: "+", label: "Projects shipped" },
    { value: 12, suffix: "M", label: "Rows loaded daily" },
    { value: 99, suffix: "%", label: "Pipeline uptime" },
  ],

  services: [
    {
      icon: "database",
      title: "Data Warehousing",
      text: "Star-schema warehouses in PostgreSQL with SCD2 dimensions, curated marts and a reporting layer analysts trust.",
      size: "wide",
    },
    {
      icon: "flow",
      title: "ETL Pipelines",
      text: "Python pipelines that survive schema drift, late data and new sources without code changes.",
    },
    {
      icon: "chart",
      title: "BI & Dashboards",
      text: "Power BI models and dashboards that answer the questions leadership actually asks.",
    },
    {
      icon: "code",
      title: "Web Apps & APIs",
      text: "FastAPI back-ends and React front-ends — typed, tested and fast.",
      size: "wide",
    },
    {
      icon: "cloud",
      title: "Cloud & DevOps",
      text: "Docker, Terraform and Azure infrastructure that's reproducible from a single command.",
      size: "full",
    },
  ],

  projects: [
    {
      title: "SalesDW Analytics Platform",
      category: "Data",
      year: "2026",
      text: "End-to-end sales platform: auto-detecting ETL, PostgreSQL star schema, REST ingest API and Power BI dashboards on Azure IaaS.",
      tags: ["Python", "PostgreSQL", "Power BI", "Terraform"],
      url: "https://github.com/e2su/business-management-project",
      accent: 0,
    },
    {
      title: "Realtime Ops Dashboard",
      category: "Web",
      year: "2025",
      text: "Live KPI wall for a retail chain with websocket updates, role-based views and drill-down to the transaction.",
      tags: ["React", "TypeScript", "FastAPI"],
      url: "#",
      accent: 1,
    },
    {
      title: "Inventory Forecasting",
      category: "Data",
      year: "2025",
      text: "Demand forecasts per store and SKU that cut stock-outs and overstock across 120 locations.",
      tags: ["pandas", "NumPy", "Docker"],
      url: "#",
      accent: 2,
    },
    {
      title: "Infra-as-Code Starter",
      category: "Cloud",
      year: "2024",
      text: "One-command Azure environments: VM, networking, secrets and monitoring, all in Terraform modules.",
      tags: ["Terraform", "Linux", "Kubernetes"],
      url: "#",
      accent: 0,
    },
    {
      title: "Client Portal",
      category: "Web",
      year: "2024",
      text: "Self-service portal for invoices, orders and support tickets with SSO and audit logs.",
      tags: ["Next.js", "Tailwind CSS", "MySQL"],
      url: "#",
      accent: 1,
    },
    {
      title: "Ingest Gateway",
      category: "Cloud",
      year: "2023",
      text: "Webhook gateway that validates, queues and lands events from 30+ SaaS tools into the warehouse.",
      tags: ["Node.js", "Docker", "PostgreSQL"],
      url: "#",
      accent: 2,
    },
  ],

  process: [
    { step: "01", title: "Discover", text: "We map the questions, the sources and what 'done' looks like." },
    { step: "02", title: "Build", text: "Short cycles, working software every week, nothing hidden." },
    { step: "03", title: "Ship & support", text: "Production rollout, docs, monitoring and a handover your team owns." },
  ],

  // PLACEHOLDER quotes — replace with real ones (or remove the section)
  testimonials: [
    {
      quote: "Our month-end reporting went from three days of spreadsheets to a dashboard that refreshes itself.",
      name: "Sara M.",
      role: "Head of Finance, Retail Co.",
    },
    {
      quote: "Rare mix of solid engineering and product sense. Every feature landed with tests and docs.",
      name: "Daniel R.",
      role: "CTO, SaaS startup",
    },
    {
      quote: "New data sources used to take weeks. Now they just show up in the warehouse.",
      name: "Lina K.",
      role: "BI Lead, Logistics",
    },
  ],

  faq: [
    { q: "Are you available for freelance work?", a: "Yes — I take on a small number of projects each quarter, from short audits to multi-month builds." },
    { q: "What does a typical engagement look like?", a: "A short discovery call, a written plan with milestones, then weekly demos until launch." },
    { q: "Can you work with our existing stack?", a: "Almost certainly. I've worked across Postgres, MySQL, Azure, AWS, Power BI and most modern web stacks." },
    { q: "Do you offer support after launch?", a: "Yes, with monthly retainers for monitoring, fixes and new features." },
  ],
};

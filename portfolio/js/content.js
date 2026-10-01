// ─────────────────────────────────────────────────────────────
// All portfolio content lives here. Edit this file to update the
// site — no HTML changes needed.
//
// Every fact below comes from the public repositories at
// github.com/e2su. Fields marked TODO are still missing; the page
// hides anything that's left empty.
// ─────────────────────────────────────────────────────────────
window.PORTFOLIO = {
  name: "Khalid Alghanemy",
  initials: "KA",
  role: "Computer Engineer · Data & AI",
  headline: ["I turn raw data", "into working systems."],
  // Typed one after another in the hero: "I build …"
  roles: [
    "real-time data pipelines",
    "data warehouses",
    "ML-powered intrusion detection",
    "neural networks with PyTorch",
  ],
  intro:
    "Computer Engineering graduate from King Khalid University. I build streaming data pipelines, data warehouses and machine-learning systems — from an AI intrusion detector on a Raspberry Pi to a Kafka + Spark market-data platform on AWS.",
  about:
    "I like projects that go all the way from raw data to something people can use: live market prices flowing through Kafka and Spark into a cloud warehouse and dashboard, sales files landing in a star-schema warehouse for Power BI, and network traffic classified in real time on a Raspberry Pi. I write tests, set up CI and document every project so someone else can run it.",

  email: "",     // TODO: your contact email (the contact form appears once this is set)
  location: "",  // TODO: e.g. "Abha, Saudi Arabia"
  resumeUrl: "", // TODO: link to your CV (PDF)
  socials: [
    { label: "GitHub", url: "https://github.com/e2su" },
    // TODO: { label: "LinkedIn", url: "https://www.linkedin.com/in/…" },
  ],

  // Real numbers taken from the projects
  stats: [
    { value: 78, suffix: "", label: "Traffic features per flow analysed by EdgeGuard" },
    { value: 5, suffix: "", label: "Traffic classes detected (benign + 4 attack types)" },
    { value: 40, suffix: "+", label: "DAX measures in the SalesDW Power BI model" },
    { value: 15, suffix: "", label: "ML notebooks from KAUST AI training" },
  ],

  // Hero animation: the MARKET_OS data flow and real log lines from the project READMEs
  pipeline: [
    { label: "Binance", logo: null },
    { label: "Kafka", logo: "Apache Kafka" },
    { label: "Spark", logo: "Apache Spark" },
    { label: "S3 · Parquet", logo: "Apache Parquet" },
    { label: "Redshift", logo: null },
    { label: "Streamlit", logo: "Streamlit" },
  ],
  terminal: [
    { cmd: "python -m producers.binance_producer" },
    { out: "Connected to Binance! Streaming BTC prices..." },
    { out: "Sent 100 trades — latest BTCUSDT @ $64592.01" },
    { cmd: "python -m processing.stream_processor" },
    { out: "✅ Stream processor running — writing to S3..." },
    { cmd: "python -m processing.redshift_loader" },
    { out: "📦 crypto_trades: 12 new file(s)" },
    { out: "📊 Crypto trades: 38,388 | Stock records: 22" },
    { cmd: "streamlit run dashboard/app.py" },
  ],

  services: [
    {
      icon: "flow",
      title: "Streaming data pipelines",
      text: "Kafka producers, PySpark structured streaming, Parquet on S3 and incremental loads into Redshift or PostgreSQL.",
      size: "wide",
    },
    {
      icon: "database",
      title: "Data warehousing & BI",
      text: "Star schemas with SCD type 2, idempotent ETL and Power BI models with DAX.",
    },
    {
      icon: "brain",
      title: "Machine learning",
      text: "scikit-learn, XGBoost, CatBoost and PyTorch — from EDA to evaluated models.",
    },
    {
      icon: "shield",
      title: "Network security & edge AI",
      text: "Snort 3 rules plus a Random Forest classifier running live on a Raspberry Pi 5.",
      size: "wide",
    },
    {
      icon: "cloud",
      title: "Cloud & DevOps",
      text: "Docker Compose stacks, Terraform on Azure, AWS (S3, Redshift, EC2, IAM) and GitHub Actions CI.",
      size: "full",
    },
  ],

  projects: [
    {
      title: "MARKET_OS — Real-Time Market Data Pipeline",
      category: "Data",
      year: "2026",
      text: "Streams live Bitcoin trades from Binance and stock quotes from Alpha Vantage through Kafka and PySpark into an S3 data lake and Redshift, flags price spikes against the previous batch's median, and shows it all on a live Streamlit dashboard.",
      highlights: ["Deployable 24/7 on AWS EC2 with Docker Compose", "pytest + GitHub Actions CI"],
      tags: ["Python", "Apache Kafka", "Apache Spark", "AWS", "Streamlit", "Docker"],
      url: "https://github.com/e2su/market-pipline",
      accent: 0,
    },
    {
      title: "EdgeGuard — AI Intrusion Detection System",
      category: "AI & Security",
      year: "2026",
      text: "Graduation project: a hybrid IDS on a Raspberry Pi 5 that pairs Snort 3 with a Random Forest trained on CICIDS2017. It classifies traffic as benign, port scan, DoS, brute force or web attack, scores the risk and streams it to a Flask dashboard.",
      highlights: ["78 flow features per prediction", "Live demo against an nmap SYN scan"],
      tags: ["Python", "scikit-learn", "Snort", "Flask", "Raspberry Pi"],
      url: "https://github.com/e2su/graduation-project",
      accent: 1,
    },
    {
      title: "SalesDW — Sales Analytics Platform",
      category: "Data",
      year: "2026",
      text: "A self-hosted sales data platform: an ETL that auto-detects file types and column names, a PostgreSQL star schema with SCD type 2, a FastAPI ingest API and a Power BI reporting layer, deployable to an Azure VM with Terraform.",
      highlights: ["40+ DAX measures", "Unit + end-to-end tests in CI"],
      tags: ["Python", "PostgreSQL", "FastAPI", "Power BI", "Terraform", "Docker"],
      url: "https://github.com/e2su/business-management-project",
      accent: 2,
    },
    {
      title: "KAUST AI — Machine Learning Labs",
      category: "AI & Security",
      year: "2026",
      text: "Fifteen notebooks covering EDA, regression, classification, neural networks and unsupervised learning on real Kaggle datasets.",
      highlights: ["R² 0.975 on advertising-sales regression", "94.5% accuracy on MNIST with PyTorch"],
      tags: ["PyTorch", "scikit-learn", "pandas", "Jupyter", "Kaggle"],
      url: "https://github.com/e2su/KAUST-Ai-project",
      accent: 0,
    },
    {
      title: "This Portfolio",
      category: "Web",
      year: "2026",
      text: "A hand-built single-page site with a Pac-Man style canvas background where tech logos chase each other through a maze. No frameworks, no build step.",
      highlights: ["Vanilla JavaScript + Canvas", "Respects reduced-motion settings"],
      tags: ["HTML5", "CSS", "JavaScript"],
      url: "https://github.com/e2su/business-management-project",
      accent: 1,
    },
  ],

  journey: [
    {
      title: "B.Sc. Computer Engineering",
      place: "King Khalid University",
      period: "", // TODO: e.g. "2021 – 2026"
      text: "Graduation project: EdgeGuard, an AI-powered intrusion detection system on a Raspberry Pi 5.",
    },
    {
      title: "AI training program", // TODO: official program name
      place: "KAUST",
      period: "", // TODO: dates
      text: "Hands-on labs in scikit-learn, gradient boosting and PyTorch: tabular, image and unsupervised learning.",
    },
  ],

  // How I build — each point is visible in the repositories
  process: [
    { step: "01", title: "Map the data flow", text: "Every project starts with an architecture diagram, from source to dashboard." },
    { step: "02", title: "Test it", text: "pytest suites and GitHub Actions CI on the data projects, including end-to-end runs against real PostgreSQL." },
    { step: "03", title: "Document & deploy", text: "Step-by-step READMEs, Docker Compose stacks, a 24/7 AWS deployment guide and Terraform for Azure." },
  ],
};

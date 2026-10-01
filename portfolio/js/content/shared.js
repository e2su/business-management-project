// ─────────────────────────────────────────────────────────────
// Facts that are the same in every language: links, media,
// tech stacks and numbers. The words live in en.js and ar.js,
// matched up by `id`.
//
// Sources: Khalid's CV and the public repositories at github.com/e2su.
// ─────────────────────────────────────────────────────────────
window.PORTFOLIO_CONTENT = window.PORTFOLIO_CONTENT || {};
window.PORTFOLIO_CONTENT.shared = {
  name: { en: "Khalid Alghanemy", ar: "خالد الغانمي" },
  initials: "KA",
  githubUser: "e2su",
  email: "khalidnoah.works@gmail.com",
  resumeUrl: "assets/Khalid_Alghanemy_CV.pdf",
  socials: [
    { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/khalid-alghanemy-06158228a/" },
    { id: "github", label: "GitHub", url: "https://github.com/e2su" },
  ],

  // value + optional decimals/suffix; labels are in en.js / ar.js
  stats: [
    { id: "gpa", value: 4.11, decimals: 2, suffix: "/5" },
    { id: "flows", value: 2.8, decimals: 1, suffix: "M" },
    { id: "trades", value: 206842 },
    { id: "certs", value: 4 },
  ],

  // Hero animation: the MARKET_OS data flow + real log lines from its README
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

  projects: [
    {
      id: "market-os",
      category: "data",
      year: "2026",
      tags: ["Python", "Apache Kafka", "Apache Spark", "AWS S3", "Redshift", "Streamlit", "Docker"],
      url: "https://github.com/e2su/market-pipline",
      media: { type: "image", src: "assets/market-os-dashboard.png" },
      architecture: ["Binance + Alpha Vantage", "Kafka", "PySpark", "S3 (Parquet)", "Redshift", "Streamlit"],
      accent: 0,
    },
    {
      id: "edgeguard",
      category: "ai",
      year: "2025 – 2026",
      tags: ["Python", "scikit-learn", "Snort", "Flask", "Raspberry Pi"],
      url: "https://github.com/e2su/graduation-project",
      media: { type: "youtube", id: "-rD9pBQAUyg" },
      architecture: ["Network traffic", "Snort 3", "78 flow features", "Random Forest", "Risk engine", "Flask dashboard"],
      accent: 1,
    },
    {
      id: "salesdw",
      category: "data",
      year: "2026",
      tags: ["Python", "PostgreSQL", "FastAPI", "Power BI", "Terraform", "Docker"],
      url: "https://github.com/e2su/business-management-project",
      media: null,
      architecture: ["CSV / Excel / JSON / API", "ETL", "Staging", "Star schema (SCD2)", "Marts", "Power BI"],
      accent: 2,
    },
    {
      id: "kaust",
      category: "ai",
      year: "2025",
      tags: ["PyTorch", "scikit-learn", "pandas", "Jupyter", "Kaggle"],
      url: "https://github.com/e2su/KAUST-Ai-project",
      media: null,
      architecture: ["Kaggle data", "EDA", "Preprocessing", "Models", "Evaluation"],
      accent: 0,
    },
    {
      id: "portfolio",
      category: "web",
      year: "2026",
      tags: ["HTML5", "CSS", "JavaScript"],
      url: "https://github.com/e2su/business-management-project",
      media: null,
      architecture: ["content (EN / AR)", "Renderer", "Canvas animation", "GitHub API"],
      accent: 1,
    },
  ],

  // EdgeGuard's real risk map, from inference_engine.py
  edgeguard: {
    classes: [
      { id: "BENIGN", score: 5, level: "normal" },
      { id: "PortScan", score: 25, level: "low", snortRule: 'alert tcp any any -> any any (msg:"Port Scan Activity (TCP SYN) Detected!"; flags:S; sid:1000002;)' },
      { id: "Brute Force", score: 50, level: "medium" },
      { id: "DoS", score: 75, level: "high" },
      { id: "Web Attack", score: 95, level: "critical" },
    ],
    lowConfidenceThreshold: 0.6, // below this, the engine escalates the risk to 95
  },

  certifications: [
    { id: "ibm-de", issuer: "IBM", badge: "IBM" },
    { id: "pl300", issuer: "Microsoft", badge: "PL-300" },
    { id: "kaust", issuer: "KAUST", badge: "AI" },
    { id: "sce", issuer: "SCE", badge: "SCE" },
  ],
};

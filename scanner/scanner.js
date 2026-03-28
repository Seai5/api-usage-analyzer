const fs = require("fs");
const path = require("path");
const glob = require("glob");

const COST_DB = {
  "stripe": { name: "Stripe", monthlyBase: 15 },
  "openai": { name: "OpenAI", monthlyBase: 25 },
  "twilio": { name: "Twilio", monthlyBase: 10 },
  "aws-sdk": { name: "AWS SDK", monthlyBase: 45 },
  "@aws-sdk": { name: "AWS SDK", monthlyBase: 45 },
  "googleapis": { name: "Google APIs", monthlyBase: 20 },
  "razorpay": { name: "Razorpay", monthlyBase: 12 },
  "phonepe": { name: "PhonePe", monthlyBase: 8 },
  "paytm": { name: "Paytm", monthlyBase: 10 },
  "supabase": { name: "Supabase", monthlyBase: 25 },
  "firebase": { name: "Firebase", monthlyBase: 30 },
  "sendgrid": { name: "SendGrid", monthlyBase: 15 },
  "paypal": { name: "PayPal", monthlyBase: 10 },
  "shopify": { name: "Shopify", monthlyBase: 20 },
  "vercel": { name: "Vercel", monthlyBase: 20 },
  "next": { name: "Next.js (Vercel)", monthlyBase: 20 },
};

async function runScanner(inputPath) {
  const reportMap = new Map();
  let totalWaste = 0;

  const pkgPath = path.join(inputPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {})
      ];

      allDeps.forEach(name => {
        const lower = name.toLowerCase();
        const matchKey = Object.keys(COST_DB).find(key => lower.includes(key));
        
        if (matchKey) {
          const info = COST_DB[matchKey];
          if (!reportMap.has(info.name)) {
            reportMap.set(info.name, {
              provider: info.name,
              file: "package.json",
              status: "💰 Detected Paid API",
              waste: info.monthlyBase,
              note: "Review usage in production"
            });
            totalWaste += info.monthlyBase;
          }
        }
      });
    } catch (e) { console.error("package.json parse error"); }
  }

  const report = Array.from(reportMap.values());

  return {
    success: true,
    report,
    totalWaste,
    summary: {
      total: report.length,
      unused: report.length,
      potentialSavings: totalWaste
    },
    message: report.length > 0 
      ? `Found ${report.length} potential paid APIs. Review to save money.` 
      : "No obvious paid APIs detected."
  };
}

module.exports = { runScanner };
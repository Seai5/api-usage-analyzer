const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const glob = require("glob");

// 💰 Cost Mapping Dictionary
const COST_DB = {
  "stripe.com": { name: "Stripe", monthlyBase: 15 },
  "openai.com": { name: "OpenAI", monthlyBase: 25 },
  "twilio.com": { name: "Twilio", monthlyBase: 10 },
  "googleapis.com": { name: "Google Cloud", monthlyBase: 20 },
  "aws.amazon.com": { name: "AWS", monthlyBase: 45 }
};

async function runScanner(inputPath) {
  const files = glob.sync(`${inputPath}/**/*.{js,jsx,ts,tsx}`, {
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"]
  });

  const discoveredApis = []; // Stores { varName, url, file, line }
  const usedIdentifiers = new Set(); // Stores variable names found in fetch/axios calls

  // STAGE 1: Parse all files to map Definitions and Usages
  files.forEach(file => {
    const code = fs.readFileSync(file, "utf-8");
    try {
      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
      });

      traverse(ast, {
        // Find variable declarations that look like URLs
        VariableDeclarator(p) {
          const init = p.node.init;
          if (init && (init.type === "StringLiteral" || init.type === "TemplateLiteral")) {
            const val = init.type === "StringLiteral" ? init.value : "";
            if (val.startsWith("http")) {
              discoveredApis.push({
                varName: p.node.id.name,
                url: val,
                file: path.relative(inputPath, file),
                line: p.node.loc.start.line
              });
            }
          }
        },
        // Find where these variables are actually "consumed"
        CallExpression(p) {
          const callee = p.node.callee;
          const isRequest = (callee.name === "fetch") || 
                            (callee.object && callee.object.name === "axios");
          
          if (isRequest && p.node.arguments.length > 0) {
            const arg = p.node.arguments[0];
            if (arg.type === "Identifier") usedIdentifiers.add(arg.name);
            if (arg.type === "StringLiteral") usedIdentifiers.add(arg.value);
            // Handle template literals like `axios.get(`${BASE_URL}/users`)`
            if (arg.type === "TemplateLiteral") {
              arg.expressions.forEach(exp => {
                if (exp.type === "Identifier") usedIdentifiers.add(exp.name);
              });
            }
          }
        }
      });
    } catch (e) { /* Skip unparseable files */ }
  });

  // STAGE 2: Cross-Reference & Cost Calculation
  let totalWaste = 0;
  const report = discoveredApis.map(api => {
    const isUsed = usedIdentifiers.has(api.varName) || usedIdentifiers.has(api.url);
    let waste = 0;

    if (!isUsed) {
      const provider = Object.keys(COST_DB).find(key => api.url.includes(key));
      waste = provider ? COST_DB[provider].monthlyBase : 5; // Default $5 for unknown
      totalWaste += waste;
    }

    return {
      ...api,
      status: isUsed ? "USED" : "UNUSED",
      waste: isUsed ? 0 : waste,
      securityRisk: !api.url.startsWith("https") ? "High (Insecure HTTP)" : "Low"
    };
  });

  return { report, totalWaste, summary: { total: report.length, unused: report.filter(r => r.status === "UNUSED").length } };
}

module.exports = { runScanner };
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");

// ── 1. Rename _next → next_static ──────────────────────────────────────────
const nextDir = path.join(outDir, "_next");
const staticDir = path.join(outDir, "next_static");
if (fs.existsSync(nextDir)) {
  fs.renameSync(nextDir, staticDir);
  console.log("Renamed _next → next_static");
}

// ── 2. Process every HTML file ──────────────────────────────────────────────
function processHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  // Fix asset paths
  html = html.replaceAll("/_next/", "/next_static/");

  // Remove speculation-rules scripts entirely (not needed in extensions)
  html = html.replace(
    /<script[^>]*type="speculationrules"[^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  // Extract inline scripts to external files
  let inlineIndex = 0;
  const inlineDir = path.join(path.dirname(filePath), "inline_scripts");
  if (!fs.existsSync(inlineDir)) fs.mkdirSync(inlineDir, { recursive: true });

  // Match inline <script> tags: no src attribute, not type=application/json
  html = html.replace(
    /<script((?:\s+(?!src=)[a-zA-Z-]+(?:="[^"]*")?)*)\s*>([\s\S]*?)<\/script>/g,
    (match, attrs, content) => {
      // Skip if this has a src attribute (shouldn't match but be safe)
      if (/\bsrc\s*=/.test(attrs)) return match;
      // Skip non-executable script types
      if (/type\s*=\s*["'](application\/json|speculationrules)["']/i.test(attrs)) return match;
      // Skip empty scripts
      if (!content.trim()) return match;

      const scriptFile = `inline_scripts/s${inlineIndex++}.js`;
      fs.writeFileSync(path.join(path.dirname(filePath), scriptFile), content);
      return `<script src="/${scriptFile}"${attrs}></script>`;
    }
  );

  fs.writeFileSync(filePath, html, "utf8");
  console.log(`Processed ${path.relative(outDir, filePath)} (${inlineIndex} inline scripts extracted)`);
}

// ── 3. Also fix references in JS chunk files ────────────────────────────────
function fixJsRefs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixJsRefs(full);
    } else if (entry.name.endsWith(".js")) {
      const content = fs.readFileSync(full, "utf8");
      const updated = content.replaceAll("/_next/", "/next_static/");
      if (updated !== content) fs.writeFileSync(full, updated, "utf8");
    }
  }
}

// Run
for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
  if (entry.name.endsWith(".html")) {
    processHtml(path.join(outDir, entry.name));
  }
}
fixJsRefs(path.join(outDir, "next_static"));

console.log("Post-build done.");

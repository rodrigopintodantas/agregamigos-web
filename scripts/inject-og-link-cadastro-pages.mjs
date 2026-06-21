import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const configPath = path.join(projectRoot, "og-link-cadastro.config.json");

const distCandidates = [
  path.join(projectRoot, "dist", "agregamigos-web", "browser"),
  path.join(projectRoot, "dist", "agregamigos-web"),
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveDistDir() {
  for (const candidate of distCandidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

function absolutizarUrl(origin, pathOrUrl) {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(origin).replace(/\/$/, "");
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function buildOgHead({ slug, nome, imagem_og }, origin) {
  const pageUrl = `${origin.replace(/\/$/, "")}/${slug}/link-cadastro`;
  const imageUrl = absolutizarUrl(origin, imagem_og);
  const title = `Cadastro — ${nome}`;
  const description = `Preencha seus dados para se cadastrar na campanha de ${nome}.`;

  return `
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="AgregaAmigos">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`;
}

function injectOgTags(indexHtml, ogHead, title) {
  let html = indexHtml.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (!html.includes('property="og:image"')) {
    html = html.replace("</head>", `${ogHead}\n</head>`);
  }
  return html;
}

function main() {
  const distDir = resolveDistDir();
  if (!distDir) {
    console.error("inject-og-link-cadastro-pages: index.html do build nao encontrado. Execute ng build antes.");
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.log("inject-og-link-cadastro-pages: config ausente, nada a gerar.");
    return;
  }

  const origin = String(process.env.PUBLIC_WEB_ORIGIN ?? "https://agregamigos.com.br").replace(/\/$/, "");
  const pages = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!Array.isArray(pages) || pages.length === 0) {
    console.log("inject-og-link-cadastro-pages: nenhuma pagina configurada.");
    return;
  }

  const template = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

  for (const page of pages) {
    const slug = String(page.slug ?? "").trim().toLowerCase();
    const nome = String(page.nome ?? "").trim();
    const imagemOg = String(page.imagem_og ?? "").trim();
    if (!slug || !nome || !imagemOg) {
      console.warn(`inject-og-link-cadastro-pages: entrada invalida ignorada: ${JSON.stringify(page)}`);
      continue;
    }

    const title = `Cadastro — ${nome}`;
    const ogHead = buildOgHead({ slug, nome, imagem_og: imagemOg }, origin);
    const html = injectOgTags(template, ogHead, title);
    const outDir = path.join(distDir, slug, "link-cadastro");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
    console.log(`inject-og-link-cadastro-pages: ${slug}/link-cadastro/index.html`);
  }
}

main();

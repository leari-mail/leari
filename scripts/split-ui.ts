/**
 * Splits shadcn/ui generated files (one file, many components) into
 * one-declaration-per-file folders with an index barrel, e.g.
 *
 *   src/components/ui/dialog.tsx
 *     → src/components/ui/dialog/Dialog.tsx
 *     → src/components/ui/dialog/DialogContent.tsx
 *     → src/components/ui/dialog/index.ts
 *
 * Runs automatically after `pnpm ui:add <component>`.
 * Existing folders are kept (so local customizations survive) unless --force is passed.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const UI_DIR = path.resolve(import.meta.dirname, "../src/components/ui");
const force = process.argv.includes("--force");

/** Normalizes module specifiers produced by shadcn to our path aliases. */
function rewriteSpecifier(specifier: string): string {
  if (specifier === "cn" || specifier.endsWith("lib/utils")) return "@lib/utils";
  const ui = specifier.match(/^(?:@\/components\/ui|@ui)\/(.+)$/);
  if (ui) return `@ui/${ui[1]}`;
  return specifier;
}

interface ImportSpec {
  module: string;
  kind: "default" | "namespace" | "named";
  imported: string;
  local: string;
  typeOnly: boolean;
}

function collectImports(sf: ts.SourceFile): ImportSpec[] {
  const specs: ImportSpec[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const module = rewriteSpecifier((stmt.moduleSpecifier as ts.StringLiteral).text);
    const clause = stmt.importClause;
    const clauseTypeOnly = clause.isTypeOnly;
    if (clause.name) {
      specs.push({
        module,
        kind: "default",
        imported: "default",
        local: clause.name.text,
        typeOnly: clauseTypeOnly,
      });
    }
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      specs.push({
        module,
        kind: "namespace",
        imported: "*",
        local: bindings.name.text,
        typeOnly: clauseTypeOnly,
      });
    } else if (bindings) {
      for (const el of bindings.elements) {
        specs.push({
          module,
          kind: "named",
          imported: (el.propertyName ?? el.name).text,
          local: el.name.text,
          typeOnly: clauseTypeOnly || el.isTypeOnly,
        });
      }
    }
  }
  return specs;
}

function declarationName(stmt: ts.Statement): string | undefined {
  if (ts.isFunctionDeclaration(stmt) && stmt.name) return stmt.name.text;
  if (ts.isVariableStatement(stmt)) {
    const decl = stmt.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) return decl.name.text;
  }
  if ((ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) && stmt.name)
    return stmt.name.text;
  return undefined;
}

function usedIdentifiers(node: ts.Node): Set<string> {
  const used = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      const parent = n.parent;
      const isPropertyName = parent && ts.isPropertyAccessExpression(parent) && parent.name === n;
      const isQualifiedRight = parent && ts.isQualifiedName(parent) && parent.right === n;
      if (!isPropertyName && !isQualifiedRight) used.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return used;
}

function containsJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function isExported(stmt: ts.Statement): boolean {
  return (
    !!ts.canHaveModifiers(stmt) &&
    !!ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function renderImports(specs: ImportSpec[]): string {
  const byModule = new Map<string, ImportSpec[]>();
  for (const spec of specs) byModule.set(spec.module, [...(byModule.get(spec.module) ?? []), spec]);

  const lines: string[] = [];
  for (const [module, list] of byModule) {
    for (const ns of list.filter((s) => s.kind === "namespace")) {
      lines.push(`import ${ns.typeOnly ? "type " : ""}* as ${ns.local} from "${module}";`);
    }
    const def = list.find((s) => s.kind === "default");
    const named = list
      .filter((s) => s.kind === "named")
      .map(
        (s) =>
          `${s.typeOnly ? "type " : ""}${s.imported === s.local ? s.local : `${s.imported} as ${s.local}`}`,
      );
    if (def || named.length) {
      const parts = [def?.local, named.length ? `{ ${named.join(", ")} }` : undefined].filter(
        Boolean,
      );
      lines.push(`import ${parts.join(", ")} from "${module}";`);
    }
  }
  return lines.join("\n");
}

function splitFile(file: string) {
  const base = path.basename(file, ".tsx");
  const outDir = path.join(UI_DIR, base);

  if (fs.existsSync(outDir) && !force) {
    console.warn(`• ${base}: folder already exists, keeping it (use --force to overwrite)`);
    fs.rmSync(file);
    return;
  }

  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = collectImports(sf);

  const publicNames = new Set<string>();
  const declarations = new Map<string, ts.Statement>();

  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) publicNames.add(el.name.text);
      continue;
    }
    const name = declarationName(stmt);
    if (!name) continue;
    declarations.set(name, stmt);
    if (isExported(stmt)) publicNames.add(name);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const [name, stmt] of declarations) {
    const used = usedIdentifiers(stmt);
    used.delete(name);

    const neededImports = imports.filter((spec) => used.has(spec.local));
    const siblingImports = [...declarations.keys()]
      .filter((other) => other !== name && used.has(other))
      .map((other) => `import { ${other} } from "./${other}";`);

    const body = isExported(stmt) ? stmt.getText(sf) : `export ${stmt.getText(sf)}`;
    const header = [renderImports(neededImports), siblingImports.join("\n")]
      .filter(Boolean)
      .join("\n");
    const ext = containsJsx(stmt) ? "tsx" : "ts";

    fs.writeFileSync(path.join(outDir, `${name}.${ext}`), `${header}\n\n${body}\n`);
  }

  const index = [...publicNames]
    .sort()
    .map((name) => `export { ${name} } from "./${name}";`)
    .join("\n");
  fs.writeFileSync(path.join(outDir, "index.ts"), `${index}\n`);

  fs.rmSync(file);
  console.log(`✓ ${base}: ${declarations.size} files`);
}

function writeBarrel() {
  const folders = fs
    .readdirSync(UI_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const barrel = folders.map((folder) => `export * from "./${folder}";`).join("\n");
  fs.writeFileSync(path.join(UI_DIR, "index.ts"), `${barrel}\n`);
}

const flatFiles = fs
  .readdirSync(UI_DIR)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => path.join(UI_DIR, name));

flatFiles.forEach(splitFile);
writeBarrel();

execFileSync("pnpm", ["exec", "prettier", "--write", "--log-level", "warn", UI_DIR], {
  stdio: "inherit",
});

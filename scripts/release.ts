/**
 * Cuts a release: bumps the version everywhere, dates the changelog, commits and tags.
 * Pushing the tag (`git push --follow-tags`) triggers .github/workflows/release.yml.
 *
 *   pnpm release alpha          0.1.0-alpha.1 → 0.1.0-alpha.2   (same channel: next number)
 *   pnpm release beta           0.1.0-alpha.2 → 0.1.0-beta.1    (next channel, same base)
 *   pnpm release rc             0.1.0-beta.3  → 0.1.0-rc.1
 *   pnpm release stable         0.1.0-rc.2    → 0.1.0           (drops the pre-release)
 *   pnpm release patch|minor|major              semver bump (from a pre-release, like `npm version`)
 *   pnpm release 0.1.0-alpha.1                  explicit version (may equal the current one)
 *
 * Flags: --dry-run (print only), --no-git (don't commit / tag).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const file = (name: string) => path.join(root, name);

const channels = ["alpha", "beta", "rc"] as const;
type Channel = (typeof channels)[number];

interface Version {
  major: number;
  minor: number;
  patch: number;
  pre?: { channel: Channel; number: number };
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;

function parse(value: string): Version {
  const match = VERSION_PATTERN.exec(value);
  if (!match)
    throw new Error(`Unsupported version "${value}" (expected x.y.z or x.y.z-alpha|beta|rc.n)`);
  const [, major, minor, patch, channel, number] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    pre: channel ? { channel: channel as Channel, number: Number(number) } : undefined,
  };
}

function format({ major, minor, patch, pre }: Version): string {
  return `${major}.${minor}.${patch}${pre ? `-${pre.channel}.${pre.number}` : ""}`;
}

function bump(current: Version, kind: string): Version {
  const base = { major: current.major, minor: current.minor, patch: current.patch };

  if ((channels as readonly string[]).includes(kind)) {
    const channel = kind as Channel;
    if (!current.pre)
      return { ...base, minor: base.minor + 1, patch: 0, pre: { channel, number: 1 } };
    const order = channels.indexOf(channel) - channels.indexOf(current.pre.channel);
    if (order < 0) throw new Error(`Cannot go back from ${current.pre.channel} to ${channel}`);
    return { ...base, pre: { channel, number: order === 0 ? current.pre.number + 1 : 1 } };
  }

  switch (kind) {
    case "stable":
      if (!current.pre) throw new Error("Current version is already stable");
      return base;
    // Like `npm version`: from a pre-release, the bump releases its base when it already matches.
    case "patch":
      return current.pre ? base : { ...base, patch: base.patch + 1 };
    case "minor":
      return current.pre && base.patch === 0 ? base : { ...base, minor: base.minor + 1, patch: 0 };
    case "major":
      return current.pre && base.minor === 0 && base.patch === 0
        ? base
        : { major: base.major + 1, minor: 0, patch: 0 };
    default:
      return parse(kind);
  }
}

function run(command: string, args: string[], cwd = root) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function main() {
  const args = process.argv.slice(2);
  const kind = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const useGit = !args.includes("--no-git");

  if (!kind) {
    throw new Error("Usage: pnpm release <alpha|beta|rc|stable|patch|minor|major|x.y.z[-pre.n]>");
  }

  const pkg = JSON.parse(fs.readFileSync(file("package.json"), "utf8")) as { version: string };
  const current = pkg.version;
  const next = format(bump(parse(current), kind));
  const tag = `v${next}`;
  const today = new Date().toISOString().slice(0, 10);

  console.log(`${current} → ${next}`);
  if (dryRun) return;

  if (useGit) {
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
    if (status.trim()) throw new Error("Working tree is not clean: commit or stash first");
    const tags = execFileSync("git", ["tag", "--list", tag], { cwd: root, encoding: "utf8" });
    if (tags.trim()) throw new Error(`Tag ${tag} already exists`);
  }

  // package.json (tauri.conf.json reads its version from here)
  pkg.version = next;
  fs.writeFileSync(file("package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  // Cargo.toml + Cargo.lock
  const cargoPath = file("src-tauri/Cargo.toml");
  const cargo = fs
    .readFileSync(cargoPath, "utf8")
    .replace(/^version = ".*"$/m, `version = "${next}"`);
  fs.writeFileSync(cargoPath, cargo);
  run("cargo", ["update", "--workspace", "--quiet"], file("src-tauri"));

  // CHANGELOG.md: "Unreleased" becomes this version.
  const changelogPath = file("CHANGELOG.md");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  if (!changelog.includes("## [Unreleased]"))
    throw new Error("CHANGELOG.md has no [Unreleased] section");
  fs.writeFileSync(
    changelogPath,
    changelog.replace("## [Unreleased]", `## [Unreleased]\n\n## [${next}] - ${today}`),
  );

  if (useGit) {
    run("git", [
      "add",
      "package.json",
      "src-tauri/Cargo.toml",
      "src-tauri/Cargo.lock",
      "CHANGELOG.md",
    ]);
    run("git", ["commit", "--quiet", "-m", `chore(release): ${tag}`]);
    run("git", ["tag", "-a", tag, "-m", `leari ${tag}`]);
    console.log(`\nTagged ${tag}. Publish it with:\n  git push --follow-tags`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

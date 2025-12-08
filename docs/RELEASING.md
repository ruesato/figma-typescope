# Release Process

This document describes how to create a new release of Typescope.

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Build succeeds locally (`pnpm build`)
- [ ] Manual plugin testing in Figma completed
- [ ] Version bumped in `package.json` (e.g., `1.0.0` → `1.0.1`)

## Creating a Release (3 steps)

### 1. Prepare Changes

Commit all changes for the release:

```bash
git add .
git commit -m "chore: prepare v1.0.1 release"
```

Verify version in `package.json` matches what you want to release:

```bash
node -p "require('./package.json').version"
# Output: 1.0.1
```

### 2. Create and Push Tag

Create an annotated tag matching the version:

```bash
git tag v1.0.1
git push origin main --tags
```

The tag automatically triggers the GitHub Actions "Release Plugin" workflow.

### 3. Monitor & Verify

**Monitor the workflow:**
- Go to: https://github.com/ryanuesato/figma-typescope/actions
- Click the "Release Plugin" workflow
- Watch the build progress
- Verify it completes successfully (all steps green)

**Verify the release:**
- Go to: https://github.com/ryanuesato/figma-typescope/releases
- Click on the new `v1.0.1` release
- Verify `typescope-v1.0.1.zip` is attached
- Verify release notes are present and well-formatted
- Download the ZIP and test installation in Figma (optional, but recommended)

## Testing the Release Locally

Before pushing a tag, you can test the packaging locally:

```bash
pnpm package
```

This creates:
- `dist/` directory with plugin files
- `dist/RELEASE_NOTES.md` with auto-generated changelog
- `typescope-v1.0.0.zip` (using version from package.json)

Check the ZIP contents:
```bash
unzip -l typescope-v1.0.0.zip
```

Should contain:
- `manifest.json`
- `main.js`
- `INSTALL.md`
- `RELEASE_NOTES.md`

## Post-Release

After a successful release:

1. **Announce the release**
   - Post in team Slack/Discord
   - Update any marketing materials
   - Create a discussion post on GitHub (optional)

2. **Monitor for issues**
   - Watch GitHub Issues for installation problems
   - Be ready to patch quickly if needed

3. **Plan next version**
   - Create a milestone for the next release
   - Triage and prioritize issues

## Troubleshooting

### "Tag version doesn't match package.json"

**Problem**: You pushed tag `v1.0.1` but `package.json` still says `1.0.0`

**Solution**:
1. Delete the tag locally: `git tag -d v1.0.1`
2. Delete the tag on GitHub: `git push origin :refs/tags/v1.0.1`
3. Update `package.json` to `1.0.1`
4. Commit: `git commit -m "chore: bump version to 1.0.1"`
5. Re-tag: `git tag v1.0.1 && git push origin main --tags`

### Workflow failed during tests

**Problem**: `pnpm test` failed in the workflow, blocking the release

**Solution**:
- The workflow allows tests to fail (`continue-on-error: true`)
- Build will continue even if tests fail
- Check the logs to understand the test failures
- Fix the failing tests and push again
- Tag the next commit with the same version tag (after deleting the old tag)

### Workflow failed during build

**Problem**: `pnpm build` failed

**Solution**:
1. Run `pnpm build` locally to reproduce
2. Fix the build error
3. Commit the fix: `git commit -m "fix: resolve build error"`
4. Delete the failed tag: `git tag -d v1.0.1 && git push origin :refs/tags/v1.0.1`
5. Re-tag and push: `git tag v1.0.1 && git push origin main --tags`

### ZIP file is not attached to release

**Problem**: GitHub Release created but ZIP attachment is missing

**Solution**:
1. Check Actions logs for `Package release` and `Create GitHub Release` steps
2. Verify `scripts/package-release.sh` completed successfully
3. Verify `dist/typescope-*.zip` was created
4. If needed, delete the release on GitHub and re-run by:
   - Deleting tag: `git tag -d v1.0.1 && git push origin :refs/tags/v1.0.1`
   - Re-tagging: `git tag v1.0.1 && git push origin main --tags`

## Version Numbering

Use [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (1.x.0): New features (backward compatible)
- **PATCH** (1.0.x): Bug fixes

Examples:
- `1.0.0` → `1.0.1` (patch: bug fix)
- `1.0.0` → `1.1.0` (minor: new feature)
- `1.0.0` → `2.0.0` (major: breaking change)

## Commit Message Format

Use semantic commit messages for better changelog generation:

- `feat: add token replacement feature` → appears under ✨ New Features
- `fix: resolve plugin crash on large documents` → appears under 🐛 Bug Fixes
- `refactor: simplify audit engine` → appears under ♻️ Refactoring
- `test: add audit engine tests` → appears under 🧪 Testing
- `docs: update README` → appears under 📚 Documentation
- `chore: bump dependencies` → appears under 🔧 Maintenance

## GitHub Actions Workflow

The `Release Plugin` workflow (`.github/workflows/release.yml`):

1. Triggers on tag push matching `v*.*.*`
2. Checks out code
3. Installs dependencies
4. Runs tests (continues on failure)
5. Type checks with TypeScript
6. Builds the plugin
7. Verifies version consistency
8. Packages the release (creates ZIP)
9. Generates release notes from commits
10. Creates GitHub Release with ZIP attached

## Questions or Issues?

If something goes wrong:

1. Check the Actions workflow logs: https://github.com/ryanuesato/figma-typescope/actions
2. Review this document for common solutions
3. Create a GitHub Issue describing the problem: https://github.com/ryanuesato/figma-typescope/issues

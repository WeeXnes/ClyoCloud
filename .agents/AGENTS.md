# Custom Rules for Antigravity (ClyoCloud Workspace)

Whenever you make noteworthy changes to the codebase:
1. **Version Bump**:
   - Increment the version number in `package.json` by `+0.0.1` for minor/small changes/bugfixes.
   - Increment the version number in `package.json` by `+0.1.0` for major/large changes/new features (and reset the last digit to 0, e.g., 2.4.8 -> 2.5.0).
2. **Changelog Update**:
   - Automatically document the list of changes in `CHANGELOG.md` under the bumped version number, using the current date in local time (format: `YYYY-MM-DD`).
3. **Build & Test Verification**:
   - Proactively run `npm run build` and tests to ensure no compilation/test regression has occurred with the new version and package files.
4. **Security & Test Verification**:
   - When making changes, always check if security checks/tests need any updates to keep everything tested and safe.


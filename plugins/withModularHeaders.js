/**
 * Expo Config Plugin — GoogleUtilities & RecaptchaInterop modular headers fix.
 *
 * Problem: AppCheckCore (Google Sign-In dependency) requires modular headers
 * but GoogleUtilities and RecaptchaInterop don't define modules.
 *
 * Fix: Inject per-pod `:modular_headers => true` into the generated Podfile.
 * Global `use_modular_headers!` is intentionally avoided — it can break other pods.
 *
 * Usage: Add to app.json plugins array:
 *   ["./plugins/withModularHeaders"]
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Pods that need modular_headers enabled */
const MODULAR_HEADER_PODS = ['GoogleUtilities', 'RecaptchaInterop'];

function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withModularHeaders] Podfile not found — skipping');
        return cfg;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf-8');

      // Build the injection block
      const injectionLines = MODULAR_HEADER_PODS.map(
        (pod) => `  pod '${pod}', :modular_headers => true`,
      ).join('\n');

      const marker = '# @generated modular_headers';

      // Idempotent — skip if already injected
      if (podfile.includes(marker)) {
        console.log('[withModularHeaders] Already applied — skipping');
        return cfg;
      }

      // Insert after `use_expo_modules!` line (standard Expo prebuild anchor)
      const anchor = 'use_expo_modules!';
      const anchorIndex = podfile.indexOf(anchor);

      if (anchorIndex === -1) {
        // Fallback: insert before the first `config = use_native_modules!` or `post_install`
        console.warn('[withModularHeaders] use_expo_modules! not found — inserting before post_install');
        const fallbackAnchor = 'post_install';
        const fallbackIndex = podfile.indexOf(fallbackAnchor);
        if (fallbackIndex === -1) {
          console.error('[withModularHeaders] Could not find insertion point — aborting');
          return cfg;
        }
        podfile =
          podfile.slice(0, fallbackIndex) +
          `${marker}\n${injectionLines}\n\n  ` +
          podfile.slice(fallbackIndex);
      } else {
        // Find the end of the anchor line
        const lineEnd = podfile.indexOf('\n', anchorIndex);
        podfile =
          podfile.slice(0, lineEnd + 1) +
          `\n  ${marker}\n${injectionLines}\n` +
          podfile.slice(lineEnd + 1);
      }

      fs.writeFileSync(podfilePath, podfile, 'utf-8');
      console.log('[withModularHeaders] Injected modular_headers for:', MODULAR_HEADER_PODS.join(', '));

      return cfg;
    },
  ]);
}

module.exports = withModularHeaders;

export default {
  extends: ["stylelint-config-recommended"],
  rules: {
    // Theme variants and responsive blocks intentionally append overrides in one stylesheet.
    "no-descending-specificity": null,
    "no-duplicate-selectors": null,
    // Keep compatibility fallbacks that are still required by the current theme markup.
    "property-no-deprecated": [true, { ignoreProperties: ["clip", "-webkit-box-orient"] }],
    "declaration-property-value-keyword-no-deprecated": [true, { ignoreKeywords: ["break-word"] }]
  }
};

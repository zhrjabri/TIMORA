import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Raw HTML is not allowed in TIMORA." },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "public/sw.js"],
  },
];

export default config;

import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["__tests__/**", "coverage/**"],
  },
];

export default eslintConfig;

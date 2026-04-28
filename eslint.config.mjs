import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["__tests__/**"],
  },
];

export default eslintConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone فقط برای Docker (روی Windows بدون admin، symlink مجاز نیست — مانند meetinghub)
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;

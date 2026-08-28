import type { Metadata } from "next";

import { QixiPage } from "@/screens/QixiPage";

export const metadata: Metadata = {
  title: "七夕粒子玫瑰 - 平方影视",
  description: "送给特别之人的七夕粒子玫瑰花束"
};

export default function Page() {
  return <QixiPage />;
}

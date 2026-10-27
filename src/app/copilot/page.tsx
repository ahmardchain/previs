import { CopilotChat } from "@/components/CopilotChat";

export const metadata = { title: "Copilot — Previs" };

export default function CopilotPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 32px", minHeight: "calc(100vh - 73px)", display: "flex", flexDirection: "column" }}>
      <CopilotChat />
    </main>
  );
}

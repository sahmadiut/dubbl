import { AiManagement } from "@/components/ai/management";
import { AiUsageDashboard } from "@/components/ai/usage-dashboard";

export default function AiPlatformAdministrationPage() {
  return <div className="min-w-0 space-y-10"><AiManagement platform /><AiUsageDashboard site /></div>;
}

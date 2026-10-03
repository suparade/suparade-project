import { Sidebar } from "@/components/sidebar";
import { DetectorProvider } from "@/lib/detector";

// Pages with the left sidebar. The flex-wrap stacks the sidebar above the page at phone width.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <DetectorProvider>
      <div className="ambient flex min-h-screen flex-wrap">
        <Sidebar />
        {children}
      </div>
    </DetectorProvider>
  );
}

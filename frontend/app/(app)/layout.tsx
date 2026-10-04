import { Sidebar } from "@/components/sidebar";
import { DetectorProvider, ReplaceEndedStreams } from "@/lib/detector";

// Pages with the left sidebar. The flex-wrap stacks the sidebar above the page at phone width.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <DetectorProvider>
      <ReplaceEndedStreams />
      <div className="ambient flex min-h-screen flex-wrap">
        <Sidebar />
        {children}
      </div>
    </DetectorProvider>
  );
}

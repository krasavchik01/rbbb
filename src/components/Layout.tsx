import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNavigation, MobileHeader } from "@/components/MobileNavigation";
import { PWAInstall } from "@/components/PWAInstall";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        {/* Mobile Header */}
        <MobileHeader />
        
        {/* Main Content */}
        <main className="flex-1 bg-background pt-16 pb-20 md:pt-0 md:pb-0 md:p-6">
          <div className="h-full">
            {children}
          </div>
        </main>
        
        {/* Mobile Navigation */}
        <MobileNavigation />
        
        {/* PWA Install Prompt */}
        <PWAInstall />
      </div>
    </SidebarProvider>
  );
};

export default Layout;

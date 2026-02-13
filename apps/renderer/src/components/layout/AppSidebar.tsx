import { Plug, Library, Route, LayoutDashboard } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type SidebarTab = '画布' | '集合' | 'Route 映射' | '连接配置'

const navItems: { icon: typeof LayoutDashboard; label: SidebarTab }[] = [
  { icon: LayoutDashboard, label: '画布' },
  { icon: Library, label: '集合' },
  { icon: Route, label: 'Route 映射' },
  { icon: Plug, label: '连接配置' },
]

export function AppSidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col items-center w-12 shrink-0 border-r border-border py-2 gap-1" style={{ background: 'var(--bg-activity)' }}>
        {navItems.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTabChange(item.label)}
                className={`flex items-center justify-center size-9 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground${
                  activeTab === item.label ? ' bg-sidebar-accent text-sidebar-accent-foreground' : ''
                }`}
              >
                <item.icon className="size-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>
    </TooltipProvider>
  )
}

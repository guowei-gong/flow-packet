import { Plug, FileCode, Route, LayoutDashboard } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { icon: LayoutDashboard, label: '画布' },
  { icon: FileCode, label: 'Proto 导入' },
  { icon: Route, label: 'Route 映射' },
  { icon: Plug, label: '连接配置' },
]

export function AppSidebar() {
  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col items-center w-12 shrink-0 border-r border-border bg-sidebar py-2 gap-1">
        {navItems.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button className="flex items-center justify-center size-9 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
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

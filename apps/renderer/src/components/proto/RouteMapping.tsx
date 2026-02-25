import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProtoStore, type RouteMapping as RouteMappingType } from '@/stores/protoStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { combineRoute, splitRoute } from '@/types/frame'
import { setRouteMapping, deleteRouteMapping } from '@/services/api'

export function RouteMapping() {
  const mappings = useProtoStore((s) => s.routeMappings)
  const addMapping = useProtoStore((s) => s.addRouteMapping)
  const removeMapping = useProtoStore((s) => s.removeRouteMapping)
  const routeFields = useConnectionStore((s) => s.routeFields)
  const hasRouteFields = routeFields.length > 0

  const [newRoute, setNewRoute] = useState('')
  const [newRouteValues, setNewRouteValues] = useState<Record<string, number>>({})
  const [newReqMsg, setNewReqMsg] = useState('')
  const [newRespMsg, setNewRespMsg] = useState('')

  const handleAdd = async () => {
    const route = hasRouteFields
      ? combineRoute(newRouteValues, routeFields)
      : parseInt(newRoute)
    if (!route || !newReqMsg) return

    try {
      await setRouteMapping(route, newReqMsg, newRespMsg)
      addMapping({ route, requestMsg: newReqMsg, responseMsg: newRespMsg })
      setNewRoute('')
      setNewRouteValues({})
      setNewReqMsg('')
      setNewRespMsg('')
    } catch (err) {
      console.error('Set route mapping failed:', err)
    }
  }

  const handleDelete = async (route: number) => {
    try {
      await deleteRouteMapping(route)
      removeMapping(route)
    } catch (err) {
      console.error('Delete route mapping failed:', err)
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          {hasRouteFields ? (
            routeFields.map((rf) => (
              <Input
                key={rf.name}
                placeholder={rf.name}
                value={newRouteValues[rf.name] ?? ''}
                onChange={(e) =>
                  setNewRouteValues({ ...newRouteValues, [rf.name]: Number(e.target.value) || 0 })
                }
                className="h-6 text-xs w-14 shrink-0"
                type="number"
              />
            ))
          ) : (
            <Input
              placeholder="Route"
              value={newRoute}
              onChange={(e) => setNewRoute(e.target.value)}
              className="h-6 text-xs w-14 shrink-0"
              type="number"
            />
          )}
          <Input
            placeholder="请求 Message"
            value={newReqMsg}
            onChange={(e) => setNewReqMsg(e.target.value)}
            className="h-6 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Input
            placeholder="响应 Message"
            value={newRespMsg}
            onChange={(e) => setNewRespMsg(e.target.value)}
            className="h-6 text-xs flex-1"
          />
          <Button variant="ghost" size="sm" className="h-6 px-2 shrink-0" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-40">
        {mappings.map((m) => (
          <MappingRow key={m.route} mapping={m} onDelete={handleDelete} />
        ))}
      </ScrollArea>
    </div>
  )
}

function MappingRow({
  mapping,
  onDelete,
}: {
  mapping: RouteMappingType
  onDelete: (route: number) => void
}) {
  const routeFields = useConnectionStore((s) => s.routeFields)
  const hasRouteFields = routeFields.length > 0

  const routeDisplay = hasRouteFields
    ? (() => {
        const values = splitRoute(mapping.route, routeFields)
        return routeFields.map((rf) => `${rf.name}:${values[rf.name] ?? 0}`).join(' ')
      })()
    : String(mapping.route)

  return (
    <div className="flex items-center gap-1 py-0.5 text-xs">
      <span className="shrink-0 font-mono" style={{ color: 'var(--pin-int)' }}>
        {routeDisplay}
      </span>
      <span className="flex-1 truncate text-foreground">
        {mapping.requestMsg}
      </span>
      <span className="text-[10px] text-muted-foreground">→</span>
      <span className="flex-1 truncate text-foreground">
        {mapping.responseMsg}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={() => onDelete(mapping.route)}
      >
        <Trash2 className="w-3 h-3" style={{ color: 'var(--status-error)' }} />
      </Button>
    </div>
  )
}

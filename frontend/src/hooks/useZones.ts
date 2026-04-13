import { useEffect, useState } from 'react'
import { adminApi } from '../api/client'
import { Zone } from '../types'

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.zones.list()
      .then((data) => setZones(data.filter((z: Zone) => z.isActive)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { zones, loading }
}

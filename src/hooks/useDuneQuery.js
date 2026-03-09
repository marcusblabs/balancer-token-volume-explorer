import { useState, useCallback, useRef } from 'react'

const API_KEY   = import.meta.env.VITE_DUNE_API_KEY
const BASE_URL  = 'https://api.dune.com/api/v1'
const POLL_MS   = 1500
const MAX_POLLS = 60 // 90 second timeout

function normalizeQueryId(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const urlMatch = raw.match(/\/queries\/(\d+)(?:\/|$)/i)
  if (urlMatch) return urlMatch[1]
  return raw
}

const QUERY_ID = normalizeQueryId(import.meta.env.VITE_DUNE_QUERY_ID)

export const STATUS = {
  IDLE:      'idle',
  EXECUTING: 'executing',
  POLLING:   'polling',
  COMPLETE:  'complete',
  ERROR:     'error',
}

function duneHeaders() {
  return {
    'x-dune-api-key': API_KEY,
    'Content-Type': 'application/json',
  }
}

export function useDuneQuery() {
  const [status,       setStatus]       = useState(STATUS.IDLE)
  const [rows,         setRows]         = useState([])
  const [columns,      setColumns]      = useState([])
  const [error,        setError]        = useState(null)
  const [executionId,  setExecutionId]  = useState(null)
  const [meta,         setMeta]         = useState(null)   // { total_row_count, execution_started_at }
  const pollTimer = useRef(null)

  const cancel = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    setStatus(STATUS.IDLE)
  }, [])

  const run = useCallback(async ({ chain, tokenA, tokenB, date }) => {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
      setError('No API key found. Add VITE_DUNE_API_KEY to your .env file.')
      setStatus(STATUS.ERROR)
      return
    }
    if (!QUERY_ID || QUERY_ID === 'your_query_id_here') {
      setError('No query ID found. Add VITE_DUNE_QUERY_ID to your .env file.')
      setStatus(STATUS.ERROR)
      return
    }
    if (!/^\d+$/.test(QUERY_ID)) {
      setError('Invalid query ID. Use the numeric ID or a full https://dune.com/queries/<id> URL in VITE_DUNE_QUERY_ID.')
      setStatus(STATUS.ERROR)
      return
    }

    setStatus(STATUS.EXECUTING)
    setError(null)
    setRows([])
    setColumns([])
    setMeta(null)

    // ── 1. Execute query ──────────────────────────────────────────────────────
    let execId
    try {
      const res = await fetch(`${BASE_URL}/query/${QUERY_ID}/execute`, {
        method: 'POST',
        headers: duneHeaders(),
        body: JSON.stringify({
          query_parameters: {
            chain:             chain,
            token_a_address:   tokenA.address,
            token_b_address:   tokenB.address,
            date:              date,
          },
          performance: 'medium',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      execId = data.execution_id
      setExecutionId(execId)
    } catch (e) {
      setError(`Failed to start execution: ${e.message}`)
      setStatus(STATUS.ERROR)
      return
    }

    // ── 2. Poll until complete ────────────────────────────────────────────────
    setStatus(STATUS.POLLING)
    let polls = 0

    const poll = async () => {
      if (polls++ > MAX_POLLS) {
        setError('Query timed out after 90 seconds.')
        setStatus(STATUS.ERROR)
        return
      }

      try {
        const res  = await fetch(`${BASE_URL}/execution/${execId}/results`, {
          headers: duneHeaders(),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

        const state = data.state

        if (state === 'QUERY_STATE_COMPLETED') {
          const resultRows = data.result?.rows    ?? []
          const resultCols = data.result?.metadata?.column_names ?? []
          setRows(resultRows)
          setColumns(resultCols)
          setMeta({
            total_row_count:       data.result?.metadata?.total_row_count,
            execution_started_at:  data.execution_started_at,
            execution_ended_at:    data.execution_ended_at,
          })
          setStatus(STATUS.COMPLETE)
          return
        }

        if (state === 'QUERY_STATE_FAILED' || state === 'QUERY_STATE_CANCELLED') {
          throw new Error(`Query ended with state: ${state}`)
        }

        // Still pending — keep polling
        pollTimer.current = setTimeout(poll, POLL_MS)
      } catch (e) {
        setError(`Polling error: ${e.message}`)
        setStatus(STATUS.ERROR)
      }
    }

    pollTimer.current = setTimeout(poll, POLL_MS)
  }, [])

  return { status, rows, columns, error, executionId, meta, run, cancel }
}

import { useState, useCallback, useRef } from 'react'
import { getDuneApiKey } from '../lib/duneApiKey'

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

const ENV_QUERY_ID = normalizeQueryId(import.meta.env.VITE_DUNE_QUERY_ID)

export const STATUS = {
  IDLE:      'idle',
  EXECUTING: 'executing',
  POLLING:   'polling',
  COMPLETE:  'complete',
  ERROR:     'error',
}

function duneHeaders() {
  return {
    'x-dune-api-key': getDuneApiKey(),
    'Content-Type': 'application/json',
  }
}

/**
 * Run a Dune saved query.
 *
 * Two call styles:
 *
 *   run({ chain, tokenA, date })           // backwards-compatible (env query)
 *   run({ queryId, params })               // generic (any saved query)
 *
 * The generic shape is used by the Phase 2 volume query and the Phase 4
 * source-attribution query.
 */
export function useDuneQuery(defaultQueryId = ENV_QUERY_ID) {
  const [status,       setStatus]       = useState(STATUS.IDLE)
  const [rows,         setRows]         = useState([])
  const [columns,      setColumns]      = useState([])
  const [error,        setError]        = useState(null)
  const [executionId,  setExecutionId]  = useState(null)
  const [meta,         setMeta]         = useState(null)
  const pollTimer = useRef(null)
  const runIdRef = useRef(0)

  const cancel = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    runIdRef.current += 1
    setStatus(STATUS.IDLE)
  }, [])

  const run = useCallback(async (input = {}) => {
    const apiKey = getDuneApiKey()
    if (!apiKey) {
      setError('No Dune API key set. Click "Add your Dune API key" above to paste one.')
      setStatus(STATUS.ERROR)
      return
    }

    // Backwards-compatible shape vs. generic shape.
    const generic = input.queryId != null || input.params != null
    const queryId = normalizeQueryId(generic ? input.queryId : defaultQueryId)
    const params = generic
      ? (input.params ?? {})
      : {
          chain: input.chain,
          token_address: input.tokenA?.address,
          date: input.date,
        }

    if (!queryId) {
      setError('No query ID found. Add VITE_DUNE_QUERY_ID to your .env file.')
      setStatus(STATUS.ERROR)
      return
    }
    if (!/^\d+$/.test(queryId)) {
      setError('Invalid query ID. Use the numeric ID or a full https://dune.com/queries/<id> URL.')
      setStatus(STATUS.ERROR)
      return
    }

    runIdRef.current += 1
    const myRunId = runIdRef.current

    setStatus(STATUS.EXECUTING)
    setError(null)
    setRows([])
    setColumns([])
    setMeta(null)

    let execId
    try {
      const res = await fetch(`${BASE_URL}/query/${queryId}/execute`, {
        method: 'POST',
        headers: duneHeaders(),
        body: JSON.stringify({ query_parameters: params, performance: 'medium' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      execId = data.execution_id
      if (myRunId !== runIdRef.current) return
      setExecutionId(execId)
    } catch (e) {
      if (myRunId !== runIdRef.current) return
      setError(`Failed to start execution: ${e.message}`)
      setStatus(STATUS.ERROR)
      return
    }

    setStatus(STATUS.POLLING)
    let polls = 0

    const poll = async () => {
      if (myRunId !== runIdRef.current) return
      if (polls++ > MAX_POLLS) {
        setError('Query timed out after 90 seconds.')
        setStatus(STATUS.ERROR)
        return
      }
      try {
        const res  = await fetch(`${BASE_URL}/execution/${execId}/results`, { headers: duneHeaders() })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        if (myRunId !== runIdRef.current) return

        const state = data.state
        if (state === 'QUERY_STATE_COMPLETED') {
          setRows(data.result?.rows ?? [])
          setColumns(data.result?.metadata?.column_names ?? [])
          setMeta({
            total_row_count:      data.result?.metadata?.total_row_count,
            execution_started_at: data.execution_started_at,
            execution_ended_at:   data.execution_ended_at,
          })
          setStatus(STATUS.COMPLETE)
          return
        }
        if (state === 'QUERY_STATE_FAILED' || state === 'QUERY_STATE_CANCELLED') {
          throw new Error(`Query ended with state: ${state}`)
        }
        pollTimer.current = setTimeout(poll, POLL_MS)
      } catch (e) {
        if (myRunId !== runIdRef.current) return
        setError(`Polling error: ${e.message}`)
        setStatus(STATUS.ERROR)
      }
    }
    pollTimer.current = setTimeout(poll, POLL_MS)
  }, [defaultQueryId])

  return { status, rows, columns, error, executionId, meta, run, cancel }
}

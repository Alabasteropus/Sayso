import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

/* ─────────────────────────  ROUTE CONFIG  ────────────────────────── */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxRequestBodySize = "12mb"

/* ─────────────────────────  INIT FAL  ────────────────────────────── */
const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error("[STT] FAL_KEY env-var missing!")
}

fal.config({
  credentials: FAL_KEY,
})

/* ─────────────────────────  HELPERS  ─────────────────────────────── */
const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code })

function prettyLog(label: string, value: unknown) {
  console.log(`[STT] ${label}:`, typeof value === "string" ? value : JSON.stringify(value, null, 2))
}

/* ─────────────────────────  ROUTE  ───────────────────────────────── */
export async function POST(req: NextRequest) {
  /* ---------- 1. Parse body & validate ---------- */
  let audioBase64: string | undefined
  try {
    const body = (await req.json()) as { audioBase64?: string }
    audioBase64 = body.audioBase64
  } catch (err) {
    prettyLog("JSON-parse error", err)
    return bad("Malformed JSON body")
  }

  if (!audioBase64 || audioBase64.length < 200) {
    return bad("Empty or invalid audio payload")
  }

  /* ---------- 2. Fal Whisper ---------- */
  try {
    // Convert base64 to proper data URL format for audio/webm
    const dataUrl = `data:audio/webm;base64,${audioBase64}`

    prettyLog("Calling Fal Whisper", { bytes: audioBase64.length })

    // Use the new fal.subscribe API with correct parameters
    const result = await fal.subscribe("fal-ai/whisper", {
      input: {
        audio_url: dataUrl,
        task: "transcribe",
        language: "en",
        chunk_level: "segment",
        version: "3",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(console.log)
        }
      },
    })

    // The new API returns { data: {...}, requestId: "..." }
    const transcription = result.data?.text || ""

    if (!transcription.trim()) {
      prettyLog("Missing transcription", result)
      return bad("Fal Whisper returned no text", 502)
    }

    prettyLog("Transcription", transcription)
    return NextResponse.json({ transcription })
  } catch (err) {
    prettyLog("Uncaught error", err)
    const message = err instanceof Error && err.message ? err.message : JSON.stringify(err ?? "unknown")
    return bad(`Fal Whisper threw: ${message}`, 500)
  }
}

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
    prettyLog("Request body received", { hasAudioBase64: !!audioBase64, audioLength: audioBase64?.length })
  } catch (err) {
    prettyLog("JSON-parse error", err)
    return bad("Malformed JSON body")
  }

  if (!audioBase64) {
    prettyLog("Missing audio payload", "No audioBase64 in request body")
    return bad("Missing audio payload")
  }

  if (!FAL_KEY) {
    prettyLog("FAL_KEY missing", "Environment variable not set")
    return bad("FAL API key not configured", 500)
  }

  /* ---------- 2. Fal Whisper ---------- */
  try {
    // Convert base64 to Buffer and then to Blob for file upload
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    
    // Detect audio format from the first few bytes
    let mimeType = 'audio/webm'
    if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
      mimeType = 'audio/wav'
    }
    
    const audioBlob = new Blob([audioBuffer], { type: mimeType })

    prettyLog("Audio processing", { 
      bufferSize: audioBuffer.length, 
      mimeType,
      blobSize: audioBlob.size 
    })

    const uploadedUrl = await fal.storage.upload(audioBlob);
    prettyLog("Uploaded audio URL", uploadedUrl);

    // Use the new fal.subscribe API with file upload
    const result = await fal.subscribe("fal-ai/whisper", {
      input: {
        audio_url: uploadedUrl,
        task: "transcribe",
        language: "en",
        chunk_level: "segment",
        version: "3",
      },
      logs: true,
      onQueueUpdate: (update) => {
        prettyLog("Queue update", update)
        if (update.status === "IN_PROGRESS") {
          update.logs?.map((log) => log.message).forEach(console.log)
        }
      },
    })

    prettyLog("Whisper result", result)

    // The new API returns { data: {...}, requestId: "..." }
    const transcription = result.data?.text || ""

    if (!transcription.trim()) {
      prettyLog("Missing transcription", result)
      return bad("Fal Whisper returned no text", 502)
    }

    prettyLog("Transcription success", transcription)
    return NextResponse.json({ transcription })
  } catch (err) {
    prettyLog("Uncaught error", err)
    const message = err instanceof Error && err.message ? err.message : JSON.stringify(err ?? "unknown")
    return bad(`Fal Whisper threw: ${message}`, 500)
  }
}

import { fal } from "@fal-ai/client"

const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  console.error("FAL_KEY env-var missing!")
}

fal.config({
  credentials: FAL_KEY,
})
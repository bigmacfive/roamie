# Roamie

**An expressive AI companion designed for Meta Ray-Ban Display glasses.**

[Try the live demo](https://roamie-display.vercel.app)

Roamie brings a virtual companion into your field of view through short conversations, expressive character animation, and readable captions. Built for **c0mpiled-16: UCSD**, with the **AI-Powered Consumer Products for 1 Billion People** track in mind.

## The experience

Start a conversation, share a moment from your day, and watch Roamie respond with a brief English reply and a matching gesture. The current glasses interface is **silent**: replies appear as captions; it does not play speech.

- **Expressive character:** 41 prepared animations, with AI-selected gestures and a continuously animated idle state.
- **Minimal input:** a persistent text field designed to open the glasses’ native dictation or handwriting composer; committed text sends automatically.
- **Readable conversation:** your message appears above short, two-line reply pages.
- **Responsive replies:** streamed text with an automatic JSON fallback when streaming stalls.
- **Simple controls:** replay the last response or reopen the usage guide.

The companion uses an affectionate virtual-partner persona. It is instructed to be honest about being AI when asked and not to claim awareness of the user’s surroundings.

## Try it

Open **https://roamie-display.vercel.app** and select **Start conversation**.

Try:

> I had a long day. I just wanted to see you.

> Something good happened today—I finished my hackathon project!

On a desktop, paste a complete message into the input or type and press Enter. The current composer also auto-sends after a brief typing pause, matching its native-input design.

For glasses, add the HTTPS URL through the Meta AI app’s Display Glasses web-app connections with Developer Mode enabled. Select the input field, finish dictation or handwriting in the system composer, and read the reply above the character. Device availability and native-input behavior must be checked on actual hardware.

## Run locally

Use **Node.js 22.12+** and npm.

```bash
npm ci
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`, then start the app:

```bash
npm run dev
```

Open **http://127.0.0.1:4173**. The local Express server serves the frontend and API together.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required for conversation responses. |
| `OPENAI_MODEL` | Conversation model; defaults to `gpt-6-luna`. Your account must have access. |
| `PORT` / `HOST` | Local server address; defaults to `4173` / `127.0.0.1`. |
| `APP_ORIGIN` | External origin for HTTPS deployments. |
| `ELEVENLABS_API_KEY` | Optional, for retained speech endpoints only. The current UI does not call them. |
| `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL_ID` | Optional speech endpoint configuration. |

Keys stay on the server. Never put credentials into client variables or commit `.env.local`.

## How it works

```text
Native composer / browser input
              ↓
      React conversation UI
              ↓
  /api/respond → OpenAI Responses API
       ↓              ↓
 streamed text   structured reply + gesture ID
       ↓              ↓
 caption pages + animated character

If streaming stalls: /api/chat → bounded JSON fallback
```

**Frontend:** React 19, TypeScript, Vite, and Lucide icons. The portrait uses one visible animated WebP image at a time; current assets are 360 × 360 at 24 fps. A gesture returns to idle after approximately six seconds.

**Backend:** Express for local development and Vercel functions for deployment. Structured output selects a reply and a validated gesture ID. Request cancellation and deadlines prevent stale responses from replacing newer turns.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/respond` | Stream newline-delimited text events and a final structured reply. |
| `POST /api/chat` | Return `{text, clipId}` as JSON. |
| `GET /api/health` | Report configuration presence, without exposing credentials. |
| `POST /api/speech` | Retained optional ElevenLabs speech endpoint; unused by the current UI. |
| `POST /api/phrase` | Retained optional cached-phrase endpoint; unused by the current UI. |

Conversation endpoints accept `{messages: [{role, content}]}` with up to 24 messages, at most 1,500 characters per message, and a user message last.

## Project structure

```text
src/                  Conversation UI, native composer, animation, transport
server/               Shared AI services and local Express server
api/                  Vercel API entry points
public/character/     Gesture metadata, framing, and current motion-v8 assets
scripts/              Optional asset preparation and voice-generation tools
tests/                Validation, captions, streaming, and fallback tests
```

The current runtime animations are included, so asset generation is not needed to run the project. Superseded WebP exports and original source videos are excluded from this repository; the earlier lightweight MP4 assets remain for the existing asset-validation tests. `npm run assets` expects the separate `../Character02-Final` source package; framing and animation rebuild scripts additionally need their source media, FFmpeg, and, for Python animation encoding, Pillow. The face-anchor tool requires macOS/Apple Vision.

## Validation

```bash
npm test
npm run build
```

Tests cover message validation, gesture selection fallback, caption segmentation, framing, stream parsing, deadlines, cancellation, and JSON fallback. Browser QA has exercised conversation responses, animation, replay/help controls, native-input focus restoration, and stalled-stream fallback.

**Hardware status:** browser checks do not certify real glasses. Native dictation/handwriting, animation stability, and display readability still require physical-device verification. Character animations are prepared clips, not live-generated video or lip sync.

## Deploy

Import this repository into Vercel. `vercel.json` configures the Vite build, `dist` output, and API functions. Set `OPENAI_API_KEY`, the accessible `OPENAI_MODEL`, and `APP_ORIGIN` for your deployment in the server environment, then deploy.

## Data handling

Conversation history lives in browser memory and clears on reload. Messages are sent to OpenAI with `store: false`; this setting is not a claim of zero provider retention. The current silent UI does not send text to ElevenLabs. Calling the optional speech endpoints sends text there and may use a bounded server-side audio/text cache. Local environment files, caches, build output, and development recordings are ignored by Git.

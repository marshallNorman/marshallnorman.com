#!/bin/bash
# Now Playing Bridge — polls Apple Music via osascript every 10s and pushes to Cloudflare Worker

CONFIG_FILE="$HOME/.config/now-playing-bridge/config"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

# Source config (WORKER_URL and BRIDGE_TOKEN)
set -a
source "$CONFIG_FILE"
set +a

if [[ -z "$WORKER_URL" || -z "$BRIDGE_TOKEN" ]]; then
  echo "WORKER_URL and BRIDGE_TOKEN must be set in $CONFIG_FILE" >&2
  exit 1
fi

LAST_TRACK=""
WAS_PLAYING=false

while true; do
  TRACK=$(osascript -e 'tell application "Music" to if player state is playing then get name of current track' 2>/dev/null)
  ARTIST=$(osascript -e 'tell application "Music" to if player state is playing then get artist of current track' 2>/dev/null)
  ALBUM=$(osascript -e 'tell application "Music" to if player state is playing then get album of current track' 2>/dev/null)

  # If nothing is playing, push a stop signal once on transition then idle
  if [[ -z "$TRACK" ]]; then
    if [[ "$WAS_PLAYING" == "true" ]]; then
      curl -s -o /dev/null \
        -X POST "$WORKER_URL/update" \
        -H "Authorization: Bearer $BRIDGE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"isPlaying":false}'
      WAS_PLAYING=false
      LAST_TRACK=""
    fi
    sleep 10
    continue
  fi

  CURRENT="${TRACK}|${ARTIST}|${ALBUM}"

  # Fetch iTunes data and push to KV only when track changes
  if [[ "$CURRENT" != "$LAST_TRACK" ]]; then
    # Try four strategies in order: (track+artist, track+artist GB, album+artist, album+artist GB)
    # Strips punctuation before encoding to improve matching (e.g. "Mr." → "Mr")
    ART_URL=""
    ALBUM_URL=""
    for SEARCH_TERMS in "$TRACK $ARTIST" "$ALBUM $ARTIST"; do
      for COUNTRY in "" "gb"; do
        COUNTRY_PARAM=${COUNTRY:+"&country=$COUNTRY"}
        ENCODED=$(python3 -c "import re,urllib.parse,sys; t=re.sub(r'[^\w\s]',' ',sys.argv[1]); print(urllib.parse.quote(t.strip()))" "$SEARCH_TERMS" 2>/dev/null)
        ITUNES_JSON=$(curl -s "https://itunes.apple.com/search?term=$ENCODED&entity=song&limit=1${COUNTRY_PARAM}" 2>/dev/null)
        ART_URL=$(echo "$ITUNES_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('results',[]); print(r[0].get('artworkUrl100','').replace('100x100bb','600x600bb') if r else '')" 2>/dev/null)
        ALBUM_URL=$(echo "$ITUNES_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d.get('results',[]); print(r[0].get('collectionViewUrl','') if r else '')" 2>/dev/null)
        if [[ -n "$ART_URL" ]]; then break 2; fi
      done
    done
    LAST_TRACK="$CURRENT"
    WAS_PLAYING=true

    PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
  'track':    sys.argv[1],
  'artist':   sys.argv[2],
  'album':    sys.argv[3],
  'albumArt': sys.argv[4],
  'albumUrl': sys.argv[5],
}))" "$TRACK" "$ARTIST" "$ALBUM" "$ART_URL" "$ALBUM_URL")

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$WORKER_URL/update" \
      -H "Authorization: Bearer $BRIDGE_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD")

    if [[ "$HTTP_STATUS" != "200" ]]; then
      echo "$(date -u +%FT%TZ) push failed (HTTP $HTTP_STATUS): $TRACK — $ARTIST" >&2
    fi
  fi

  sleep 10
done

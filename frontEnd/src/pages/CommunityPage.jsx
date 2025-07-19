"use client"
import { useState, useEffect, useRef } from "react"   // NEW – added useRef
import { useNavigate } from "react-router-dom"
import AppLayout from "../components/AppLayout"
import PreviousBets from "../components/PreviousBets"
import ActiveBet from "../components/ActiveBet"
import PlayerAnalysisModal from "../components/PlayerAnalysisModal"
import EditBetModal from "../components/EditBetModal"
import {
  getActiveBets,
  getAllBetHistory,
  cancelActiveBet,
  updateActiveBet,
  moveCompletedBets,
} from "../services/firebaseService"

export default function CommunityPage() {
  /* … all your existing state & helper functions stay the same … */

  const twitchRef = useRef(null)                // NEW – DOM node for the player

  /* -----------------------------------------------------------
     Load Twitch script once, then create the player
  ----------------------------------------------------------- */
  useEffect(() => {
    const hostname = window.location.hostname     // e.g. “localhost” or “myapp.com”

    const createPlayer = () => {
      // guard against double‑init
      if (twitchRef.current && twitchRef.current.childElementCount === 0) {
        new window.Twitch.Player(twitchRef.current, {
          width: "100%",
          height: 600,
          channel: "plaqueboymax",                   // <— change channel if you need
          parent: [hostname],
        }).setVolume(0.5)
      }
    }

    // inject the script if it isn’t on the page yet
    if (!window.Twitch) {
      const script = document.createElement("script")
      script.id = "twitch-embed-script"
      script.src = "https://player.twitch.tv/js/embed/v1.js"
      script.async = true
      script.onload = createPlayer
      document.body.appendChild(script)
    } else {
      createPlayer()
    }
  }, [])

  /* -----------------------------------------------------------
     JSX
  ----------------------------------------------------------- */
  return (
    <AppLayout>
      {/* ---------- Twitch stream ---------- */}
      <div className="flex justify-center my-6">
        <div
          id="twitch-player"
          ref={twitchRef}
          className="w-full max-w-[1200px]"
        />
      </div>
    </AppLayout>
  )
}

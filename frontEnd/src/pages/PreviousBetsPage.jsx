"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import AppLayout from "../components/AppLayout"
import PreviousBets from "../components/PreviousBets"
import ActiveBet from "../components/ActiveBet"
import PlayerStatsModal from "../components/PlayerStatsModal"
import EditBetModal from "../components/EditBetModal"
import {
  getActiveBets,
  getAllBetHistory,
  cancelActiveBet,
  updateActiveBet,
  moveCompletedBets,
} from "../services/firebaseService"

export default function PreviousBetsPage() {
  const [activeBets, setActiveBets] = useState([])
  const [betHistory, setBetHistory] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [editingBet, setEditingBet] = useState(null)
  const navigate = useNavigate()

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0]

  // Load user data when component mounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get current user from sessionStorage
        const userId = sessionStorage.getItem("currentUser")
        if (!userId) {
          console.error("No user logged in")
          navigate("/")
          return
        }

        setCurrentUser(userId)

        try {
          // Get active bets
          const bets = await getActiveBets(userId)
          setActiveBets(bets || [])
        } catch (betsError) {
          console.error("Error loading active bets:", betsError)
          setActiveBets([])
        }

        try {
          // Move completed bets from active to history
          const moveResult = await moveCompletedBets(userId)
          if (moveResult.moved > 0) {
            console.log(`Moved ${moveResult.moved} completed bets to history`)

            // Refresh active bets and bet history after moving
            const updatedActiveBets = await getActiveBets(userId)
            setActiveBets(updatedActiveBets || [])

            const updatedHistory = await getAllBetHistory(userId)
            setBetHistory(updatedHistory || [])
          }
        } catch (moveError) {
          console.error("Error moving completed bets:", moveError)
        }

        try {
          // Get bet history
          const history = await getAllBetHistory(userId)
          setBetHistory(history || [])
        } catch (historyError) {
          console.error("Error loading bet history:", historyError)
          setBetHistory([])
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }

    loadUserData()
  }, [navigate, today])

  // Add this function to handle editing a bet
  const handleEditBet = (bet) => {
    setEditingBet(bet)
  }

  // Add this function to save edited bet
  const handleSaveBet = async (betId, updatedData) => {
    try {
      await updateActiveBet(currentUser, betId, updatedData)

      // Refresh active bets
      const bets = await getActiveBets(currentUser)
      setActiveBets(bets || [])

      // Close the edit modal
      setEditingBet(null)
    } catch (error) {
      console.error("Error updating bet:", error)
      alert(`Failed to update bet: ${error.message}`)
    }
  }

  // Update the handleCancelBet function to handle a specific bet
  const handleCancelBet = async (betId) => {
    if (!window.confirm("Are you sure you want to cancel this bet?")) {
      return
    }

    try {
      console.log(`Canceling bet: ${betId}`)
      await cancelActiveBet(currentUser, betId)
      console.log("Bet canceled successfully")

      // Refresh active bets
      const bets = await getActiveBets(currentUser)
      setActiveBets(bets || [])
    } catch (error) {
      console.error("Error canceling bet:", error)
      alert(`Failed to cancel bet: ${error.message}`)
    }
  }

  // Update the formatActiveBets function to handle multiple bets
  const formatActiveBets = (bets) => {
    if (!bets || !Array.isArray(bets) || bets.length === 0) return []

    return bets.map((bet) => ({
      id: bet.id,
      date: new Date(bet.createdAt?.seconds * 1000 || Date.now())
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase(),
      betAmount: bet.betAmount,
      potentialWinnings: bet.potentialWinnings,
      status: "Active",
      gameTime: bet.picks[0]?.gameTime || "TBD",
      bettingPlatform: bet.bettingPlatform || "PrizePicks",
      betType: bet.betType || "Power Play",
      picks: bet.picks.map((pick) => ({
        player: pick.name,
        team: pick.team || "Team",
        opponent: pick.opponent || "Opponent",
        threshold: pick.threshold,
        recommendation: pick.recommendation,
        photoUrl: pick.photoUrl || "/placeholder.svg?height=40&width=40",
      })),
    }))
  }

  // Also fix the formatBetHistory function which has the same issue
  const formatBetHistory = (bets) => {
    // Add a null check to prevent the error
    if (!bets || !Array.isArray(bets)) {
      return []
    }

    return bets.map((bet) => ({
      id: bet.id,
      date: new Date(bet.createdAt?.seconds * 1000 || Date.parse(bet.createdAt) || Date.now())
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase(),
      betAmount: bet.betAmount,
      winnings: bet.winnings || 0,
      status: bet.status || "Lost",
      bettingPlatform: bet.bettingPlatform || "PrizePicks",
      betType: bet.betType || "Power Play",
      picks: Array.isArray(bet.picks)
        ? bet.picks.map((pick) => ({
            name: pick.name,
            team: pick.team || "Team",
            opponent: pick.opponent || "Opponent",
            threshold: pick.threshold,
            recommendation: pick.recommendation,
            photoUrl: pick.photoUrl || "/placeholder.svg?height=40&width=40",
            finalPoints: pick.finalPoints ?? -1,
            hit: pick.hit ?? -1,
            bet_result: pick.bet_result ?? "-1",
          }))
        : [],
    }))
  }

  // Previous bets from Firebase
  const previousBets = formatBetHistory(betHistory)
  const formattedActiveBets = formatActiveBets(activeBets)

  // Add this function in the component
  const handlePlayerClick = (player) => {
    setSelectedPlayer(player)
  }

  return (
    <AppLayout>
      {/* Active Bet Section */}
      {formattedActiveBets.length > 0 && (
        <div className="mb-8">
          <ActiveBet
            bets={formattedActiveBets}
            onCancel={handleCancelBet}
            onPlayerClick={handlePlayerClick}
            onEdit={handleEditBet}
          />
        </div>
      )}

      <PreviousBets bets={previousBets} activeBets={formattedActiveBets} onPlayerClick={(pick) => setSelectedPlayer(pick)} />

      {/* Player Stats Modal */}
      {selectedPlayer && <PlayerAnalysisModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      {/* Edit Bet Modal */}
      {editingBet && <EditBetModal bet={editingBet} onSave={handleSaveBet} onClose={() => setEditingBet(null)} />}
    </AppLayout>
  )
}

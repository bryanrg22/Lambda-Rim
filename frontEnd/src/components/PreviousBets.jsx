"use client"

import { useState } from "react"
import PlayerAnalysisModal from "./PlayerAnalysisModal"
import { ChevronDown, ChevronUp, Trophy, TrendingUp, TrendingDown, Clock, DollarSign, Target, Calendar } from 'lucide-react'

const PreviousBets = ({ bets, activeBets }) => {
  const [expandedBets, setExpandedBets] = useState({})
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const handleOpenModal  = (player) => setSelectedPlayer(player)
  const handleCloseModal = ()       => setSelectedPlayer(null)

  const toggleExpand = (betId) => {
    setExpandedBets((prev) => ({
      ...prev,
      [betId]: !prev[betId],
    }))
  }

  if ((!bets || bets.length === 0) && (!activeBets || activeBets.length === 0)) {
    return (
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-6 sm:p-8 border border-gray-700 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Bet History
          </h2>
          <p className="text-gray-400 text-lg">You don't have any previous bets yet.</p>
          <p className="text-gray-500 text-sm mt-2">Your completed bets will appear here once you start placing wagers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-700 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Bet History
              </h2>
              <p className="text-gray-400 mt-1">
                {(activeBets?.length || 0) + (bets?.length || 0)} total bets • Track your performance
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Active Bets Section */}
          {activeBets && activeBets.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-6">
                <Clock className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">Active Bets</h3>
                <div className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs font-medium rounded-md border border-yellow-700/30">
                  {activeBets.length} active
                </div>
              </div>
              
              <div className="space-y-4">
                {activeBets.map((bet) => (
                  <div key={bet.id} className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-700/30 overflow-hidden">
                    <div
                      className="p-4 sm:p-5 cursor-pointer hover:bg-yellow-900/10 transition-all duration-200"
                      onClick={() => toggleExpand(`active-${bet.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-base sm:text-lg">
                              Bet placed on {bet.date}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-gray-300 text-sm">
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                ${bet.betAmount?.toFixed(2) || '0.00'}
                              </span>
                              <span className="text-green-400 text-sm font-medium">
                                betPayOut: ${bet.betPayOut?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="px-3 py-1 bg-yellow-600 text-white text-sm font-medium rounded-lg flex items-center space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span>Active</span>
                          </div>
                          {expandedBets[`active-${bet.id}`] ? (
                            <ChevronUp className="text-gray-400 w-5 h-5" />
                          ) : (
                            <ChevronDown className="text-gray-400 w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedBets[`active-${bet.id}`] && (
                      <div className="border-t border-yellow-700/30 bg-yellow-900/10">
                        <div className="p-4 sm:p-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Platform</span>
                              <div className="flex items-center space-x-2">
                                {bet.bettingPlatform === "PrizePicks" && (
                                  <img 
                                    src="/prizePicksLogo.avif" 
                                    alt="PrizePicks" 
                                    className="h-4 w-auto object-contain"
                                    onError={(e) => {
                                      e.target.style.display = 'none'
                                    }}
                                  />
                                )}
                                <span className="font-medium text-white text-sm">{bet.bettingPlatform || "PrizePicks"}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Bet Type</span>
                              <span className="font-medium text-white text-sm">{bet.betType || "Power Play"}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h4 className="font-semibold text-white flex items-center">
                              <Target className="w-4 h-4 mr-2 text-yellow-400" />
                              Picks ({bet.picks?.length || 0})
                            </h4>
                            {bet.picks?.map((pick, index) => (
                              <div key={index} className="bg-gradient-to-r from-gray-700/50 to-gray-800/50 rounded-lg p-3 border border-gray-600/50 cursor-pointer" onClick={() => handleOpenModal(pick)}>
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600 flex-shrink-0">
                                    <img
                                      src={pick.photoUrl || "/placeholder.svg?height=40&width=40"}
                                      alt={pick.player}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = "/placeholder.svg?height=40&width=40"
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{pick.player}</p>
                                    <p className="text-sm text-gray-300">
                                      {pick.team} vs {pick.opponent}
                                    </p>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="text-sm text-gray-300">{pick.threshold} pts</span>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                                          pick.recommendation === "OVER"
                                            ? "bg-green-900/30 text-green-400 border border-green-700/30"
                                            : "bg-red-900/30 text-red-400 border border-red-700/30"
                                        }`}
                                      >
                                        {pick.recommendation}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Bets */}
          {bets && bets.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-6">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Completed Bets</h3>
                <div className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs font-medium rounded-md border border-blue-700/30">
                  {bets.length} completed
                </div>
              </div>
              
              {bets.map((bet) => (
                <div
                  key={bet.id}
                  className={`rounded-xl border overflow-hidden ${
                    bet.status === "Won"
                      ? "bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700/30"
                      : bet.status === "Lost"
                        ? "bg-gradient-to-r from-red-900/20 to-rose-900/20 border-red-700/30"
                        : "bg-gradient-to-r from-gray-700/20 to-gray-800/20 border-gray-600/30"
                  }`}
                >
                  <div
                    className="p-4 sm:p-5 cursor-pointer hover:bg-black/10 transition-all duration-200"
                    onClick={() => toggleExpand(bet.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          bet.status === "Won"
                            ? "bg-gradient-to-r from-green-500 to-emerald-500"
                            : bet.status === "Lost"
                              ? "bg-gradient-to-r from-red-500 to-rose-500"
                              : "bg-gradient-to-r from-gray-500 to-gray-600"
                        }`}>
                          {bet.status === "Won" ? (
                            <TrendingUp className="w-5 h-5 text-white" />
                          ) : bet.status === "Lost" ? (
                            <TrendingDown className="w-5 h-5 text-white" />
                          ) : (
                            <Clock className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-base sm:text-lg">
                            Bet placed on {bet.date}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-gray-300 text-sm">
                              <DollarSign className="w-4 h-4 inline mr-1" />
                              ${bet.betAmount?.toFixed(2) || '0.00'}
                            </span>
                            {bet.status === "Won" ? (
                              <span className="text-green-400 text-sm font-medium">
                                Won ${bet.winnings?.toFixed(2) || '0.00'}
                              </span>
                            ) : (
                              <span className="text-red-400 text-sm font-medium">Lost</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            bet.status === "Won"
                              ? "bg-green-600 text-white"
                              : bet.status === "Lost"
                                ? "bg-red-600 text-white"
                                : "bg-gray-600 text-white"
                          }`}
                        >
                          {bet.status}
                        </div>
                        {expandedBets[bet.id] ? (
                          <ChevronUp className="text-gray-400 w-5 h-5" />
                        ) : (
                          <ChevronDown className="text-gray-400 w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedBets[bet.id] && (
                    <div className={`border-t ${
                      bet.status === "Won"
                        ? "border-green-700/30 bg-green-900/10"
                        : bet.status === "Lost"
                          ? "border-red-700/30 bg-red-900/10"
                          : "border-gray-600/30 bg-gray-800/10"
                    }`}>
                      <div className="p-4 sm:p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Platform</span>
                            <div className="flex items-center space-x-2">
                              {bet.bettingPlatform === "PrizePicks" && (
                                <img 
                                  src="/prizePicksLogo.avif" 
                                  alt="PrizePicks" 
                                  className="h-4 w-auto object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                  }}
                                />
                              )}
                              <span className="font-medium text-white text-sm">{bet.bettingPlatform || "PrizePicks"}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Bet Type</span>
                            <span className="font-medium text-white text-sm">{bet.betType || "Power Play"}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-semibold text-white flex items-center">
                            <Target className="w-4 h-4 mr-2 text-blue-400" />
                            Pick Results ({bet.picks?.length || 0})
                          </h4>
                          {bet.picks?.map((pick, index) => (
                            <div
                              key={index}
                              className={`rounded-lg p-3 border ${
                                pick.hit === 1
                                  ? "bg-gradient-to-r from-green-800/50 to-green-900/50 border-green-700/50"
                                  : "bg-gradient-to-r from-red-800/50 to-red-900/50 border-red-700/50"
                              } cursor-pointer`}
                              onClick={() => handleOpenModal(pick)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600 flex-shrink-0">
                                    <img
                                      src={pick.photoUrl || "/placeholder.svg?height=40&width=40"}
                                      alt={pick.player}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = "/placeholder.svg?height=40&width=40"
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{pick.name}</p>
                                    <p className="text-sm text-gray-300">
                                      {pick.team} vs {pick.opponent}
                                    </p>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="text-sm text-gray-300">{pick.threshold} pts</span>
                                      <span
                                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                                          pick.recommendation === "OVER"
                                            ? "bg-green-900/30 text-green-400 border border-green-700/30"
                                            : "bg-red-900/30 text-red-400 border border-red-700/30"
                                        }`}
                                      >
                                        {pick.recommendation}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-right flex-shrink-0">
                                  <p className="font-bold text-white text-lg">{pick.finalPoints} pts</p>
                                  <div className={`px-2 py-1 rounded-md text-xs font-bold ${
                                    pick.hit === 1
                                      ? "bg-green-600 text-white"
                                      : "bg-red-600 text-white"
                                  }`}>
                                    {pick.hit === 1 ? "WIN" : "LOSS"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedPlayer && (
        <PlayerAnalysisModal
          playerData={selectedPlayer}
          onClose={handleCloseModal}
          // no onAddToPicks here: we’re just viewing past bets
        />
      )}
    </div>
  )
}

export default PreviousBets

"use client"

import { useState } from "react"
import {
  X,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Activity,
  Plus,
  Calendar,
  Trophy,
  BarChart3,
  Target,
  MapPin,
  Heart,
  Clock,
} from "lucide-react"
import ImageWithFallback from "./ImageWithFallback"


const PlayerAnalysisModal = ({ playerData, onClose, onAddToPicks }) => {
  const [expandedSection, setExpandedSection] = useState(null)
  const [moreGames, setMoreGames] = useState([])
  const [showMoreGames, setShowMoreGames] = useState(false)
  const [loadingMoreGames, setLoadingMoreGames] = useState(false)
  const [moreGamesError, setMoreGamesError] = useState(null)

  if (!playerData) return null

  // Format numbers to 1 decimal place for better mobile display
  const formatNumber = (num) => {
    if (num === undefined || num === null) return "N/A"
    return typeof num === "number" ? num.toFixed(1) : num
  }

  // Format percentages
  const formatPercent = (num) => {
    if (num === undefined || num === null) return "N/A"
    return typeof num === "number" ? `${(num * 100).toFixed(1)}%` : num
  }

  // Get recommendation color
  const getRecommendationColor = (recommendation) => {
    if (!recommendation) return "text-gray-400"
    const rec = recommendation.toLowerCase()
    if (rec.includes("over") || rec.includes("yes")) return "text-green-400"
    if (rec.includes("under") || rec.includes("no")) return "text-red-400"
    return "text-yellow-400"
  }

  // Get probability color
  const getProbabilityColor = (probability) => {
    if (probability === undefined || probability === null) return "text-gray-400"
    const prob = typeof probability === "string" ? Number.parseFloat(probability) : probability
    if (prob >= 0.7) return "text-green-400"
    if (prob >= 0.5) return "text-yellow-400"
    return "text-red-400"
  }

  // Get threshold comparison color
  const getComparisonColor = (value, threshold) => {
    if (value === undefined || value === null) return "text-gray-400"
    return value > threshold ? "text-green-400" : "text-red-400"
  }

  const toInjuryArray = (injuriesObj = {}) =>
    Object.entries(injuriesObj).map(([player, info]) => ({
      player,
      ...info
    }))

  // Get injury status color
  const getInjuryStatusColor = (status) => {
    if (!status || status === "NOT YET SUBMITTED") return "text-gray-400"
    const statusLower = status.toLowerCase()
    if (statusLower.includes("out")) return "text-red-400"
    if (statusLower.includes("questionable") || statusLower.includes("doubtful")) return "text-yellow-400"
    if (statusLower.includes("probable") || statusLower.includes("available") || statusLower.includes("not injured")) return "text-green-400"
    return "text-gray-400"
  }

  // Extract ALL available data from Firestore schema
  const {
    name,
    team,
    position,
    opponent,
    photoUrl,
    teamLogo,
    opponentLogo,
    gameDate,
    gameTime,
    gameType,
    teamPlayoffRank,
    opponentPlayoffRank,
    seasonAvgPoints,
    last5RegularGamesAvg,
    seasonAvgVsOpponent,
    last5RegularGames = [],
    careerSeasonStats = [],
    injuryReport = {},
    betExplanation = {},
    poissonProbability,
    monteCarloProbability,
    volatilityForecast,
    season_games_agst_opp = [],
    threshold,
    playoff_num_games = 0,
    playoffAvg,
    playoff_games = [],
    volatilityPlayOffsForecast,
    playoff_curr_score,
    playoff_points_home_avg,
    playoff_points_away_avg,
    underCount,
    playoff_underCount,
    points_home_avg,
    points_away_avg,
    average_mins,
    importanceRole,
    usage_rate,
    blowoutRisk,
    vegasSpread,
    overUnder,
    totalMove,
    spreadMove,
    teamImpliedPts,
    oppImpliedPts,
    impliedOverProb,
    favoriteFlag,
    underdogFlag,
    details,
    home_game,
    num_season_games,
    playoff_round,
    playoff_curr_series_score,
    playoff_curr_game_num,
    playoff_points_avg,
  } = playerData

  // Format probabilities for display
  const poissonProbabilityFormatted = poissonProbability ? `${(poissonProbability * 100).toFixed(1)}%` : "N/A"
  const monteCarloFormatted = monteCarloProbability ? `${(monteCarloProbability * 100).toFixed(1)}%` : "N/A"

  // Determine recommendation
  const recommendation = betExplanation.recommendation || "N/A"
  const recommendationColor = getRecommendationColor(recommendation)

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Handle more games loading using your existing API endpoint
  const handleToggleMoreGames = async () => {
    if (showMoreGames) {
      return setShowMoreGames(false)
    }
    setLoadingMoreGames(true)
    setMoreGamesError(null)
    try {

      const url = new URL(
        `/api/player/${playerData.pick_id}/more_games`,
        window.location.origin
      );
      url.searchParams.append('player_id', playerData.playerId || '');
      url.searchParams.append('gameStatus', playerData.gameStatus || '');
      url.searchParams.append('season', playerData.season || '');
      url.searchParams.append('game_id', playerData.gameId || '');
      

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMoreGames(data)
      setShowMoreGames(true)
    } catch (err) {
      console.error(err)
      setMoreGamesError("Failed to load more games.")
    } finally {
      setLoadingMoreGames(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 lg:p-4">
      {/* Responsive modal container */}
      <div className="bg-gray-900 w-full h-full lg:rounded-2xl lg:max-w-6xl lg:max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-gray-800">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 lg:top-4 lg:right-4 p-2 lg:p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-all z-10 backdrop-blur-sm"
          >
            <X className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>

          {/* Player Hero Section - Compact */}
          <div className="p-3 lg:p-6">
            <div className="flex items-start space-x-3 lg:space-x-4">
              {/* Player Image with Team Badge */}
              <div className="relative flex-shrink-0">
                <ImageWithFallback
                  src={photoUrl || "/placeholder.svg"}
                  alt={name}
                  className="w-14 h-14 lg:w-20 lg:h-20 rounded-xl object-cover border-2 border-blue-500/50"
                  fallbackSrc="/placeholder.svg?height=80&width=80"
                />
                <div className="absolute -bottom-1 -right-1 bg-gray-800 rounded-full p-1 border border-gray-600">
                  <ImageWithFallback
                    src={teamLogo || "/placeholder.svg"}
                    alt={team}
                    className="w-4 h-4 lg:w-6 lg:h-6"
                    fallbackSrc="/placeholder.svg?height=24&width=24"
                  />
                </div>
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg lg:text-2xl font-bold text-white truncate">{name}</h1>
                <div className="flex items-center text-gray-400 text-xs lg:text-sm">
                  <span className="truncate">{team}</span>
                  <span className="mx-1 lg:mx-2">•</span>
                  <span>{position}</span>
                  <span className="mx-1 lg:mx-2">•</span>
                  <span>#{teamPlayoffRank}</span>
                </div>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <span>vs</span>
                  <ImageWithFallback
                    src={opponentLogo || "/placeholder.svg"}
                    alt={opponent}
                    className="w-3 h-3 mx-1"
                    fallbackSrc="/placeholder.svg?height=12&width=12"
                  />
                  <span className="truncate">
                    {opponent} (#{opponentPlayoffRank})
                  </span>
                  <span className="mx-1">•</span>
                  <span>{gameDate}</span>
                </div>
                {/* Game Type & Time */}
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{gameTime}</span>
                  <span className="mx-1">•</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      gameType === "Playoffs" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {gameType}
                  </span>
                </div>
              </div>

              {/* Threshold & Recommendation - Compact */}
              <div className="bg-gray-800/50 p-2 lg:p-3 rounded-lg border border-gray-700 text-right">
                <div className="text-xs text-gray-400">Threshold</div>
                <div className="text-base lg:text-xl font-bold text-white">{threshold} pts</div>
                <div
                  className={`text-xs lg:text-sm font-semibold ${recommendationColor} flex items-center justify-end mt-1`}
                >
                  {recommendation.toLowerCase().includes("over") ? (
                    <TrendingUp className="mr-1 w-3 h-3" />
                  ) : (
                    <TrendingDown className="mr-1 w-3 h-3" />
                  )}
                  {recommendation}
                </div>
              </div>
            </div>

            {/* AI Recommendation Bar - Compact */}
            <div className="mt-3 bg-gray-800/30 rounded-lg p-2 lg:p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Activity className="text-blue-400 w-4 h-4 mr-2" />
                  <span className="text-xs lg:text-sm font-medium">AI Analysis</span>
                </div>
                <div className="flex space-x-2 lg:space-x-4 text-xs">
                  <span className="text-gray-400">
                    Poisson:{" "}
                    <span className={getProbabilityColor(poissonProbability)}>{poissonProbabilityFormatted}</span>
                  </span>
                  <span className="text-gray-400">
                    Monte Carlo:{" "}
                    <span className={getProbabilityColor(monteCarloProbability)}>{monteCarloFormatted}</span>
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-xs lg:text-sm leading-relaxed lg:line-clamp-none">
                {betExplanation.explanation}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 lg:p-6 space-y-3 lg:space-y-4">
            
            {/* More Player Role Data */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                  <div className="text-sm font-bold text-white">
                    {home_game === true ? "Home Game" : "Away Game"}
                  </div>
                </div>
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Importance Role</div>
                <div className="text-sm font-bold text-white">{importanceRole}</div>
              </div>
            </div>
            
            {/* Quick Stats Grid - Utilizing ALL your data */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Season Point Average</div>
                <div className={`text-sm font-bold ${getComparisonColor(seasonAvgPoints, threshold)}`}>
                  {formatNumber(seasonAvgPoints)}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Last 5 Game Point Average</div>
                <div className={`text-sm font-bold ${getComparisonColor(last5RegularGamesAvg, threshold)}`}>
                  {formatNumber(last5RegularGamesAvg)}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Point Average vs {opponent?.slice(0, 3)}</div>
                <div className={`text-sm font-bold ${getComparisonColor(seasonAvgVsOpponent, threshold)}`}>
                  {formatNumber(seasonAvgVsOpponent)}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Point Average - HOME</div>
                <div className={`text-sm font-bold ${getComparisonColor(points_home_avg, threshold)}`}>
                  {formatNumber(points_home_avg)}
                </div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Point Average - AWAY</div>
                <div className={`text-sm font-bold ${getComparisonColor(points_away_avg, threshold)}`}>
                  {formatNumber(points_away_avg)}
                </div>
              </div>
              {/* Point Under Count */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Point Under Count</div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(underCount)}
                </div>
              </div>
              {/* Average Minutes */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Average Minutes</div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(average_mins)}
                </div>
              </div>
            </div>

            {/* Playoff Stats Row - Only if playoff data exists */}
            {playoff_num_games > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                <div className="text-xs text-yellow-400">Current Score</div>
                <div className="text-sm font-bold text-white">
                  {playoff_curr_series_score}
                </div>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                  <div className="text-xs text-yellow-400">Playoff Point Avg</div>
                  <div className={`text-sm font-bold ${getComparisonColor(playoffAvg, threshold)}`}>
                    {formatNumber(playoff_points_avg)}
                  </div>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                  <div className="text-xs text-yellow-400">Playoff Point Avg - HOME</div>
                  <div className={`text-sm font-bold ${getComparisonColor(playoff_points_home_avg, threshold)}`}>
                    {formatNumber(playoff_points_home_avg)}
                  </div>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                  <div className="text-xs text-yellow-400">Playoff Point Avg - AWAY</div>
                  <div className={`text-sm font-bold ${getComparisonColor(playoff_points_away_avg, threshold)}`}>
                    {formatNumber(playoff_points_away_avg)}
                  </div>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                  <div className="text-xs text-yellow-400">Playoff Point Under Count</div>
                  <div className="text-sm font-bold text-white">
                    {playoff_underCount}
                  </div>
                </div>
                {volatilityPlayOffsForecast && volatilityPlayOffsForecast !== 0 && (
                  <div className="bg-yellow-500/10 p-2 rounded-lg text-center border border-yellow-500/20">
                    <div className="text-xs text-yellow-400">Playoff Volatility</div>
                    <div className="text-sm font-bold text-white">{formatNumber(volatilityPlayOffsForecast)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Volatility & Advanced Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {volatilityForecast && (
                <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                  <div className="flex items-center justify-center mb-1">
                    <BarChart3 className="w-3 h-3 text-blue-400 mr-1" />
                    <span className="text-xs text-gray-400">Volatility</span>
                  </div>
                  <div className="text-sm font-bold text-white">{formatNumber(volatilityForecast)}</div>
                </div>
              )}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">ChatGPT Confidence Range</div>
                <div className={`text-sm font-bold ${getProbabilityColor(betExplanation.confidenceRange)}`}>
                  {betExplanation.confidenceRange}
                </div>
              </div>


              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Poisson Probability</div>
                <div className={`text-sm font-bold ${getProbabilityColor(poissonProbability)}`}>
                  {poissonProbabilityFormatted}</div>
              </div>
              
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Monte Carlo Probability</div>
                  <div className={`text-sm font-bold ${getProbabilityColor(monteCarloProbability)}`}>
                    {monteCarloFormatted}</div>
              </div>
            </div>

            {/* ── Vegas & Market Data ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Spread */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Vegas Spread</div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(vegasSpread)}
                </div>
              </div>
              {/* Line details (e.g. “OKC -6.5”) */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Details</div>
                <div className="text-sm font-bold text-white">
                  {details || "—"}
                </div>
              </div>
              {/* Implied – Team */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Team Implied Pts</div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(teamImpliedPts)}
                </div>
              </div>
              {/* Implied – Opponent */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Opp Implied Pts</div>
                <div className="text-sm font-bold text-white">
                  {formatNumber(oppImpliedPts)}
                </div>
              </div>
              {/* Favorite? */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Favorites</div>
                <div className="text-sm font-bold text-white">
                  {favoriteFlag === 1 ? "Yes" : "No"}
                </div>
              </div>
              {/* Underdog? */}
              <div className="bg-gray-800/50 p-2 rounded-lg text-center">
                <div className="text-xs text-gray-400">Underdog</div>
                <div className="text-sm font-bold text-white">
                  {underdogFlag === 1 ? "Yes" : "No"}
                </div>
              </div>
            </div>

            {/* Injury Report – player + both teams */}
            {injuryReport && Object.keys(injuryReport).length > 0 && (
              <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700">
                {/* section title */}
                <div className="flex items-center mb-2">
                  <Heart className="w-4 h-4 text-red-400 mr-2" />
                  <span className="text-sm font-medium">Injury Report</span>
                </div>

                {/* ── Player line ───────────────────────── */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Player status:</span>
                  <span
                    className={`text-sm font-medium ${getInjuryStatusColor(
                      injuryReport.player_injured.status
                    )}`}
                  >
                    {injuryReport.player_injured.status || "Available"}
                  </span>
                </div>
                {injuryReport.player_injured.reason && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-400">Reason:&nbsp;</span>
                    <span className="text-xs text-gray-300">
                      {injuryReport.player_injured.reason}
                    </span>
                  </div>
                )}

                {/* ── TEAM injuries ─────────────────────── */}
                {injuryReport.teamInjuries &&
                  Object.keys(injuryReport.teamInjuries).length > 0 && (
                    <div className="mt-3">
                      <span className="block text-xs text-gray-400 mb-1">
                        Team Injuries ({Object.keys(injuryReport.teamInjuries).length})
                      </span>
                      <ul className="space-y-1">
                        {toInjuryArray(injuryReport.teamInjuries).map((p) => (
                          <li
                            key={p.player}
                            className="flex items-center justify-between bg-gray-800/20 p-1 rounded"
                          >
                            <span className="text-xs text-gray-300 truncate">
                              {p.player}
                            </span>
                            <span
                              className={`text-xs font-medium ${getInjuryStatusColor(
                                p.status
                              )}`}
                            >
                              {p.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* ── OPPONENT injuries ─────────────────── */}
                {injuryReport.opponentInjuries &&
                  Object.keys(injuryReport.opponentInjuries).length > 0 && (
                    <div className="mt-3">
                      <span className="block text-xs text-gray-400 mb-1">
                        Opponent Injuries (
                        {Object.keys(injuryReport.opponentInjuries).length})
                      </span>
                      <ul className="space-y-1">
                        {toInjuryArray(injuryReport.opponentInjuries).map((p) => (
                          <li
                            key={p.player}
                            className="flex items-center justify-between bg-gray-800/20 p-1 rounded"
                          >
                            <span className="text-xs text-gray-300 truncate">
                              {p.player}
                            </span>
                            <span
                              className={`text-xs font-medium ${getInjuryStatusColor(
                                p.status
                              )}`}
                            >
                              {p.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Expandable Sections */}

            {/* Playoff Games Section - Using your playoff_games data */}
            {playoff_num_games > 0 && playoff_games.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg overflow-hidden border border-gray-700">
                <button
                  className="w-full flex justify-between items-center p-3 hover:bg-gray-700/30 transition-colors"
                  onClick={() => toggleSection("playoffGames")}
                >
                  <div className="flex items-center">
                    <Trophy className="w-4 h-4 text-yellow-400 mr-2" />
                    <span className="text-sm font-medium">Playoff Games ({playoff_num_games})</span>
                    <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                      Avg: {formatNumber(playoff_points_avg)} pts
                    </span>
                  </div>
                  {expandedSection === "playoffGames" ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedSection === "playoffGames" && (
                  <div className="border-t border-gray-700">
                    <div className="p-3 space-y-2">
                      {playoff_games.map((game, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
                        >
                          <div className="flex items-center space-x-3">
                            <ImageWithFallback
                              src={game.opponentLogo || "/placeholder.svg"}
                              alt={game.opponent}
                              className="w-5 h-5"
                              fallbackSrc="/placeholder.svg?height=30&width=30"
                            />
                            <div>
                              <div className="text-sm font-medium">{game.opponentFullName || game.opponent}</div>
                              <div className="text-xs text-gray-400">
                                {game.date} • {game.round} • {'Game '}{game.game_number} • {'Curr Score: '}{game.series_score} • {game.location} 
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${getComparisonColor(game.points, threshold)}`}>
                              {game.points} pts
                            </div>
                            <div className="text-xs text-gray-400">{game.minutes}min</div>
                            <div
                              className={`text-xs font-medium ${game.points > threshold ? "text-green-400" : "text-red-400"}`}
                            >
                              {game.points > threshold ? "OVER" : "UNDER"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Regular Season Games */}
            <div className="bg-gray-800/30 rounded-lg overflow-hidden border border-gray-700">
              <button
                className="w-full flex justify-between items-center p-3 hover:bg-gray-700/30 transition-colors"
                onClick={() => toggleSection("recentGames")}
              >
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-green-400 mr-2" />
                  <span className="text-sm font-medium">Recent Season Games ({num_season_games})</span>
                  <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                      Avg: {formatNumber(seasonAvgPoints)} pts
                    </span>
                </div>
                {expandedSection === "recentGames" ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {expandedSection === "recentGames" && (
                <div className="border-t border-gray-700">
                  <div className="p-3 space-y-2">
                    {last5RegularGames.map((game, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <ImageWithFallback
                            src={game.opponentLogo || "/placeholder.svg"}
                            alt={game.opponent}
                            className="w-5 h-5"
                            fallbackSrc="/placeholder.svg?height=20&width=20"
                          />
                          <div>
                            <div className="text-sm font-medium">{game.opponentFullName || game.opponent}</div>
                            <div className="text-xs text-gray-400">
                              {game.date} • {game.location}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${getComparisonColor(game.points, threshold)}`}>
                            {game.points} pts
                          </div>
                          <div className="text-xs text-gray-400">{game.minutes}min</div>
                          <div
                            className={`text-xs font-medium ${game.points > threshold ? "text-green-400" : "text-red-400"}`}
                          >
                            {game.points > threshold ? "OVER" : "UNDER"}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Load More Games Button */}
                    <button
                      onClick={handleToggleMoreGames}
                      disabled={loadingMoreGames}
                      className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                    >
                      {loadingMoreGames ? "Loading..." : showMoreGames ? "Show Less" : "Load More Games"}
                    </button>

                    {/* More Games */}
                    {showMoreGames &&
                      moreGames.map((game, index) => (
                        <div
                          key={`more-${index}`}
                          className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <ImageWithFallback
                              src={game.opponentLogo || "/placeholder.svg"}
                              alt={game.opponent}
                              className="w-5 h-5"
                              fallbackSrc="/placeholder.svg?height=20&width=20"
                            />
                            <div>
                              <div className="text-sm font-medium">{game.opponentFullName || game.opponent}</div>
                              <div className="text-xs text-gray-400">
                                {game.date} • {game.location}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${getComparisonColor(game.points, threshold)}`}>
                              {game.points} pts
                            </div>
                            <div className="text-xs text-gray-400">{game.minutes}min</div>
                            <div
                              className={`text-xs font-medium ${game.points > threshold ? "text-green-400" : "text-red-400"}`}
                            >
                              {game.points > threshold ? "OVER" : "UNDER"}
                            </div>
                          </div>
                        </div>
                      ))}

                    {moreGamesError && <div className="text-red-400 text-sm text-center py-2">{moreGamesError}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Season vs Opponent - Using your season_games_agst_opp data */}
            {season_games_agst_opp.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg overflow-hidden border border-gray-700">
                <button
                  className="w-full flex justify-between items-center p-3 hover:bg-gray-700/30 transition-colors"
                  onClick={() => toggleSection("vsOpponent")}
                >
                  <div className="flex items-center">
                    <Target className="w-4 h-4 text-red-400 mr-2" />
                    <span className="text-sm font-medium">
                      vs {opponent} ({season_games_agst_opp.length})
                    </span>
                    <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                      Avg: {formatNumber(seasonAvgVsOpponent)} pts
                    </span>
                  </div>
                  {expandedSection === "vsOpponent" ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedSection === "vsOpponent" && (
                  <div className="border-t border-gray-700">
                    <div className="p-3 space-y-2">
                      {season_games_agst_opp.map((game, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 bg-red-500/10 rounded-lg border border-red-500/20"
                        >
                          <div className="flex items-center space-x-3">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium">{game.location}</div>
                              <div className="text-xs text-gray-400">{game.date}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${getComparisonColor(game.points, threshold)}`}>
                              {game.points} pts
                            </div>
                            <div className="text-xs text-gray-400">{game.minutes}min</div>
                            <div
                              className={`text-xs font-medium ${game.points > threshold ? "text-green-400" : "text-red-400"}`}
                            >
                              {game.points > threshold ? "OVER" : "UNDER"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Career Season Stats - Using your careerSeasonStats data */}
            {careerSeasonStats.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg overflow-hidden border border-gray-700">
                <button
                  className="w-full flex justify-between items-center p-3 hover:bg-gray-700/30 transition-colors"
                  onClick={() => toggleSection("careerStats")}
                >
                  <div className="flex items-center">
                    <BarChart3 className="w-4 h-4 text-purple-400 mr-2" />
                    <span className="text-sm font-medium">Career Stats ({careerSeasonStats.length} seasons)</span>
                  </div>
                  {expandedSection === "careerStats" ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedSection === "careerStats" && (
                  <div className="border-t border-gray-700 p-3">
                    <div className="space-y-2">
                      {careerSeasonStats.map((season, index) => (
                        <div key={index} className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-purple-400">{season.SEASON_ID}</span>
                            <span className="text-xs text-gray-400">{season.TEAM_ABBREVIATION}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <div className="text-gray-400">PPG</div>
                              <div className="font-bold text-white">{formatNumber(season.PTS)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">FG%</div>
                              <div className="font-bold text-white">{formatPercent(season.FG_PCT)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">3P%</div>
                              <div className="font-bold text-white">{formatPercent(season.FG3_PCT)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">GP</div>
                              <div className="font-bold text-white">{season.GP}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Action (only if adding to picks is enabled) */}
        {onAddToPicks && (
          <div className="flex-shrink-0 p-3 lg:p-4 bg-gray-900 border-t border-gray-700">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const gameDate = playerData.gameDate
                let dateStr = ""

                if (gameDate) {
                  const [month, day, year] = gameDate.split("/")
                  dateStr = `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`
                }

                const pickId = `${playerData.name.toLowerCase().replace(/\s+/g, "-")}_${threshold}_${dateStr}`

                onAddToPicks({
                  ...playerData,
                  id: pickId,
                  threshold,
                })
                onClose()
              }}
              className="w-full py-3 lg:py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 active:from-green-800 active:to-green-700 text-white font-medium rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              <span>Add to Picks</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerAnalysisModal

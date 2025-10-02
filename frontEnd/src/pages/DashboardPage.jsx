"use client"
import { useNavigate } from "react-router-dom"
import AppLayout from "../components/AppLayout"
import { TrendingUp, Clock, Flame, ChevronRight, Calendar } from "lucide-react"

export default function DashboardPage() {
  const navigate = useNavigate()

  const todaysGames = [
    {
      id: 1,
      homeTeam: "Lakers",
      awayTeam: "Celtics",
      homeTeamLogo: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
      awayTeamLogo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
      time: "7:30 PM ET",
      hotPicks: 5,
      isLive: false,
      homeRecord: "42-18",
      awayRecord: "45-15",
    },
    {
      id: 2,
      homeTeam: "Warriors",
      awayTeam: "Heat",
      homeTeamLogo: "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
      awayTeamLogo: "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
      time: "8:00 PM ET",
      hotPicks: 3,
      isLive: true,
      homeRecord: "38-22",
      awayRecord: "35-25",
    },
    {
      id: 3,
      homeTeam: "Nuggets",
      awayTeam: "Suns",
      homeTeamLogo: "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
      awayTeamLogo: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
      time: "10:00 PM ET",
      hotPicks: 7,
      isLive: false,
      homeRecord: "44-16",
      awayRecord: "40-20",
    },
  ]

  const upcomingGames = [
    {
      id: 4,
      homeTeam: "Bucks",
      awayTeam: "76ers",
      homeTeamLogo: "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
      awayTeamLogo: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
      date: "Tomorrow",
      time: "7:00 PM ET",
      hotPicks: 4,
    },
    {
      id: 5,
      homeTeam: "Mavericks",
      awayTeam: "Clippers",
      homeTeamLogo: "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
      awayTeamLogo: "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
      date: "Tomorrow",
      time: "8:30 PM ET",
      hotPicks: 6,
    },
  ]

  const hotPicks = [
    {
      id: 1,
      playerName: "LeBron James",
      team: "Lakers",
      stat: "Points",
      line: 25.5,
      pick: "OVER",
      confidence: 89,
      photoUrl: "https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png",
    },
    {
      id: 2,
      playerName: "Stephen Curry",
      team: "Warriors",
      stat: "3-Pointers",
      line: 4.5,
      pick: "OVER",
      confidence: 92,
      photoUrl: "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png",
    },
    {
      id: 3,
      playerName: "Giannis Antetokounmpo",
      team: "Bucks",
      stat: "Points",
      line: 28.5,
      pick: "OVER",
      confidence: 85,
      photoUrl: "https://cdn.nba.com/headshots/nba/latest/1040x760/203507.png",
    },
  ]

  const getConfidenceColor = (confidence) => {
    if (confidence >= 85) return "text-green-400 bg-green-500/20 border-green-500/30"
    if (confidence >= 70) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30"
    return "text-red-400 bg-red-500/20 border-red-500/30"
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Today's Action</h1>
            <p className="text-gray-400">Your AI-powered NBA betting insights, simplified.</p>
          </div>
          <div className="hidden lg:flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-lg">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-gray-300">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 p-4 rounded-lg border border-green-700/50">
            <div className="text-green-400 text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-white">67%</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 p-4 rounded-lg border border-blue-700/50">
            <div className="text-blue-400 text-sm mb-1">Active Picks</div>
            <div className="text-2xl font-bold text-white">12</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 p-4 rounded-lg border border-purple-700/50">
            <div className="text-purple-400 text-sm mb-1">Win Streak</div>
            <div className="text-2xl font-bold text-white">3 Games</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/30 p-4 rounded-lg border border-yellow-700/50">
            <div className="text-yellow-400 text-sm mb-1">Hot Picks</div>
            <div className="text-2xl font-bold text-white">{hotPicks.length}</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Flame className="w-6 h-6 text-orange-500 mr-2" />
              <h2 className="text-2xl font-bold text-white">Today's Games</h2>
            </div>
            <span className="text-sm text-gray-400">{todaysGames.length} games</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {todaysGames.map((game) => (
              <div
                key={game.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group"
                onClick={() => navigate("/processed-players")}
              >
                {game.isLive && (
                  <div className="flex items-center mb-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                    <span className="text-red-400 text-xs font-semibold uppercase">Live</span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3 flex-1">
                    <img src={game.awayTeamLogo || "/placeholder.svg"} alt={game.awayTeam} className="w-12 h-12" />
                    <div>
                      <div className="text-white font-semibold">{game.awayTeam}</div>
                      <div className="text-gray-400 text-sm">{game.awayRecord}</div>
                    </div>
                  </div>
                  <div className="text-gray-500 font-bold">@</div>
                  <div className="flex items-center space-x-3 flex-1 justify-end">
                    <div className="text-right">
                      <div className="text-white font-semibold">{game.homeTeam}</div>
                      <div className="text-gray-400 text-sm">{game.homeRecord}</div>
                    </div>
                    <img src={game.homeTeamLogo || "/placeholder.svg"} alt={game.homeTeam} className="w-12 h-12" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <div className="flex items-center text-gray-400 text-sm">
                    <Clock className="w-4 h-4 mr-1" />
                    {game.time}
                  </div>
                  <div className="flex items-center text-orange-400 text-sm font-semibold">
                    <Flame className="w-4 h-4 mr-1" />
                    {game.hotPicks} Hot Picks
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View All Players
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-green-500 mr-2" />
              <h2 className="text-2xl font-bold text-white">Trending Picks Right Now</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {hotPicks.map((pick) => (
              <div
                key={pick.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 hover:border-green-500 transition-all cursor-pointer group"
                onClick={() => navigate("/processed-players")}
              >
                <div className="flex items-center mb-4">
                  <img
                    src={pick.photoUrl || "/placeholder.svg"}
                    alt={pick.playerName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-600 mr-4"
                  />
                  <div className="flex-1">
                    <div className="text-white font-bold text-lg">{pick.playerName}</div>
                    <div className="text-gray-400 text-sm">{pick.team}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">{pick.stat}</div>
                    <div className="text-white text-xl font-bold">
                      {pick.pick} {pick.line}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg border ${getConfidenceColor(pick.confidence)}`}>
                    <div className="text-xs font-semibold">{pick.confidence}%</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-700 flex items-center justify-center text-green-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  View Full Analysis
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className="text-2xl font-bold text-white">Upcoming Games</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingGames.map((game) => (
              <div
                key={game.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group"
                onClick={() => navigate("/processed-players")}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3 flex-1">
                    <img src={game.awayTeamLogo || "/placeholder.svg"} alt={game.awayTeam} className="w-10 h-10" />
                    <div className="text-white font-semibold">{game.awayTeam}</div>
                  </div>
                  <div className="text-gray-500 font-bold">@</div>
                  <div className="flex items-center space-x-3 flex-1 justify-end">
                    <div className="text-white font-semibold">{game.homeTeam}</div>
                    <img src={game.homeTeamLogo || "/placeholder.svg"} alt={game.homeTeam} className="w-10 h-10" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <div className="text-gray-400 text-sm">{game.date}</div>
                  <div className="flex items-center text-gray-400 text-sm">
                    <Clock className="w-4 h-4 mr-1" />
                    {game.time}
                  </div>
                  <div className="flex items-center text-orange-400 text-sm font-semibold">
                    <Flame className="w-4 h-4 mr-1" />
                    {game.hotPicks} Picks
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

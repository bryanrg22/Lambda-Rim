"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  MessageCircle,
  UserPlus,
  UserCheck,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
  ExternalLink,
  Trophy,
  Activity,
  Clock,
} from "lucide-react"
import AppLayout from "../components/AppLayout"
import { getUserProfile, getBetHistory }        from "../services/firebaseService"


export default function PublicProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFriend, setIsFriend] = useState(false)
  const [friendRequestSent, setFriendRequestSent] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // Get current user
        const userId = sessionStorage.getItem("currentUser")
        setCurrentUser(userId)

        // 1️⃣ pull the user doc from Firestore
        const raw = await getUserProfile(username)
        if (!raw) {                       // user doesn’t exist
          navigate("/community")
          return
        }

        // 2️⃣ flatten old/new schema shapes and supply safe defaults
        const profile = raw.profile ? { ...raw.profile } : { ...raw }

        // 🔄 fetch completed bets (limit to 10 for now)
        const rawHistory = await getBetHistory(username);
        const recentHistory = rawHistory.slice(0, 10).map((b) => ({
          id:           b.id,
          date:         (b.settledAt?.seconds
                          ? new Date(b.settledAt.seconds * 1000)
                          : new Date()).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
          amount:       b.betAmount,
          payOut:       b.betPayOut,
          result:       b.betResult || b.status,        // "Won" | "Lost"
          winnings:     b.winnings   || 0,
          picks:        b.picks.map((p) => p.name || p.playerName || p.player),
        }));


        setUserProfile({
          id:           username,
          username,
          displayName:  profile.displayName || username,
          pfp:          profile.pfp || profile.photoURL || "/default_pfp.jpg",
          bio:          profile.bio        || "",
          location:     profile.location   || "",
          website:      profile.website    || "",
          joinDate:     profile.createdAt?.seconds
                          ? new Date(profile.createdAt.seconds * 1000).toISOString()
                          : null,
          winCount:     profile.winCount   || 0,
          totalBets:    profile.totalBets  || 0,
          totalEarnings:profile.totalEarnings || 0,
          isOnline:     true,              // real presence can come later
          lastSeen:     "just now",
          socialLinks:  profile.socialLinks || {},
          recentBets:   recentHistory   || [],
          achievements: profile.achievements || [],
          privacySettings: profile.privacySettings || {
            showStats:      true,
            showBetHistory: true,
            allowMessages:  true,
          },
        })

      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      loadUserProfile()
    }
  }, [username, navigate])

  const handleFriendAction = () => {
    if (isFriend) {
      setIsFriend(false)
      alert("Friend removed")
    } else if (friendRequestSent) {
      setFriendRequestSent(false)
      alert("Friend request cancelled")
    } else {
      setFriendRequestSent(true)
      alert("Friend request sent!")
    }
  }

  const handleMessage = () => {
    alert("Message feature coming soon!")
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AppLayout>
    )
  }

  if (!userProfile) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-white mb-4">User Not Found</h2>
          <p className="text-gray-400 mb-6">The profile you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate("/community")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Community
          </button>
        </div>
      </AppLayout>
    )
  }

  const winRate = ((userProfile.winCount / Math.max(userProfile.totalBets, 1)) * 100).toFixed(1)

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl p-8 border border-gray-700">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Avatar Section */}
            <div className="relative">
              <img
                src={userProfile.pfp || "/placeholder.svg"}
                alt={userProfile.displayName}
                className="w-32 h-32 rounded-full border-4 border-blue-500 object-cover"
              />
              <div
                className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-2 border-gray-800 ${
                  userProfile.isOnline ? "bg-green-500" : "bg-gray-500"
                }`}
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{userProfile.displayName}</h1>
                <div className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs font-medium">VERIFIED</div>
              </div>
              <p className="text-gray-400 mb-2">@{userProfile.username}</p>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${userProfile.isOnline ? "bg-green-500" : "bg-gray-500"}`} />
                  <span className="text-sm text-gray-400">
                    {userProfile.isOnline ? "Online now" : `Last seen ${userProfile.lastSeen}`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">
                    Joined {new Date(userProfile.joinDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-gray-300 mb-6">{userProfile.bio}</p>

              {/* Action Buttons */}
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={handleFriendAction}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    isFriend
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : friendRequestSent
                        ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isFriend ? (
                    <>
                      <UserCheck className="w-5 h-5" />
                      <span>Friends</span>
                    </>
                  ) : friendRequestSent ? (
                    <>
                      <Clock className="w-5 h-5" />
                      <span>Request Sent</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      <span>Add Friend</span>
                    </>
                  )}
                </button>

                {userProfile.privacySettings.allowMessages && (
                  <button
                    onClick={handleMessage}
                    className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Message</span>
                  </button>
                )}
              </div>

              {/* Stats */}
              {userProfile.privacySettings.showStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400">Win Rate</span>
                    </div>
                    <div className="text-lg font-bold text-green-400">{winRate}%</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">Earnings</span>
                    </div>
                    <div className="text-lg font-bold text-blue-400">${userProfile.totalEarnings.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400">Total Bets</span>
                    </div>
                    <div className="text-lg font-bold text-purple-400">{userProfile.totalBets}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-1">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">Wins</span>
                    </div>
                    <div className="text-lg font-bold text-yellow-400">{userProfile.winCount}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Activity */}
            {userProfile.privacySettings.showBetHistory && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center space-x-3 mb-6">
                  {userProfile.recentBets.length === 0 && (
                    <p className="text-gray-400">No settled bets yet.</p>
                  )}
                  <Activity className="w-6 h-6 text-blue-400" />
                  <h2 className="text-2xl font-bold text-white">Recent Betting Activity</h2>
                </div>


                <div className="space-y-4">
                  {userProfile.recentBets.map((bet) => (
                    <div key={bet.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">{bet.date}</span>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            bet.result === "Won"
                              ? "bg-green-900/30 text-green-400 border border-green-700/30"
                              : "bg-red-900/30 text-red-400 border border-red-700/30"
                          }`}
                        >
                          {bet.result}
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {(bet.picks || []).map((pick, index) => (
                          <div key={index} className="text-white font-medium">
                            • {pick}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Bet Amount: ${bet.amount}</span>
                        {bet.result === "Won" && (
                          <span className="text-green-400 font-medium">Won: ${bet.winnings}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-bold text-white mb-4">Contact Info</h3>
              <div className="space-y-3">
                {userProfile.location && (
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">📍</span>
                    <span className="text-gray-300">{userProfile.location}</span>
                  </div>
                )}
                {userProfile.website && (
                  <div className="flex items-center space-x-3">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                    <a
                      href={userProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Website
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Social Links */}
            {Object.keys(userProfile.socialLinks).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">Social Media</h3>
                <div className="space-y-3">
                  {Object.entries(userProfile.socialLinks).map(([platform, url]) => {
                    const platformConfig = {
                      twitter: { name: "Twitter", icon: "🐦", color: "text-blue-400" },
                      youtube: { name: "YouTube", icon: "📺", color: "text-red-400" },
                      twitch: { name: "Twitch", icon: "🎮", color: "text-purple-400" },
                      instagram: { name: "Instagram", icon: "📷", color: "text-pink-400" },
                      tiktok: { name: "TikTok", icon: "🎵", color: "text-gray-300" },
                    }

                    const config = platformConfig[platform]
                    if (!config) return null

                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center space-x-3 ${config.color} hover:opacity-80 transition-opacity`}
                      >
                        <span>{config.icon}</span>
                        <span>{config.name}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

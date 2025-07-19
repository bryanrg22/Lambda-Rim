"use client"
import { useEffect, useRef, useState } from "react"
import {
  Search,
  Users,
  TrendingUp,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import AppLayout from "../components/AppLayout"

/* -----------------------------------------------------------
1️⃣  List every Twitch channel you want to show
----------------------------------------------------------- */
const twitchChannels = ["jasontheween", "ddg", "jaycincoo5", "yurnboi"]

/* -----------------------------------------------------------
   Single‑player wrapper (one per channel)
   ----------------------------------------------------------- */
function TwitchPlayer({ channel, viewerCount = Math.floor(Math.random() * 5000) + 100 }) {
  const playerRef = useRef(null)

  useEffect(() => {
    const host = window.location.hostname
    const createPlayer = () => {
      if (playerRef.current && playerRef.current.childElementCount === 0) {
        new window.Twitch.Player(playerRef.current, {
          channel,
          width: "100%",
          height: 400,
          parent: [host],
        }).setVolume(0.5)
      }
    }

    if (!window.Twitch) {
      let sdk = document.getElementById("twitch-embed-sdk")
      if (!sdk) {
        sdk = document.createElement("script")
        sdk.id = "twitch-embed-sdk"
        sdk.src = "https://player.twitch.tv/js/embed/v1.js"
        sdk.async = true
        sdk.onload = createPlayer
        document.body.appendChild(sdk)
      } else {
        sdk.addEventListener("load", createPlayer)
      }
    } else {
      createPlayer()
    }
  }, [channel])

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300 group">
      {/* Stream Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={`/placeholder.svg?height=40&width=40&text=${channel[0].toUpperCase()}`}
                alt={channel}
                className="w-10 h-10 rounded-full border-2 border-purple-500"
              />
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                LIVE
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white capitalize">{channel}</h3>
              <p className="text-sm text-gray-400">Sports Betting • NBA Picks</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-600 text-white px-2 py-1 rounded-md text-xs font-medium">Twitch</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount.toLocaleString()}
            </span>
            <span className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              Hot Picks
            </span>
          </div>
        </div>
      </div>

      {/* Player Container */}
      <div ref={playerRef} className="w-full h-[400px] bg-gray-900" />

      {/* Stream Footer */}
      <div className="p-4 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
              <Heart className="w-4 h-4" />
              <span>Follow</span>
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          <a
            href={`https://twitch.tv/${channel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Watch on</span>
            <img
                src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Twitch_logo_2019.svg"
                alt="Twitch Logo"
                className="w-12 h-12 mr-10"
            />
          </a>
        </div>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------
1️⃣  List every Kick channel you want to show
----------------------------------------------------------- */
const kickChannels = ["joeykaotyk", "trainwreckstv", "chuckybtz", "jsimon_10"]

/* -----------------------------------------------------------
    Re‑usable player component
----------------------------------------------------------- */
function KickPlayer({ username, viewerCount = Math.floor(Math.random() * 3000) + 50 }) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300 group">
      {/* Stream Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={`/placeholder.svg?height=40&width=40&text=${username[0].toUpperCase()}`}
                alt={username}
                className="w-10 h-10 rounded-full border-2 border-green-500"
              />
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                LIVE
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white capitalize">{username}</h3>
              <p className="text-sm text-gray-400">Sports Betting • Live Reactions</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-green-600 text-white px-2 py-1 rounded-md text-xs font-medium">Kick</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount.toLocaleString()}
            </span>
            <span className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              Trending
            </span>
          </div>
        </div>
      </div>

      {/* Player Container */}
      <iframe
        src={`https://player.kick.com/${username}`}
        title={`${username} live stream on Kick`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        width="100%"
        height="400"
        frameBorder="0"
        className="bg-gray-900"
      />

      {/* Stream Footer */}
      <div className="p-4 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
              <Heart className="w-4 h-4" />
              <span>Follow</span>
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          <a
            href={`https://kick.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Watch on</span>
            <img
                src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Kick_logo.svg"
                alt="Kick Logo"
                className="w-12 h-12 mr-10"
            />
          </a>
        </div>
      </div>
    </div>
  )
}

/* -----------------------------------------------------------
1️⃣  Put every post you want to show in this array
----------------------------------------------------------- */
const tiktokVideos = [
  {
    url: "https://www.tiktok.com/@potionparlay/video/7528679778161937694",
    id: "7528679778161937694",
    creator: "potionparlay",
    timestamp: "2h ago",
  },
  {
    url: "https://www.tiktok.com/@bookie.hater/video/7528606038665268493",
    id: "7528606038665268493",
    creator: "bookie.hater",
    timestamp: "4h ago",
  },
  {
    url: "https://www.tiktok.com/@pickfinder00/video/7528674906188401951",
    id: "7528674906188401951",
    creator: "pickfinder00",
    timestamp: "6h ago",
  },
  {
    url: "https://www.tiktok.com/@ludatran/video/7528635133646163255",
    id: "7528635133646163255",
    creator: "ludatran",
    timestamp: "8h ago",
  },
]

/* -----------------------------------------------------------
Single‑video wrapper
----------------------------------------------------------- */
function TikTokEmbed({ url, id, creator, timestamp }) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300 group">
      {/* Creator Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={`/placeholder.svg?height=32&width=32&text=${creator[0].toUpperCase()}`}
              alt={creator}
              className="w-8 h-8 rounded-full border-2 border-pink-500"
            />
            <div>
              <h4 className="font-semibold text-white">@{creator}</h4>
              <p className="text-xs text-gray-400">{timestamp}</p>
            </div>
          </div>
          <img
            src="https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg"
            alt="TikTok Logo"
            className="w-20 h-20 mr-2"
        />
        </div>
      </div>

      {/* TikTok Embed */}
      <blockquote className="tiktok-embed" cite={url} data-video-id={id} style={{ maxWidth: 0, minWidth: 320 }}>
        <section>
          Watch on&nbsp;
          <a href={url} target="_blank" rel="noreferrer">
            TikTok
          </a>
        </section>
      </blockquote>
    </div>
  )
}

// Mock creator data
const topCreators = [
  {
    id: 1,
    name: "BetKing Pro",
    handle: "@betkingpro",
    avatar: "/placeholder.svg?height=60&width=60&text=BK",
    specialties: ["NBA Props", "Bankroll Mgmt"],
    winRate: "78%",
    roi: "+24.5%",
    followers: "125K",
    platforms: ["twitch", "twitter", "youtube"],
    verified: true,
  },
  {
    id: 2,
    name: "Sharp Shooter",
    handle: "@sharpshooter",
    avatar: "/placeholder.svg?height=60&width=60&text=SS",
    specialties: ["Live Betting", "Player Props"],
    winRate: "72%",
    roi: "+18.2%",
    followers: "89K",
    platforms: ["kick", "twitter", "tiktok"],
    verified: true,
  },
  {
    id: 3,
    name: "Parlay Master",
    handle: "@parlaymaster",
    avatar: "/placeholder.svg?height=60&width=60&text=PM",
    specialties: ["Same Game Parlays", "NBA Analysis"],
    winRate: "69%",
    roi: "+15.8%",
    followers: "67K",
    platforms: ["twitch", "youtube", "instagram"],
    verified: false,
  },
  {
    id: 4,
    name: "Odds Oracle",
    handle: "@oddsoracle",
    avatar: "/placeholder.svg?height=60&width=60&text=OO",
    specialties: ["Value Betting", "Line Movement"],
    winRate: "75%",
    roi: "+21.3%",
    followers: "103K",
    platforms: ["kick", "twitter", "discord"],
    verified: true,
  },
  {
    id: 5,
    name: "Prop Prophet",
    handle: "@propprophet",
    avatar: "/placeholder.svg?height=60&width=60&text=PP",
    specialties: ["Player Props", "Statistical Analysis"],
    winRate: "71%",
    roi: "+19.7%",
    followers: "78K",
    platforms: ["tiktok", "youtube", "twitter"],
    verified: true,
  },
]

function CreatorCard({ creator }) {
  const getPlatformIcon = (platform) => {
    const icons = {
      twitch: "🟣",
      kick: "🟢",
      youtube: "🔴",
      twitter: "🔵",
      tiktok: "🟡",
      instagram: "🟠",
      discord: "🟦",
    }
    return icons[platform] || "⚪"
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 group min-w-[300px] flex-shrink-0">
      {/* Creator Header */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="relative">
          <img
            src={creator.avatar || "/placeholder.svg"}
            alt={creator.name}
            className="w-16 h-16 rounded-full border-2 border-blue-500"
          />
          {creator.verified && (
            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">{creator.name}</h3>
          <p className="text-gray-400">{creator.handle}</p>
          <p className="text-sm text-gray-500">{creator.followers} followers</p>
        </div>
      </div>

      {/* Specialties */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Specialties</h4>
        <div className="flex flex-wrap gap-2">
          {creator.specialties.map((specialty, index) => (
            <span
              key={index}
              className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md text-xs border border-blue-700/30"
            >
              {specialty}
            </span>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Win Rate</p>
          <p className="text-lg font-bold text-green-400">{creator.winRate}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">ROI</p>
          <p className="text-lg font-bold text-green-400">{creator.roi}</p>
        </div>
      </div>

      {/* Platform Links */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          {creator.platforms.map((platform, index) => (
            <button
              key={index}
              className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
              title={platform}
            >
              <span className="text-sm">{getPlatformIcon(platform)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Follow Button */}
      <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200">
        Follow
      </button>
    </div>
  )
}

export default function CommunityPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [showMoreTikToks, setShowMoreTikToks] = useState(false)
  const creatorScrollRef = useRef(null)

  /* -----------------------------------------------------------
     2️⃣  Load the TikTok SDK once
     ----------------------------------------------------------- */
  useEffect(() => {
    const src = "https://www.tiktok.com/embed.js"
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script")
      s.src = src
      s.async = true
      document.body.appendChild(s)
    } else {
      window.tiktokEmbed?.load?.()
    }
  }, [])

  const scrollCreators = (direction) => {
    if (creatorScrollRef.current) {
      const scrollAmount = 320 // Width of card + gap
      creatorScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  const allStreams = [
    ...twitchChannels.map((channel) => ({ type: "twitch", channel })),
    ...kickChannels.map((channel) => ({ type: "kick", channel })),
  ]

  const filteredStreams =
    selectedFilter === "all" ? allStreams : allStreams.filter((stream) => stream.type === selectedFilter)

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
              Betting Community Hub
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Connect with top sports betting creators across platforms. Discover live streams, expert picks, and
              winning strategies.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search for creators, picks, or strategies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-blue-400">150+</div>
              <div className="text-sm text-gray-400">Active Creators</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-green-400">78%</div>
              <div className="text-sm text-gray-400">Avg Win Rate</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-purple-400">24/7</div>
              <div className="text-sm text-gray-400">Live Content</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700">
              <div className="text-2xl font-bold text-pink-400">50K+</div>
              <div className="text-sm text-gray-400">Community Members</div>
            </div>
          </div>
        </div>

        {/* Creator Spotlight Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-white">Top Betting Creators</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => scrollCreators("left")}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <button
                onClick={() => scrollCreators("right")}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Horizontal Scrollable Creator Cards */}
          <div
            ref={creatorScrollRef}
            className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {topCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        </div>

        {/* Live Streams Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-3xl font-bold text-white">Live Now</h2>
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">LIVE</div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={() => setSelectedFilter("all")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedFilter === "all" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedFilter("twitch")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedFilter === "twitch" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Twitch
                </button>
                <button
                  onClick={() => setSelectedFilter("kick")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedFilter === "kick" ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Kick
                </button>
              </div>
            </div>
          </div>

          {/* Live Streams Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredStreams.map((stream, index) => (
              <div key={`${stream.type}-${stream.channel}-${index}`}>
                {stream.type === "twitch" ? (
                  <TwitchPlayer channel={stream.channel} />
                ) : (
                  <KickPlayer username={stream.channel} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Feed Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-white">Latest TikTok Picks</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Updated 5 minutes ago</span>
            </div>
          </div>

          {/* Masonry Grid of TikTok Embeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tiktokVideos.slice(0, showMoreTikToks ? tiktokVideos.length : 4).map(({ url, id, creator, timestamp }) => (
              <TikTokEmbed key={id} url={url} id={id} creator={creator} timestamp={timestamp} />
            ))}
          </div>

          {/* Load More Button */}
          {!showMoreTikToks && tiktokVideos.length > 4 && (
            <div className="text-center">
              <button
                onClick={() => setShowMoreTikToks(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Load More Picks
              </button>
            </div>
          )}
        </div>

        {/* Community Stats Footer */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-1">2.5M+</div>
              <div className="text-sm text-gray-400">Total Views</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400 mb-1">15K+</div>
              <div className="text-sm text-gray-400">Winning Picks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400 mb-1">500+</div>
              <div className="text-sm text-gray-400">Live Hours Daily</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-pink-400 mb-1">95%</div>
              <div className="text-sm text-gray-400">User Satisfaction</div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

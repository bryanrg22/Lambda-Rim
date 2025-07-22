"use client"
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Home, LogOut, History, Bell, ListChecks, Menu, X, PersonStanding} from "lucide-react"
import { getUserProfile } from "../services/firebaseService"
import { auth } from "../firebase"
import { signOut } from "firebase/auth"

export default function AppLayout({ children }) {
  const [userProfile, setUserProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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
          // Get user profile
          const profile = await getUserProfile(userId)
          if (!profile) {
            console.error("User profile not found")
            navigate("/")
            return
          }
          setUserProfile(profile)
        } catch (profileError) {
          console.error("Error loading user profile:", profileError)
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }

    loadUserData()
  }, [navigate])

  // Total earnings from user profile
  const totalEarnings = userProfile?.totalEarnings || 0

  const handleSignOut = async () => {
    await signOut(auth);
    sessionStorage.removeItem("currentUser")
    navigate("/") // Navigate to the SignIn page
  }

  const NavItem = ({ path, icon: Icon, label, mobile = false }) => {
    const isActive = location.pathname === path

    return (
      <button
        className={`flex items-center ${
          mobile
            ? `w-full px-4 py-4 text-left ${
                isActive
                  ? "text-white bg-blue-600 rounded-lg"
                  : "text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              }`
            : `px-3 py-2 ${isActive ? "text-white bg-gray-700 rounded-md" : "text-gray-400 hover:text-white"}`
        } text-sm font-medium transition-colors`}
        onClick={() => {
          navigate(path)
          if (mobile) setMobileMenuOpen(false)
        }}
      >
        <Icon className={`${mobile ? "w-6 h-6 mr-4" : "w-4 h-4 mr-2"}`} />
        <span className={mobile ? "text-base" : ""}>{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Mobile Header */}
      <header className="bg-gray-800 lg:hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/lambdaRimLogo.png"
              alt="PrizePicks Logo"
              className="w-8 h-8"
              style={{
                aspectRatio: "1/1",
                objectFit: "contain",
              }}
            />
            <span className="text-lg font-semibold">Lambda Rim</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <img
                alt="User avatar"
                className="w-8 h-8 rounded-full"
                src={userProfile?.pfp || "/placeholder.svg?height=32&width=32"}
                style={{
                  aspectRatio: "1/1",
                  objectFit: "cover",
                }}
              />
              <span className="text-sm font-medium hidden sm:block">{userProfile?.displayName || currentUser}</span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="bg-gray-800 py-5 hidden lg:block">
        <div className="container mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <img
              src="/lambdaRimLogo.png"
              alt="PrizePicks Logo"
              className="w-8 h-8"
              style={{
                aspectRatio: "1/1",
                objectFit: "contain",
              }}
            />
            <span className="text-xl font-semibold">Lambda Rim</span>
          </div>
          <nav className="flex space-x-5">
            <NavItem path="/dashboard" icon={Home} label="Home" />
            <NavItem path="/processed-players" icon={ListChecks} label="Already Processed Players" />
            <NavItem path="/previous-bets" icon={History} label="Previous Bets" />
            <NavItem path="/community" icon={PersonStanding} label="Community"  />
            <NavItem path="/profile" icon={PersonStanding} label="Profile"  />
            <NavItem path="/alerts" icon={Bell} label="Alerts" />
          </nav>
          <div className="flex items-center space-x-4">
            <img
              alt="User avatar"
              className="w-8 h-8 rounded-full"
              src={userProfile?.pfp || "/placeholder.svg?height=32&width=32"}
              style={{
                aspectRatio: "1/1",
                objectFit: "cover",
              }}
            />
            <div className="text-sm">
              <p className="font-medium">{userProfile?.displayName || currentUser}</p>
              <p className="text-gray-400">@{currentUser}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md flex items-center"
            >
              <LogOut className="w-4 h-4 mr-1" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-gray-800 shadow-xl">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    alt="User avatar"
                    className="w-12 h-12 rounded-full"
                    src={userProfile?.pfp || "/placeholder.svg?height=48&width=48"}
                    style={{
                      aspectRatio: "1/1",
                      objectFit: "cover",
                    }}
                  />
                  <div>
                    <p className="font-medium">{userProfile?.displayName || currentUser}</p>
                    <p className="text-gray-400 text-sm">@{currentUser}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <nav className="p-5 space-y-2">
              <NavItem path="/dashboard" icon={Home} label="Home" mobile />
              <NavItem path="/processed-players" icon={ListChecks} label="Already Processed Players" mobile />
              <NavItem path="/previous-bets" icon={History} label="Previous Bets" mobile />
              <NavItem path="/community" icon={PersonStanding} label="Community" mobile />
              <NavItem path="/profile" icon={PersonStanding} label="Profile"  mobile />
              <NavItem path="/alerts" icon={Bell} label="Alerts" mobile />
            </nav>

            <div className="absolute bottom-5 left-5 right-5">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex items-center justify-center transition-colors"
              >
                <LogOut className="w-5 h-5 mr-2" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-4 lg:py-8">
          {/* Warning Banner */}
          <div className="bg-gray-800 p-4 lg:p-6 rounded-lg mb-4 lg:mb-8">
            <h2 className="text-lg lg:text-xl font-bold mb-2 text-yellow-400">WARNING - PLAY AT YOUR OWN RISK</h2>
            <p className="text-gray-300 text-sm lg:text-base">
              This website is currently in beta and testflight mode. Additionally, our model currently only does
              statistics on player points in the NBA, with its focus specifically on 'Over' points.
            </p>
          </div>

          {/* Earnings Banner */}
          <div className="bg-gradient-to-r from-green-900 to-green-700 p-4 lg:p-6 rounded-lg mb-4 lg:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div className="mb-2 sm:mb-0">
                <h2 className="text-lg lg:text-xl font-bold mb-1">Total Earnings</h2>
                <p className="text-gray-200 text-sm lg:text-base">Keep up the good work! Your picks are paying off.</p>
              </div>
              <div className="text-2xl lg:text-4xl font-bold">${totalEarnings.toFixed(2)}</div>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}

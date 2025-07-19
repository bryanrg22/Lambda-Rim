"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, User, Lock, Shield } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  getUserByUsername,
  verifyUserPassword,
  initializeUser,
  initializeDatabase,
  upsertUserFromAuthUser,
} from "../services/firebaseService"
import { auth, googleProvider } from "../firebase"
import { signInWithPopup } from "firebase/auth"

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  // Initialize database on component mount (only runs once)
  useEffect(() => {
    const initDB = async () => {
      try {
        // Initialize database for bryanram user
        await initializeDatabase("bryanram")
      } catch (error) {
        console.error("Error initializing database:", error)
      }
    }

    initDB()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // For debugging - log the username and password
      console.log("Attempting login with:", username, password)

      // Check if user exists in Firestore
      const userData = await getUserByUsername(username)
      console.log("User data:", userData)

      if (!userData) {
        setError("No account found with this username.")
        setLoading(false)
        return
      }

      // Check if password matches (handles both old and new structure)
      if (!verifyUserPassword(userData, password)) {
        setError("Incorrect password.")
        setLoading(false)
        return
      }

      // Initialize user if needed (this will migrate to new structure if needed)
      await initializeUser(username, password)

      // Store username in sessionStorage for use across the app
      sessionStorage.setItem("currentUser", username)

      // Login successful
      console.log("Login successful, navigating to HomePage")
      navigate("/HomePage")
    } catch (error) {
      console.error("Error during authentication:", error)
      setError(`Authentication error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userId = await upsertUserFromAuthUser(cred.user, "google");
      sessionStorage.setItem("currentUser", userId);
      navigate("/HomePage");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>

      <main className="relative flex-grow flex flex-col items-center justify-center px-4 py-12">
        {/* Logo and Branding */}
        <div className="text-center text-white mb-12">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
            <img
              src="/lambdaRimLogo.png"
              alt="Lambda Rim Logo"
              className="relative w-32 h-32 mx-auto drop-shadow-2xl"
              style={{
                aspectRatio: "1/1",
                objectFit: "contain",
              }}
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent mb-3">
            Lambda Rim
          </h1>
          <p className="text-xl text-gray-300 font-medium">Because 99% ain't a free throw</p>
        </div>

        {/* Sign In Card */}
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
            {/* Card Header */}
            <div className="px-8 pt-8 pb-6 bg-gradient-to-r from-gray-800/50 to-gray-700/50">
              <h2 className="text-2xl font-bold text-white text-center mb-2">Welcome Back</h2>
              <p className="text-gray-400 text-center text-sm">Sign in to access your dashboard</p>
            </div>

            {/* Form */}
            <div className="px-8 pb-8">
              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                  <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <label htmlFor="username" className="sr-only">
                    Username
                  </label>
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="block w-full pl-12 pr-4 py-4 border border-gray-600/50 rounded-xl leading-5 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200 backdrop-blur-sm"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="block w-full pl-12 pr-12 py-4 border border-gray-600/50 rounded-xl leading-5 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200 backdrop-blur-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Processing...
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl border border-gray-600/50 text-white bg-gray-700/50 hover:bg-gray-600/60 transition-all"
                  disabled={loading}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                    alt="Google Logo"
                    className="w-5 h-5"
                  />
                  Continue with Google
                </button>
              </div>

              {/* Admin Portal Link */}
              <div className="mt-8 pt-6 border-t border-gray-700/50">
                <button
                  onClick={() => navigate("/admin")}
                  className="w-full flex items-center justify-center py-3 px-4 text-sm text-gray-400 hover:text-white transition-colors group"
                >
                  <Shield className="w-4 h-4 mr-2 group-hover:text-orange-400 transition-colors" />
                  <span>Admin Portal Access</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-6 text-center text-gray-400">
        <p className="text-sm">&copy; 2025 Lambda Rim. All rights reserved.</p>
      </footer>
    </div>
  )
}

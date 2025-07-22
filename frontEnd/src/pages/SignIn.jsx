"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, User, Lock, Shield } from 'lucide-react'
import { useNavigate } from "react-router-dom"
import {
  emailSignIn,
  emailSignUp,
  signInWithProviderAndLink,
  humanMessage,
} from "../services/firebaseService"
import { auth, googleProvider, microsoftProvider } from "../firebase"
import { signInWithPopup,
         signInWithEmailAndPassword,
         sendEmailVerification,
         signOut
 } from "firebase/auth" 

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")     
  const [showResend, setShowResend] = useState(false)
  const navigate = useNavigate()

  
  const [useEmail, setUseEmail] = useState(false);        // toggle between legacy username vs email login
  const [isNew, setIsNew] = useState(false);              // email sign-up vs sign-in

  const [isCreateMode, setIsCreateMode] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    // 1‑A validate “create account” form
    if (isCreateMode && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
  
    try {
      const isEmail = email.includes("@");
  
      if (isEmail) {
        /* ---------- E‑mail path ---------- */
        if (isCreateMode) {
          /* sign‑up */
          const { verificationSent } = await emailSignUp(email, password);

          if (verificationSent) {
           setSuccess("Verification e‑mail sent. Please check your inbox. It may appear in your spam folder.");
           setIsCreateMode(false);
           setShowResend(true);
          }
        } else {
          /* sign‑in */
          const { userId } = await emailSignIn(email, password);
          sessionStorage.setItem("currentUser", userId);
          navigate("/HomePage");
        }
  
      } else {
        /* ---------- legacy username path ---------- */
        const userData = await getUserByUsername(email);      // email var still contains username
        if (!userData) { setError("No account with that username."); return; }
        if (!verifyUserPassword(userData, password)) { setError("Incorrect password."); return; }
        await initializeUser(email, password);
        sessionStorage.setItem("currentUser", email);
        navigate("/HomePage");
      }
  
  
    } catch (err) {
      const code = err.code ?? err.message;
      if (code === "auth/email-not-verified") {
        setError("Please verify your e‑mail first.");
        setShowResend(true);
      } else {
        setError(humanMessage(code));
      }
    } finally {
      setLoading(false);
    }
  };
  

  const handleGoogleSignIn = async () => {
    setLoading(true); setError("");
    try {
      await signOut(auth);
      const userId = await signInWithProviderAndLink(googleProvider, "google", async (email) => {
        // TEMP quick password prompt for testing linking to email accounts
        return window.prompt(`Enter password for ${email} to link your accounts:`);
      });
      sessionStorage.setItem("currentUser", userId);
      navigate("/HomePage");
    } catch (err) {
      setError(humanMessage(err.code ?? err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setLoading(true); setError("");
    try {
      await signOut(auth);
      const userId = await signInWithProviderAndLink(microsoftProvider, "microsoft", async (email) => {
        return window.prompt(`Enter password for ${email} to link your accounts:`); 
      });
      sessionStorage.setItem("currentUser", userId);
      navigate("/HomePage");
    } catch (err) {
      setError(humanMessage(err.code ?? err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // sign in (works even if e‑mail unverified)
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      await sendEmailVerification(cred.user);
      await signOut(auth);                     // keep session clean
      setSuccess("Verification e‑mail resent! Check your inbox.");
      setShowResend(false);
    } catch (err) {
      setError(humanMessage(err.code ?? err.message));
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
              <div className="flex justify-center mb-4">
                <div className="bg-gray-700/50 rounded-xl p-1 flex">
                  <button
                    type="button"
                    onClick={() => setIsCreateMode(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      !isCreateMode
                        ? 'bg-orange-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateMode(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isCreateMode
                        ? 'bg-orange-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">
                {isCreateMode ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-gray-400 text-center text-sm">
                {isCreateMode ? 'Create your account to get started' : 'Sign in to access your dashboard'}
              </p>
            </div>

            

            {/* Form */}
            <div className="px-8 pb-8">
              {/* ✅ success banner — ADD THIS FIRST */}
              {success && (
                <div className="mb-6 p-4 bg-green-900/30 border border-green-700/50 rounded-xl">
                  <p className="text-green-300 text-sm text-center">{success}</p>
                </div>
              )}
              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                  <p className="text-red-300 text-sm text-center">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <label htmlFor="email" className="sr-only">E‑mail or Username</label>
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="email"
                    name="email"
                    type="text"
                    required
                    className="block w-full pl-12 pr-4 py-4 border border-gray-600/50 rounded-xl leading-5 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200 backdrop-blur-sm"
                    placeholder={isCreateMode ? "Email Address" : "Email or Username"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

                {isCreateMode && (
                  <div className="relative">
                    <label htmlFor="confirmPassword" className="sr-only">
                      Confirm Password
                    </label>
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      required={isCreateMode}
                      className="block w-full pl-12 pr-12 py-4 border border-gray-600/50 rounded-xl leading-5 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200 backdrop-blur-sm"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}

                {/* 🔄 Resend verification link — ADD THIS */}
                {showResend && (
                  <p className="text-xs text-orange-400 text-right -mt-4 mb-4">
                    Didn’t get the e‑mail?{" "}
                    <button
                      type="button"
                      className="underline hover:text-orange-200"
                      onClick={handleResendVerification}
                      disabled={loading}
                    >
                      Resend verification
                    </button>
                  </p>
                )}

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
                      isCreateMode ? "Create Account" : "Sign In"
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
                  {isCreateMode ? 'Create account with Google' : 'Sign in with Google'}
                </button>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleMicrosoftSignIn}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl border border-gray-600/50 text-white bg-gray-700/50 hover:bg-gray-600/60 transition-all"
                  disabled={loading}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                    alt="Microsoft logo"
                    className="w-5 h-5"
                  />
                  {isCreateMode ? 'Create account with Microsoft' : 'Sign in with Microsoft'}
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
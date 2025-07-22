"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  User,
  Lock,
  Link2,
  Unlink,
  Camera,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Bell,
  Shield,
  Trash2,
  ExternalLink,
  AlertCircle,
  Settings,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
} from "lucide-react"
import AppLayout from "../components/AppLayout"
import { getUserProfile, updateUserProfile } from "../services/firebaseService"

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const navigate = useNavigate()

  // Form states
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    email: "",
    bio: "",
    location: "",
    website: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [connectedServices, setConnectedServices] = useState({
    google: false,
    microsoft: false,
    apple: false,
  })

  const [socialLinks, setSocialLinks] = useState({
    instagram: "",
    tiktok: "",
    youtube: "",
    twitch: "",
    kick: "",
    twitter: "",
    discord: "",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    betAlerts: true,
    creatorUpdates: true,
    weeklyReports: true,
  })

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: "public",
    showStats: true,
    showBetHistory: false,
    allowMessages: true,
  })

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userId = sessionStorage.getItem("currentUser")
        if (!userId) {
          navigate("/")
          return
        }

        setCurrentUser(userId)
        const profile = await getUserProfile(userId)

        if (profile) {
          setUserProfile(profile)
          setProfileForm({
            displayName: profile.displayName || "",
            email: profile.email || "",
            bio: profile.bio || "",
            location: profile.location || "",
            website: profile.website || "",
          })

          // Load connected services and social links from profile
          setConnectedServices(
            profile.connectedServices || {
              google: false,
              microsoft: false,
              apple: false,
            },
          )

          setSocialLinks(
            profile.socialLinks || {
              instagram: "",
              tiktok: "",
              youtube: "",
              twitch: "",
              kick: "",
              twitter: "",
              discord: "",
            },
          )

          setNotificationSettings(
            profile.notificationSettings || {
              emailNotifications: true,
              pushNotifications: true,
              betAlerts: true,
              creatorUpdates: true,
              weeklyReports: true,
            },
          )

          setPrivacySettings(
            profile.privacySettings || {
              profileVisibility: "public",
              showStats: true,
              showBetHistory: false,
              allowMessages: true,
            },
          )
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [navigate])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const updatedProfile = {
        ...profileForm,
        connectedServices,
        socialLinks,
        notificationSettings,
        privacySettings,
      }

      await updateUserProfile(currentUser, updatedProfile)
      setUserProfile({ ...userProfile, ...updatedProfile })
      setEditingProfile(false)

      // Show success message
      alert("Profile updated successfully!")
    } catch (error) {
      console.error("Error updating profile:", error)
      alert("Failed to update profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleConnectService = (service) => {
    // In a real implementation, this would trigger OAuth flow
    setConnectedServices((prev) => ({
      ...prev,
      [service]: !prev[service],
    }))
  }

  const handleSocialLinkChange = (platform, value) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value,
    }))
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "account", label: "Account", icon: Settings },
    { id: "social", label: "Social Links", icon: Link2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Shield },
  ]

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl p-8 border border-gray-700">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Avatar Section */}
            <div className="relative">
              <img
                src={userProfile?.pfp || "/placeholder.svg?height=120&width=120"}
                alt="Profile"
                className="w-32 h-32 rounded-full border-4 border-blue-500 object-cover"
              />
              <button className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{userProfile?.displayName || currentUser}</h1>
                <div className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-medium">PRO</div>
              </div>
              <p className="text-gray-400 mb-4">@{currentUser}</p>
              <p className="text-gray-300 mb-6">
                {userProfile?.bio || "Sports betting enthusiast and community member"}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Win Rate</span>
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {(((userProfile?.winCount || 0) / Math.max(userProfile?.totalBets || 1, 1)) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Earnings</span>
                  </div>
                  <div className="text-lg font-bold text-blue-400">${(userProfile?.totalEarnings || 0).toFixed(2)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">Total Bets</span>
                  </div>
                  <div className="text-lg font-bold text-purple-400">{userProfile?.totalBets || 0}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <Calendar className="w-4 h-4 text-pink-400" />
                    <span className="text-xs text-gray-400">Member Since</span>
                  </div>
                  <div className="text-lg font-bold text-pink-400">
                    {userProfile?.createdAt
                      ? new Date(userProfile.createdAt.seconds * 1000).getFullYear()
                      : new Date().getFullYear()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white border-b-2 border-blue-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Profile Information</h2>
                <button
                  onClick={() => setEditingProfile(!editingProfile)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{editingProfile ? "Cancel" : "Edit Profile"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    disabled={!editingProfile}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                    disabled={!editingProfile}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={profileForm.location}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                    disabled={!editingProfile}
                    placeholder="City, Country"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                  <input
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, website: e.target.value }))}
                    disabled={!editingProfile}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
                  disabled={!editingProfile}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
                />
              </div>

              {editingProfile && (
                <div className="flex space-x-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                  </button>
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Account Settings</h2>

                {/* Connected Services */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Connected Services</h3>
                  <div className="space-y-4">
                    {Object.entries(connectedServices).map(([service, connected]) => (
                      <div
                        key={service}
                        className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              service === "google"
                                ? "bg-red-600"
                                : service === "microsoft"
                                  ? "bg-blue-600"
                                  : "bg-gray-600"
                            }`}
                          >
                            <span className="text-white font-bold text-sm">
                              {service === "google" ? "G" : service === "microsoft" ? "M" : "A"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-white capitalize">{service}</p>
                            <p className="text-sm text-gray-400">{connected ? "Connected" : "Not connected"}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConnectService(service)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                            connected
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                        >
                          {connected ? <Unlink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                          <span>{connected ? "Disconnect" : "Connect"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Password Change */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                  <button
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors mb-4"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Change Password</span>
                  </button>

                  {showPasswordChange && (
                    <div className="space-y-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Current Password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="New Password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />

                      <div className="flex space-x-4">
                        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                          Update Password
                        </button>
                        <button
                          onClick={() => setShowPasswordChange(false)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Social Links Tab */}
          {activeTab === "social" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Social Media Links</h2>
              <p className="text-gray-400">
                Connect your social media accounts to share your betting success and connect with the community.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(socialLinks).map(([platform, url]) => {
                  const platformConfig = {
                    instagram: { name: "Instagram", color: "bg-pink-600", icon: "📷" },
                    tiktok: { name: "TikTok", color: "bg-black", icon: "🎵" },
                    youtube: { name: "YouTube", color: "bg-red-600", icon: "📺" },
                    twitch: { name: "Twitch", color: "bg-purple-600", icon: "🎮" },
                    kick: { name: "Kick", color: "bg-green-600", icon: "⚡" },
                    twitter: { name: "Twitter", color: "bg-blue-500", icon: "🐦" },
                    discord: { name: "Discord", color: "bg-indigo-600", icon: "💬" },
                  }

                  const config = platformConfig[platform]

                  return (
                    <div key={platform} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center`}>
                          <span className="text-lg">{config.icon}</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{config.name}</h3>
                          <p className="text-sm text-gray-400">@{platform}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                          placeholder={`https://${platform}.com/yourusername`}
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Social Links"}</span>
              </button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Notification Preferences</h2>
              <p className="text-gray-400">Choose what notifications you'd like to receive.</p>

              <div className="space-y-4">
                {Object.entries(notificationSettings).map(([key, enabled]) => {
                  const notificationConfig = {
                    emailNotifications: { name: "Email Notifications", desc: "Receive notifications via email" },
                    pushNotifications: {
                      name: "Push Notifications",
                      desc: "Receive push notifications in your browser",
                    },
                    betAlerts: { name: "Bet Alerts", desc: "Get notified about your active bets" },
                    creatorUpdates: { name: "Creator Updates", desc: "Updates from creators you follow" },
                    weeklyReports: { name: "Weekly Reports", desc: "Weekly summary of your betting performance" },
                  }

                  const config = notificationConfig[key]

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
                    >
                      <div>
                        <h3 className="font-medium text-white">{config.name}</h3>
                        <p className="text-sm text-gray-400">{config.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotificationSettings((prev) => ({ ...prev, [key]: !enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? "bg-blue-600" : "bg-gray-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Preferences"}</span>
              </button>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Privacy Settings</h2>
              <p className="text-gray-400">Control who can see your information and activity.</p>

              <div className="space-y-6">
                <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <h3 className="font-medium text-white mb-2">Profile Visibility</h3>
                  <p className="text-sm text-gray-400 mb-4">Who can see your profile information</p>
                  <select
                    value={privacySettings.profileVisibility}
                    onChange={(e) => setPrivacySettings((prev) => ({ ...prev, profileVisibility: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="public">Public - Anyone can see</option>
                    <option value="community">Community - Only community members</option>
                    <option value="private">Private - Only you</option>
                  </select>
                </div>

                {Object.entries(privacySettings)
                  .filter(([key]) => key !== "profileVisibility")
                  .map(([key, enabled]) => {
                    const privacyConfig = {
                      showStats: {
                        name: "Show Betting Stats",
                        desc: "Display your win rate and earnings on your profile",
                      },
                      showBetHistory: { name: "Show Bet History", desc: "Allow others to see your betting history" },
                      allowMessages: { name: "Allow Messages", desc: "Let other users send you direct messages" },
                    }

                    const config = privacyConfig[key]

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600"
                      >
                        <div>
                          <h3 className="font-medium text-white">{config.name}</h3>
                          <p className="text-sm text-gray-400">{config.desc}</p>
                        </div>
                        <button
                          onClick={() => setPrivacySettings((prev) => ({ ...prev, [key]: !enabled }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            enabled ? "bg-blue-600" : "bg-gray-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              enabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}

                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-red-400 mb-2">Danger Zone</h3>
                      <p className="text-sm text-gray-300 mb-4">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                      <button className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Privacy Settings"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

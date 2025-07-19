"use client"

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Menu, X, Home, Users, History, Bell } from "lucide-react"

export default function MobileLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const NavItem = ({ path, icon: Icon, label }) => {
    const isActive = location.pathname === path

    return (
      <button
        className={`block p-2 rounded w-full text-left ${isActive ? "bg-gray-600" : "hover:bg-gray-700"}`}
        onClick={() => {
          navigate(path)
          setSidebarOpen(false)
        }}
      >
        <Icon className="w-5 h-5 inline mr-2" />
        {label}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-800 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-500 rounded-md mr-3"></div>
          <h1 className="text-lg font-bold">Lambda Rim</h1>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 bg-gray-800 min-h-screen p-4">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-md mr-3"></div>
            <h1 className="text-xl font-bold">Lambda Rim</h1>
          </div>

          <nav className="space-y-2">
            <NavItem path="/dashboard" icon={Home} label="Home" />
            <NavItem path="/processed-players" icon={Users} label="Already Processed Players" />
            <NavItem path="/previous-bets" icon={History} label="Previous Bets" />
            <NavItem path="/alerts" icon={Bell} label="Alerts" />
            <NavItem path="/community" icon={PersonStanding} label="Community" />
          </nav>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}>
            <div className="fixed left-0 top-0 bottom-0 w-64 bg-gray-800 p-4" onClick={(e) => e.stopPropagation()}>
              <nav className="space-y-2 mt-16">
                <NavItem path="/dashboard" icon={Home} label="Home" />
                <NavItem path="/processed-players" icon={Users} label="Already Processed Players" />
                <NavItem path="/previous-bets" icon={History} label="Previous Bets" />
                <NavItem path="/alerts" icon={Bell} label="Alerts" />
                <NavItem path="/community" icon={PersonStanding} label="Community" />
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</div>
      </div>
    </div>
  )
}

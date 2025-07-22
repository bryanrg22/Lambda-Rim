import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import SignIn from "./pages/SignIn"
import DashboardPage from "./pages/DashboardPage"
import ProcessedPlayersPage from "./pages/ProcessedPlayersPage"
import PreviousBetsPage from "./pages/PreviousBetsPage"
import CommunityPage from "./pages/CommunityPage"
import ProfilePage from "./pages/ProfilePage"
import AlertsPage from "./pages/AlertsPage"
import AdminLogin from "./pages/AdminLogin"
import AdminDashboard from "./pages/AdminDashboard"
import PublicProfilePage from "./pages/PublicProfilePage"

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/processed-players" element={<ProcessedPlayersPage />} />
      <Route path="/previous-bets" element={<PreviousBetsPage />} />
      <Route path="/community" element={<CommunityPage/>} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/HomePage" element={<DashboardPage />} />
      <Route path="/profile/:username" element={<PublicProfilePage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
    </Routes>
  </Router>
)

export default App

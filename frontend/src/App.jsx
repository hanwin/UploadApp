import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box, 
  Tabs,
  Tab,
  IconButton
} from '@mui/material';
import { Logout as LogoutIcon, AudioFile, People, Folder, AccountCircle } from '@mui/icons-material';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import AudioList from './components/AudioList';
import UserManagement from './components/UserManagement';
import FolderManagement from './components/FolderManagement';
import ProfileDialog from './components/ProfileDialog';
import Toast from './components/Toast';
import { ToastProvider } from './contexts/ToastContext';
import { authAPI } from './services/api';

function AppContent() {
  const IMPERSONATION_RETURN_PATH_KEY = 'impersonationReturnPath';
  const [user, setUser] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [realUser, setRealUser] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Map URL paths to tab indices for admin
  const tabPaths = ['/files', '/folders', '/users'];
  const getTabFromPath = () => {
    if (location.pathname.startsWith('/folders')) return 1;
    if (location.pathname.startsWith('/users')) return 2;
    return 0;
  };
  const activeTab = getTabFromPath();

  useEffect(() => {
    const savedImpersonation = localStorage.getItem('impersonatedUser');
    const savedRealUser = localStorage.getItem('realUser');
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
      return;
    }

    authAPI.getProfile().then(res => {
      setUser(res.data);

      if (savedImpersonation && savedRealUser) {
        setImpersonatedUser(JSON.parse(savedImpersonation));
        setRealUser(JSON.parse(savedRealUser));
      }
    }).catch(() => {
      setUser(null);
      setImpersonatedUser(null);
      setRealUser(null);
      localStorage.removeItem('impersonatedUser');
      localStorage.removeItem('realUser');
      localStorage.removeItem(IMPERSONATION_RETURN_PATH_KEY);
    });
  }, []);

  // Auto-logout after 60 minutes of inactivity
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes in milliseconds
    let inactivityTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Set up event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Also reset timer on XHR/fetch activity (e.g. during uploads)
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
      resetTimer();
      return origSend.apply(this, args);
    };

    // Start the timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      XMLHttpRequest.prototype.send = origSend;
    };
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    navigate('/files');
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Clear local state even if the server-side cookie is already gone.
    }

    localStorage.removeItem('impersonatedUser');
    localStorage.removeItem('realUser');
    localStorage.removeItem(IMPERSONATION_RETURN_PATH_KEY);
    setUser(null);
    setImpersonatedUser(null);
    setRealUser(null);
    navigate('/login');
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleViewAsUser = (targetUser) => {
    const currentPath = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`;
    localStorage.setItem(IMPERSONATION_RETURN_PATH_KEY, currentPath || '/users');

    // Save real user
    setRealUser(user);
    localStorage.setItem('realUser', JSON.stringify(user));
    
    // Set impersonated user
    setImpersonatedUser(targetUser);
    localStorage.setItem('impersonatedUser', JSON.stringify(targetUser));
    
    // Switch directly to the impersonated user's associated folder.
    const firstFolder = targetUser?.folders?.[0];
    if (firstFolder) {
      navigate(`/files/${encodeURIComponent(firstFolder)}`);
    } else {
      navigate('/files');
    }
  };

  const handleStopImpersonation = () => {
    setImpersonatedUser(null);
    setRealUser(null);
    localStorage.removeItem('impersonatedUser');
    localStorage.removeItem('realUser');
    const returnPath = localStorage.getItem(IMPERSONATION_RETURN_PATH_KEY) || '/users';
    localStorage.removeItem(IMPERSONATION_RETURN_PATH_KEY);
    navigate(returnPath);
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={
          <>
            <ForgotPassword onBack={() => navigate('/login')} />
            <Toast />
          </>
        } />
        <Route path="/reset-password" element={
          <>
            <ResetPassword />
            <Toast />
          </>
        } />
        <Route path="*" element={
          <>
            <Login 
              onLogin={handleLogin} 
              onForgotPassword={() => navigate('/forgot-password')}
            />
            <Toast />
          </>
        } />
      </Routes>
    );
  }

  const isSuperadmin = user.role === 'superadmin';
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const displayUser = impersonatedUser || user;
  const showAdminTabs = isSuperadmin && !impersonatedUser;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <AudioFile sx={{ mr: { xs: 1, sm: 2 }, display: { xs: 'none', sm: 'block' } }} />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }}
          >
            Audio Upload App
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              mr: { xs: 1, sm: 2 },
              display: { xs: 'none', sm: 'block' }
            }}
          >
            {user.name || user.username}
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => setProfileDialogOpen(true)}
            sx={{ mr: 1 }}
            title="Min profil"
          >
            <AccountCircle />
          </IconButton>
          <Button 
            color="inherit" 
            onClick={handleLogout}
            startIcon={<LogoutIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
            sx={{ 
              minWidth: { xs: 'auto', sm: 'inherit' },
              px: { xs: 1, sm: 2 }
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Logga ut
            </Box>
            <LogoutIcon sx={{ display: { xs: 'inline-flex', sm: 'none' } }} />
          </Button>
        </Toolbar>
      </AppBar>

      {/* Profile Dialog */}
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        user={user}
        onUpdate={(updatedUser) => {
          setUser({ ...user, ...updatedUser });
        }}
      />

      {/* Impersonation Banner */}
      {impersonatedUser && (
        <Box 
          sx={{ 
            bgcolor: 'warning.main', 
            color: 'warning.contrastText',
            py: 1,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            👁️ Du ser som: {impersonatedUser.username} ({impersonatedUser.role})
          </Typography>
          <Button 
            variant="contained" 
            size="small"
            onClick={handleStopImpersonation}
            sx={{ 
              bgcolor: 'warning.dark',
              '&:hover': {
                bgcolor: 'warning.darker'
              }
            }}
          >
            Avsluta
          </Button>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
        {showAdminTabs && (
          <Box sx={{ mb: { xs: 2, sm: 3 } }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => navigate(tabPaths[newValue])}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTabs-indicator': {
                  left: 0,
                },
                '& .MuiTabs-flexContainer': {
                  justifyContent: 'flex-start',
                }
              }}
            >
              <Tab 
                icon={<AudioFile />} 
                label="Ljudfiler" 
                iconPosition="start"
                sx={{ minHeight: { xs: 48, sm: 64 } }}
              />
              <Tab 
                icon={<Folder />} 
                label="Mappar" 
                iconPosition="start"
                sx={{ minHeight: { xs: 48, sm: 64 } }}
              />
              <Tab 
                icon={<People />} 
                label="Användare" 
                iconPosition="start"
                sx={{ minHeight: { xs: 48, sm: 64 } }}
              />
            </Tabs>
          </Box>
        )}

        <Routes>
          <Route path="/folders" element={
            showAdminTabs ? <FolderManagement user={user} /> : <AudioList user={displayUser} refreshTrigger={refreshTrigger} onUploadSuccess={handleUploadSuccess} impersonatedUserId={impersonatedUser?.id} />
          } />
          <Route path="/users" element={
            showAdminTabs ? <UserManagement user={user} onViewAsUser={handleViewAsUser} /> : <AudioList user={displayUser} refreshTrigger={refreshTrigger} onUploadSuccess={handleUploadSuccess} impersonatedUserId={impersonatedUser?.id} />
          } />
          <Route path="*" element={
            <Box>
              <AudioList 
                user={displayUser} 
                refreshTrigger={refreshTrigger} 
                onUploadSuccess={handleUploadSuccess}
                impersonatedUserId={impersonatedUser?.id}
              />
            </Box>
          } />
        </Routes>
      </Container>
      
      <Toast />
    </Box>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;

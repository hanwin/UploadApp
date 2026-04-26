import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  CircularProgress,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function Login({ onLogin, onForgotPassword }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { error: showError } = useToast();

  useEffect(() => {
    let mounted = true;

    // Load saved username only
    const savedUsername = localStorage.getItem('savedUsername');
    
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }

    authAPI.getCsrfToken()
      .then((token) => {
        if (mounted && token) {
          setCsrfToken(token);
        }
      })
      .catch(() => {
        // CSRF token will be retried by API interceptor on submit if needed.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login({ username, password });
      
      // Save or remove username based on checkbox
      if (rememberMe) {
        localStorage.setItem('savedUsername', username);
      } else {
        localStorage.removeItem('savedUsername');
      }
      
      onLogin(response.data.user);
    } catch (err) {
      showError(err.response?.data?.error || 'Inloggning misslyckades');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: { xs: '5vh', sm: '10vh' }
        }}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <LoginIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Logga in
              </Typography>
            </Box>

            <Box component="form" method="post" onSubmit={handleSubmit} autoComplete="on">
              <input type="hidden" name="csrfToken" value={csrfToken} readOnly />
              <TextField
                fullWidth
                label="Användarnamn eller e-post"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                margin="normal"
                autoFocus
                autoComplete="username"
              />
              <TextField
                fullWidth
                label="Lösenord"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="current-password"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                  />
                }
                label="Kom ihåg användarnamn"
              />
              
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={onForgotPassword}
                  sx={{ cursor: 'pointer' }}
                >
                  Glömt lösenord?
                </Link>
              </Box>
              
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
              >
                {loading ? 'Loggar in...' : 'Logga in'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default Login;

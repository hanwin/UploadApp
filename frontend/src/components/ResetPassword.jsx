import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { LockReset as LockResetIcon } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function ResetPassword() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { success: showSuccess, error: showError } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
      setToken(resetToken);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showError('Lösenorden matchar inte');
      return;
    }

    if (password.length < 12) {
      showError('Lösenordet måste vara minst 12 tecken långt');
      return;
    }

    if (!token) {
      showError('Ogiltig återställningslänk');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword({ token, password });
      setSuccess(true);
      showSuccess('Lösenordet har återställts! Laddar om sidan...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      showError(err.response?.data?.error || 'Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <LockResetIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Lösenordet har återställts!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Du kan nu logga in med ditt nya lösenord.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: '10vh' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <LockResetIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Återställ lösenord
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lösenordet måste vara minst 12 tecken långt och innehålla både stora och små bokstäver, siffror samt specialtecken.
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} autoComplete="on">
              <TextField
                fullWidth
                label="Nytt lösenord"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoFocus
                helperText="Minst 12 tecken (stora/små bokstäver, siffror, specialtecken)"
                autoComplete="new-password"
              />
              <TextField
                fullWidth
                label="Bekräfta lösenord"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="new-password"
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
                startIcon={loading ? <CircularProgress size={20} /> : <LockResetIcon />}
              >
                {loading ? 'Återställer...' : 'Återställ lösenord'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default ResetPassword;
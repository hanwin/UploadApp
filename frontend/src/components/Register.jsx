import { useState } from 'react';
import { validatePassword } from '../utils/passwordValidator';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  CircularProgress
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function Register({ onToggleMode }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      showError('Lösenorden matchar inte');
      return;
    }

    const pwError = validatePassword(formData.password);
    if (pwError) {
      showError(pwError);
      return;
    }

    setLoading(true);

    try {
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      success('Registrering lyckades! Du kan nu logga in.');
      setTimeout(() => onToggleMode(), 2000);
    } catch (err) {
      showError(err.response?.data?.error || 'Registrering misslyckades');
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
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <PersonAddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Registrera dig
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} autoComplete="on">
              <TextField
                fullWidth
                label="Användarnamn"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                margin="normal"
                autoFocus
                autoComplete="username"
              />
              <TextField
                fullWidth
                label="E-post"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                margin="normal"
                autoComplete="email"
              />
              <TextField
                fullWidth
                label="Lösenord"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                margin="normal"
                helperText="Minst 12 tecken"
                autoComplete="new-password"
              />
              <TextField
                fullWidth
                label="Bekräfta lösenord"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
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
                startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
              >
                {loading ? 'Registrerar...' : 'Registrera'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2">
                Har du redan ett konto?{' '}
                <Link
                  component="button"
                  variant="body2"
                  onClick={onToggleMode}
                  sx={{ cursor: 'pointer' }}
                >
                  Logga in
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default Register;

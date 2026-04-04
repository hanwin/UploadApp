import { useState } from 'react';
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
import { Email as EmailIcon, ArrowBack } from '@mui/icons-material';
import { authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { success, error: showError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authAPI.forgotPassword({ email });
      setSubmitted(true);
      success('Om e-postadressen finns har vi skickat återställningsinstruktioner');
    } catch (err) {
      showError(err.response?.data?.error || 'Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            pt: '10vh'
          }}
        >
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Kolla din e-post
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Om e-postadressen finns i systemet har vi skickat instruktioner för att återställa ditt lösenord.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Kontrollera även din skräppost om du inte ser mailet.
              </Typography>
              <Button
                variant="outlined"
                onClick={onBack}
                startIcon={<ArrowBack />}
                sx={{ mt: 2 }}
              >
                Tillbaka till inloggning
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          pt: '10vh'
        }}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <EmailIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Glömt lösenord?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ange din e-postadress så skickar vi instruktioner för att återställa ditt lösenord.
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="E-postadress"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                autoFocus
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
                startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
              >
                {loading ? 'Skickar...' : 'Skicka återställningslänk'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link
                component="button"
                variant="body2"
                onClick={onBack}
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}
              >
                <ArrowBack fontSize="small" /> Tillbaka till inloggning
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default ForgotPassword;
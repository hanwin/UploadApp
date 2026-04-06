import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import { Refresh, ContentCopy } from '@mui/icons-material';
import { userAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

function ProfileDialog({ open, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { success, error: showError } = useToast();

  const generatePassword = () => {
    const length = 16;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData({ ...formData, newPassword: password, confirmPassword: password });
    success('Lösenord genererat!');
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(formData.newPassword);
    success('Lösenord kopierat!');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate passwords match if changing password
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        showError('Lösenorden matchar inte');
        setLoading(false);
        return;
      }

      const updateData = {};
      
      // Only include email if changed
      if (formData.email !== user.email) {
        updateData.email = formData.email;
      }

      // Only include password if provided
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        showError('Inga ändringar att spara');
        setLoading(false);
        return;
      }

      const response = await userAPI.updateOwnProfile(updateData);
      success('Profilen uppdaterad');

      if (onUpdate) {
        onUpdate(response.data.user);
      }
      
      onClose();
    } catch (err) {
      showError(err.response?.data?.error || 'Något gick fel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Min profil</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Användarnamn"
              value={user?.username || ''}
              disabled
              fullWidth
            />
            
            <TextField
              label="E-postadress"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              fullWidth
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Byt lösenord (valfritt)
            </Typography>

            <TextField
              label="Nuvarande lösenord"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleChange}
              fullWidth
              autoComplete="current-password"
            />

            <TextField
              label="Nytt lösenord"
              name="newPassword"
              type={showPassword ? "text" : "password"}
              value={formData.newPassword}
              onChange={handleChange}
              onFocus={() => setShowPassword(true)}
              onBlur={() => setShowPassword(false)}
              fullWidth
              autoComplete="new-password"
              helperText="Minst 12 tecken. Använd stora och små bokstäver, siffror och specialtecken. Klicka på 🔄 för att generera."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {formData.newPassword && (
                      <Tooltip title="Kopiera lösenord">
                        <IconButton 
                          onClick={copyPassword} 
                          edge="end" 
                          size="small"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Generera säkert lösenord">
                      <IconButton 
                        onClick={generatePassword} 
                        edge="end" 
                        size="small"
                        color="primary"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Refresh fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Bekräfta nytt lösenord"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={handleChange}
              fullWidth
              autoComplete="new-password"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Avbryt</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Sparar...' : 'Spara'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default ProfileDialog;

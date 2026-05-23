import { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadLinkAPI } from '../services/api';

const MAX_SIZE_BYTES = 4 * 1024 * 1024 * 1024;

function PublicUploadPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = searchParams.get('token') || '';

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [linkInfo, setLinkInfo] = useState(null);
  const [infoError, setInfoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setInfoError('Länk saknas eller är ogiltig.');
        setLoadingInfo(false);
        return;
      }

      try {
        const response = await uploadLinkAPI.getPublicInfo(token);
        setLinkInfo(response.data);
      } catch (error) {
        setInfoError(error.response?.data?.error || 'Länken är ogiltig eller har gått ut.');
      } finally {
        setLoadingInfo(false);
      }
    };

    validate();
  }, [token]);

  const onFileSelected = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const ext = `.${selectedFile.name.split('.').pop().toLowerCase()}`;
    if (!['.mp3', '.wav'].includes(ext)) {
      setMessage({ type: 'error', text: 'Endast MP3 och WAV filer är tillåtna.' });
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setMessage({ type: 'error', text: 'Filen får max vara 4GB.' });
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('audio', selectedFile);

    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      await uploadLinkAPI.publicUpload(formData, token, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        }
      });
      setMessage({ type: 'success', text: 'Filen är uppladdad.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Uppladdning misslyckades.' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 640 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Ladda upp fil
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Använd denna sida för att ladda upp en fil via delad länk.
          </Typography>

          {loadingInfo && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {!loadingInfo && infoError && <Alert severity="error" sx={{ mb: 2 }}>{infoError}</Alert>}

          {!loadingInfo && !infoError && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Länken gäller till: {new Date(linkInfo?.expiresAt).toLocaleString('sv-SE')}
              </Alert>

              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={uploading}
              >
                Välj fil (MP3 eller WAV)
                <input hidden type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={onFileSelected} />
              </Button>

              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Laddar upp: {uploadProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}
            </>
          )}

          {!!message.text && (
            <Alert severity={message.type || 'info'} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default PublicUploadPage;

import { Box, Typography } from '@mui/material';
import UploadLinkManager from './UploadLinkManager';

function ExternalUploadLinksPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Externa uppladdningslänkar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Här skapar du tidsbegränsade länkar för extern uppladdning. Uppladdningar via länken hanteras separat från vanliga mappflöden i gränssnittet.
      </Typography>
      <UploadLinkManager />
    </Box>
  );
}

export default ExternalUploadLinksPage;

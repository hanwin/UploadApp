import { Box, Button, Card, CardContent, Grid, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import { useNavigate } from 'react-router-dom';

function AdminOverviewPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Användare',
      description: 'Skapa och redigera användare.',
      icon: <PeopleIcon fontSize="large" />,
      action: () => navigate('/users')
    },
    {
      title: 'Mappar',
      description: 'Skapa och hantera mappar.',
      icon: <FolderIcon fontSize="large" />,
      action: () => navigate('/folders')
    },
    {
      title: 'Synk',
      description: 'Synka filer och mappar mellan disk och databas.',
      icon: <SyncIcon fontSize="large" />,
      action: () => navigate('/sync')
    }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Adminöversikt
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Välj det område du vill arbeta i.
      </Typography>

      <Grid container spacing={2}>
        {sections.map((section) => (
          <Grid item xs={12} md={4} key={section.title}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ color: 'primary.main' }}>
                  {section.icon}
                </Box>
                <Typography variant="h6">{section.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {section.description}
                </Typography>
                {section.title === 'Användare' && (
                  <Typography variant="caption" color="text.secondary">
                    Här kan du även ändra namn, e-post och lösenord för vanliga användare.
                  </Typography>
                )}
                <Button variant="contained" onClick={section.action}>
                  Öppna
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default AdminOverviewPage;
